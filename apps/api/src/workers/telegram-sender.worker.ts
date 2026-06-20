/**
 * Telegram sender worker — polls notification_queue, sends via Bot API.
 * Phase 4 Gate 3.
 *
 * Two modes:
 *   - pollLoop(): setInterval-based, runs in same process (good for dev/single-instance)
 *   - runPgBossWorker(): pg-boss-based, for production (multi-instance safe)
 *
 * For MVP we use pollLoop — pg-boss config already exists in Phase 0+1 stack.
 */

import { notificationQueueRepo, telegramMessageRepo } from '../repositories/notification-queue.repo.js';
import { telegramLinkRepo } from '../repositories/telegram-link.repo.js';
import { sendTelegramMessage } from '../lib/telegram.js';
import { renderTelegramMessage } from '../services/telegram-message-renderer.service.js';
import { logger } from '../config/logger.js';

const POLL_INTERVAL_MS = 5_000;

function expBackoffMs(attempts: number): number {
  return Math.min(60_000, 1000 * Math.pow(2, attempts));
}

let loopHandle: ReturnType<typeof setInterval> | null = null;

export const telegramSenderWorker = {
  start() {
    if (loopHandle) return;
    loopHandle = setInterval(() => {
      this.processBatch().catch((err) => logger.error({ err }, 'Sender batch failed'));
    }, POLL_INTERVAL_MS);
    logger.info({ interval: POLL_INTERVAL_MS }, 'Telegram sender worker started');
  },

  stop() {
    if (loopHandle) {
      clearInterval(loopHandle);
      loopHandle = null;
    }
  },

  async processBatch(opts: { limit?: number } = {}) {
    const due = await notificationQueueRepo.listDue({ limit: opts.limit ?? 10 });
    if (!due.length) return { processed: 0 };

    let processed = 0;
    for (const job of due) {
      try {
        await this.processOne(job.id);
        processed++;
      } catch (err: any) {
        logger.error({ err, jobId: job.id }, 'Sender processOne failed');
      }
    }
    return { processed };
  },

  async processOne(id: string) {
    const job = await notificationQueueRepo.getById(id);
    if (!job) return;

    if (!job.targetChatId) {
      await notificationQueueRepo.markFailed(id, 'no_chat_id');
      return;
    }

    const message = renderTelegramMessage(job.eventType as any, job.payload as any);

    const result = await sendTelegramMessage(job.targetChatId, message);

    // Log to telegram_messages (best-effort — find link by chatId)
    const link = await telegramLinkRepo.findByChatId(job.targetChatId);
    if (link) {
      await telegramMessageRepo
        .create({
          telegramLinkId: link.id,
          messageText: message,
          direction: 'outbound',
          status: result.ok ? 'sent' : 'failed',
        } as any)
        .catch((err) => logger.error({ err }, 'telegram_messages insert failed'));
    }

    if (result.ok) {
      await notificationQueueRepo.markSent(id);
      logger.info({ id, eventType: job.eventType }, 'Notification sent');
    } else {
      const attempts = (job.attempts ?? 0) + 1;
      await notificationQueueRepo.incrementAttempts(id);

      if (attempts >= job.maxAttempts) {
        await notificationQueueRepo.markFailed(id, result.error ?? 'unknown');
        logger.warn({ id, attempts, error: result.error }, 'Notification failed permanently');
      } else {
        const nextAttemptAt = new Date(Date.now() + expBackoffMs(attempts));
        await notificationQueueRepo.scheduleRetry(id, attempts, nextAttemptAt, result.error ?? 'unknown');
        logger.info({ id, attempts, nextAttemptAt, error: result.error }, 'Notification retry scheduled');
      }
    }
  },
};