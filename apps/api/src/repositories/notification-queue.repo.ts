/**
 * Notification queue repository — pg-boss job tracking.
 * Phase 4 Gate 3.
 */

import { eq, and, sql, lt, gte, lte, type SQL} from 'drizzle-orm';
import { db } from '../config/database.js';
import { notificationQueue, telegramMessages } from '../db/schema/telegram.js';

export const notificationQueueRepo = {
  async enqueue(data: typeof notificationQueue.$inferInsert) {
    const [row] = await db.insert(notificationQueue).values(data).returning();
    return row!;
  },

  async getById(id: string) {
    const [row] = await db.select().from(notificationQueue).where(eq(notificationQueue.id, id)).limit(1);
    return row ?? null;
  },

  async listDue(opts: { limit?: number } = {}) {
    const limit = opts.limit ?? 25;
    // Fix: Drizzle 0.45 + postgres-js 3.4 doesn't auto-stringify Date in raw SQL template
    // (causes "Received an instance of Date" error). Pre-stringify via toISOString().
    const now = new Date();
    return db
      .select()
      .from(notificationQueue)
      .where(
        and(
          eq(notificationQueue.status, 'pending'),
          sql`(${notificationQueue.nextAttemptAt} IS NULL OR ${notificationQueue.nextAttemptAt} <= ${now.toISOString()}::timestamp)`
        ) as any
      )
      .limit(limit);
  },

  async markSent(id: string) {
    const [row] = await db
      .update(notificationQueue)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(notificationQueue.id, id))
      .returning();
    return row!;
  },

  async markFailed(id: string, error: string) {
    const [row] = await db
      .update(notificationQueue)
      .set({ status: 'failed', lastError: error })
      .where(eq(notificationQueue.id, id))
      .returning();
    return row!;
  },

  async scheduleRetry(id: string, attempts: number, nextAttemptAt: Date, lastError: string) {
    const [row] = await db
      .update(notificationQueue)
      .set({
        status: 'pending',
        attempts,
        nextAttemptAt,
        lastError,
      })
      .where(eq(notificationQueue.id, id))
      .returning();
    return row!;
  },

  async incrementAttempts(id: string) {
    await db
      .update(notificationQueue)
      .set({ attempts: sql`${notificationQueue.attempts} + 1` })
      .where(eq(notificationQueue.id, id));
  },

  async stats(opts: { since?: Date } = {}) {
    const conds: SQL[] = [];
    if (opts.since) conds.push(gte(notificationQueue.createdAt, opts.since));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await db
      .select({
        status: notificationQueue.status,
        cnt: sql<number>`COUNT(*)::int`,
      })
      .from(notificationQueue)
      .where(where as any)
      .groupBy(notificationQueue.status);
    return rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = r.cnt;
      return acc;
    }, {});
  },
};

export const telegramMessageRepo = {
  async create(data: typeof telegramMessages.$inferInsert) {
    const [row] = await db.insert(telegramMessages).values(data).returning();
    return row!;
  },

  async listByLink(linkId: string, limit = 50) {
    return db
      .select()
      .from(telegramMessages)
      .where(eq(telegramMessages.telegramLinkId, linkId))
      .orderBy(sql`${telegramMessages.sentAt} DESC`)
      .limit(limit);
  },
};