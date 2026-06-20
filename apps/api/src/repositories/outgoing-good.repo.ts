/**
 * Outgoing goods repository — Surat Jalan / picking list headers.
 * Phase 3 Gate 2 (delivery outgoing flow).
 *
 * Status: draft → picking → siap_kirim → terkirim
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { outgoingGoods } from '../db/schema/inventory.js';
import { NotFoundError } from '../lib/errors.js';

export const outgoingRepo = {
  async list(opts: {
    outletId: string;
    status?: 'draft' | 'picking' | 'siap_kirim' | 'terkirim';
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    const conditions: any[] = [eq(outgoingGoods.outletId, opts.outletId)];
    if (opts.status) conditions.push(eq(outgoingGoods.status, opts.status));
    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      db.select().from(outgoingGoods).where(where).orderBy(desc(outgoingGoods.createdAt)).limit(limit).offset(offset),
      db.select({ total: sql<number>`COUNT(*)::int` }).from(outgoingGoods).where(where),
    ]);
    return { items, total, limit, offset };
  },

  async getById(id: string) {
    const [row] = await db.select().from(outgoingGoods).where(eq(outgoingGoods.id, id)).limit(1);
    if (!row) throw new NotFoundError(`Outgoing goods ${id} not found`);
    return row;
  },

  async create(data: typeof outgoingGoods.$inferInsert, tx: any = db) {
    const [row] = await tx.insert(outgoingGoods).values(data).returning();
    return row!;
  },

  async update(id: string, data: Partial<typeof outgoingGoods.$inferInsert>, tx: any = db) {
    const [row] = await tx.update(outgoingGoods).set({ ...data, updatedAt: new Date() }).where(eq(outgoingGoods.id, id)).returning();
    if (!row) throw new NotFoundError(`Outgoing goods ${id} not found`);
    return row;
  },
};