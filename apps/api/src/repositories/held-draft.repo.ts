/**
 * Held-draft repository — saved incomplete orders (held at POS).
 */

import { and, eq, desc, type SQL} from 'drizzle-orm';
import { db, type DbOrTx} from '../config/database.js';
import { heldDrafts } from '../db/schema/pos.js';

export const heldDraftRepo = {
  async create(draft: typeof heldDrafts.$inferInsert, tx: DbOrTx = db) {
    const [row] = await tx.insert(heldDrafts).values(draft).returning();
    return row;
  },

  async findById(id: string) {
    const [row] = await db.select().from(heldDrafts).where(eq(heldDrafts.id, id)).limit(1);
    return row || null;
  },

  async list(opts: { outletId?: string; cashierId?: string; limit?: number; offset?: number }) {
    const conditions: SQL[] = [];
    if (opts.outletId) conditions.push(eq(heldDrafts.outletId, opts.outletId));
    if (opts.cashierId) conditions.push(eq(heldDrafts.cashierId, opts.cashierId));
    return db
      .select()
      .from(heldDrafts)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(heldDrafts.createdAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
  },

  async delete(id: string, tx: DbOrTx = db) {
    await tx.delete(heldDrafts).where(eq(heldDrafts.id, id));
  },
};
