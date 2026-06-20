/**
 * Outgoing goods item repository — per-item picking.
 */

import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { outgoingGoodItems } from '../db/schema/inventory.js';

export const outgoingItemRepo = {
  async listByOutgoing(outgoingGoodId: string) {
    return db.select().from(outgoingGoodItems).where(eq(outgoingGoodItems.outgoingGoodId, outgoingGoodId));
  },

  async bulkCreate(items: Array<typeof outgoingGoodItems.$inferInsert>, tx: any = db) {
    if (items.length === 0) return [];
    return tx.insert(outgoingGoodItems).values(items).returning();
  },

  async update(id: string, data: Partial<typeof outgoingGoodItems.$inferInsert>, tx: any = db) {
    const [row] = await tx.update(outgoingGoodItems).set(data).where(eq(outgoingGoodItems.id, id)).returning();
    return row;
  },
};