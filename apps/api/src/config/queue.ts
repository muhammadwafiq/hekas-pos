/**
 * pg-boss queue setup (background jobs).
 * Uses the same Postgres database — pg-boss manages its own `pgboss` schema.
 */

import { PgBoss } from 'pg-boss';
import { env } from './env.js';
import { logger } from './logger.js';

let boss: PgBoss | null = null;

export async function startQueue(): Promise<PgBoss> {
  if (boss) return boss;

  boss = new (PgBoss as any)({
    connectionString: env.DATABASE_URL,
    schema: 'pgboss',
    retryLimit: 5,
    retryBackoff: true, // exponential
    retryDelay: 30, // 30s initial
    workerInterval: 2,
  });

  boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));

  await boss.start();
  logger.info('pg-boss queue started');

  return boss;
}

export function getQueue(): PgBoss {
  if (!boss) throw new Error('Queue not started. Call startQueue() first.');
  return boss;
}

export async function stopQueue(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true });
    boss = null;
    logger.info('pg-boss queue stopped');
  }
}

// ====== Job types (centralized for type-safety) ======
export const QUEUE_NAMES = {
  TELEGRAM_SEND: 'telegram:send',
  PDF_GENERATE: 'pdf:generate',
  DAILY_REPORT: 'reports-daily',
  AI_CLEANUP: 'ai:cleanup',
  NOTIFICATION_RETRY: 'notification:retry',
} as const;

export type TelegramSendJob = {
  messageId: string;
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
};

export type PdfGenerateJob = {
  type: 'surat_jalan' | 'daily_report' | 'operational_report';
  referenceId: string;
  recipientUserId: string;
};
