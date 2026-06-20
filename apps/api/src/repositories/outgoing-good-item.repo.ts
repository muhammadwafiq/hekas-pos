/**
 * Outgoing goods item repository — per-item picking.
 */

import { eq } from 'drizzle-orm';
import { db, type DbOrTx} from '../config/database.js';
import { outgoingGoodItems } from '../db/schema/inventory.js';

export const outgoingItemRepo = {
  async listByOutgoing(outgoingGoodId: string) {
    return db.select().from(outgoingGoodItems).where(eq(outgoingGoodItems.outgoingGoodId, outgoingGoodId));
  },

  async bulkCreate(items: Array<typeof outgoingGoodItems.$inferInsert>, tx: DbOrTx = db) {
    if (items.length === 0) return [];
    return tx.insert(outgoingGoodItems).values(items).returning();
  },

  async update(id: string, data: Partial<typeof outgoingGoodItems.$inferInsert>, tx: DbOrTx = db) {
    const [row] = await tx.update(outgoingGoodItems).set(data).where(eq(outgoingGoodItems.id, id)).returning();
    return row;
  },
};