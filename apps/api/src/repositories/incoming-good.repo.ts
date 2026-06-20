/**
 * Incoming goods repository (Purchase Orders) — Phase 3 Gate 2.
 * PO header CRUD + status transitions.
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { incomingGoods } from '../db/schema/inventory.js';
import { NotFoundError } from '../lib/errors.js';

export const incomingRepo = {
  async list(opts: {
    outletId: string;
    status?: 'draft' | 'menunggu_verifikasi' | 'diverifikasi' | 'ditolak';
    supplierId?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    const conditions: any[] = [eq(incomingGoods.outletId, opts.outletId)];
    if (opts.status) conditions.push(eq(incomingGoods.status, opts.status));
    if (opts.supplierId) conditions.push(eq(incomingGoods.supplierId, opts.supplierId));
    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      db.select().from(incomingGoods).where(where).orderBy(desc(incomingGoods.createdAt)).limit(limit).offset(offset),
      db.select({ total: sql<number>`COUNT(*)::int` }).from(incomingGoods).where(where),
    ]);
    return { items, total, limit, offset };
  },

  async getById(id: string) {
    const [row] = await db.select().from(incomingGoods).where(eq(incomingGoods.id, id)).limit(1);
    if (!row) throw new NotFoundError(`Incoming goods ${id} not found`);
    return row;
  },

  async create(data: typeof incomingGoods.$inferInsert, tx: any = db) {
    const [row] = await tx.insert(incomingGoods).values(data).returning();
    return row!;
  },

  async update(id: string, data: Partial<typeof incomingGoods.$inferInsert>, tx: any = db) {
    const [row] = await tx.update(incomingGoods).set({ ...data, updatedAt: new Date() }).where(eq(incomingGoods.id, id)).returning();
    if (!row) throw new NotFoundError(`Incoming goods ${id} not found`);
    return row;
  },
};