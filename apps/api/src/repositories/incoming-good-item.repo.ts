/**
 * Incoming goods item repository — line items per PO.
 */

import { eq } from 'drizzle-orm';
import { db, type DbOrTx} from '../config/database.js';
import { incomingGoodItems } from '../db/schema/inventory.js';

export const incomingItemRepo = {
  async listByIncoming(incomingGoodId: string) {
    return db.select().from(incomingGoodItems).where(eq(incomingGoodItems.incomingGoodId, incomingGoodId));
  },

  async bulkCreate(items: Array<typeof incomingGoodItems.$inferInsert>, tx: DbOrTx = db) {
    if (items.length === 0) return [];
    return tx.insert(incomingGoodItems).values(items).returning();
  },

  async deleteByIncoming(incomingGoodId: string, tx: DbOrTx = db) {
    return tx.delete(incomingGoodItems).where(eq(incomingGoodItems.incomingGoodId, incomingGoodId)).returning();
  },
};