/**
 * Order repository — POS orders + items.
 */

import { and, eq, sql, desc, type SQL} from 'drizzle-orm';
import { db, type DbOrTx} from '../config/database.js';
import { orders, orderItems } from '../db/schema/pos.js';

export const orderRepo = {
  async create(order: typeof orders.$inferInsert, items: (typeof orderItems.$inferInsert)[], tx: DbOrTx = db) {
    const [row] = await tx.insert(orders).values(order).returning();
    if (items.length > 0) {
      await tx.insert(orderItems).values(items.map((i) => ({ ...i, orderId: row.id })));
    }
    return row;
  },

  async findById(id: string) {
    const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!row) return null;
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return { ...row, items };
  },

  async findByIdempotencyKey(key: string) {
    const [row] = await db.select().from(orders).where(eq(orders.idempotencyKey, key)).limit(1);
    if (!row) return null;
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, row.id));
    return { ...row, items };
  },

  async list(opts: { outletId?: string; cashierId?: string; shiftId?: string; status?: string; limit?: number; offset?: number }) {
    const conditions: SQL[] = [];
    if (opts.outletId) conditions.push(eq(orders.outletId, opts.outletId));
    if (opts.cashierId) conditions.push(eq(orders.cashierId, opts.cashierId));
    if (opts.shiftId) conditions.push(eq(orders.shiftId, opts.shiftId));
    if (opts.status) conditions.push(eq(orders.status, opts.status as any));
    return db
      .select()
      .from(orders)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
  },

  async updateStatus(id: string, status: 'completed' | 'voided' | 'refunded', extras: Partial<typeof orders.$inferInsert> = {}, tx: DbOrTx = db) {
    const [row] = await tx
      .update(orders)
      .set({ status, ...extras })
      .where(eq(orders.id, id))
      .returning();
    return row;
  },
};
