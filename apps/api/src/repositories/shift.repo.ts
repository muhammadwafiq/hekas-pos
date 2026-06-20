/**
 * Shift repository — cashier shifts.
 */

import { and, eq, desc, isNull } from 'drizzle-orm';
import { db } from '../config/database.js';
import { shifts } from '../db/schema/shift.js';

export const shiftRepo = {
  async create(shift: typeof shifts.$inferInsert, tx: any = db) {
    const [row] = await tx.insert(shifts).values(shift).returning();
    return row;
  },

  async findById(id: string) {
    const [row] = await db.select().from(shifts).where(eq(shifts.id, id)).limit(1);
    return row || null;
  },

  async findActive(cashierId: string) {
    const [row] = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.cashierId, cashierId), eq(shifts.status, 'aktif')))
      .limit(1);
    return row || null;
  },

  async findActiveByOutlet(outletId: string) {
    return db
      .select()
      .from(shifts)
      .where(and(eq(shifts.outletId, outletId), eq(shifts.status, 'aktif')))
      .orderBy(desc(shifts.startedAt));
  },

  async endShift(id: string, data: { endingCash: number; expectedCash: number; cashDifference: number; totalTransactions: number; totalSales: number; status: 'selesai' | 'ditutup_paksa'; notes?: string }, tx: any = db) {
    const [row] = await tx
      .update(shifts)
      .set({
        ...data,
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shifts.id, id))
      .returning();
    return row;
  },

  async list(opts: { outletId?: string; cashierId?: string; status?: string; limit?: number; offset?: number }) {
    const conditions: any[] = [];
    if (opts.outletId) conditions.push(eq(shifts.outletId, opts.outletId));
    if (opts.cashierId) conditions.push(eq(shifts.cashierId, opts.cashierId));
    if (opts.status) conditions.push(eq(shifts.status, opts.status as any));
    return db
      .select()
      .from(shifts)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(shifts.startedAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
  },
};
