/**
 * Notification service — enqueue + dispatch Telegram messages.
 * Phase 4 Gate 3.
 *
 * Flow:
 *   1. Service calls enqueueTelegram(event, payload)
 *   2. Resolves target chat IDs by role → inserts notification_queue rows
 *   3. Returns immediately (sender worker processes asynchronously)
 *
 * Sender worker (Phase 4) polls pending rows, sends via Telegram API, updates status.
 */

import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { notificationQueue } from '../db/schema/telegram.js';
import { users } from '../db/schema/auth.js';
import { notificationQueueRepo } from '../repositories/notification-queue.repo.js';
import { telegramLinkService } from './telegram-link.service.js';
import { recipientsFor, type Role } from '../config/notification-recipients.js';
import { env } from '../config/env.js';

export const notificationService = {
  /**
   * Enqueue a Telegram notification for an event.
   * Auto-resolves targets based on event → roles → verified chat_ids.
   */
  async enqueueTelegram(
    eventType: string,
    payload: Record<string, any>,
    opts: { explicitRoles?: Role[]; explicitChatIds?: string[] } = {}
  ): Promise<{ enqueued: number; skipped?: string }> {
    if (!env.ENABLE_TELEGRAM) {
      logger.debug({ eventType }, 'Telegram disabled — skipping enqueue');
      return { enqueued: 0, skipped: 'telegram_disabled' };
    }

    // Resolve chat IDs
    const roles = opts.explicitRoles ?? recipientsFor(eventType);
    let chatIds: string[] = [];

    if (opts.explicitChatIds?.length) {
      chatIds = opts.explicitChatIds;
    } else if (roles.length) {
      chatIds = await telegramLinkService.resolveChatIdsByRoles(roles);
    }

    if (!chatIds.length) {
      logger.debug({ eventType, roles }, 'No chat IDs resolved — notification skipped');
      return { enqueued: 0, skipped: 'no_targets' };
    }

    // Insert one queue row per chat_id
    const rows = chatIds.map((chatId) => ({
      eventType: eventType as any,
      targetChatId: chatId,
      payload,
      status: 'pending' as const,
      attempts: 0,
      maxAttempts: env.TELEGRAM_MAX_RETRY,
    }));

    const inserted = await db.insert(notificationQueue).values(rows as any).returning();
    logger.info({ eventType, count: inserted.length }, 'Telegram notification enqueued');
    return { enqueued: inserted.length };
  },

  /**
   * Enqueue to a specific user_id (resolve their chat_id).
   */
  async enqueueTelegramForUser(opts: {
    userId: string;
    eventType: string;
    payload: Record<string, any>;
  }) {
    if (!env.ENABLE_TELEGRAM) return { enqueued: 0, skipped: 'telegram_disabled' };

    const [user] = await db.select().from(users).where(eq(users.id, opts.userId)).limit(1);
    if (!user) return { enqueued: 0, skipped: 'user_not_found' };

    // Resolve chat_id via telegram link
    const chatIds = await telegramLinkService.resolveChatIdsByRoles([user.role as Role]);
    if (!chatIds.length) return { enqueued: 0, skipped: 'no_targets' };

    const [row] = await db
      .insert(notificationQueue)
      .values({
        eventType: opts.eventType as any,
        targetUserId: opts.userId,
        targetChatId: chatIds[0],
        payload: opts.payload,
        status: 'pending',
        attempts: 0,
        maxAttempts: env.TELEGRAM_MAX_RETRY,
      } as any)
      .returning();

    return { enqueued: 1, id: row?.id };
  },

  /**
   * Stats — for monitoring dashboard / tests.
   */
  async stats(opts: { since?: Date } = {}) {
    return notificationQueueRepo.stats(opts);
  },

  async listQueue(opts: { status?: string; limit?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const conds: any[] = [];
    if (opts.status) conds.push(eq(notificationQueue.status, opts.status as any));
    const where = conds.length ? and(...conds) : undefined;
    return db
      .select()
      .from(notificationQueue)
      .where(where)
      .orderBy(sql`${notificationQueue.createdAt} DESC`)
      .limit(limit);
  },
};