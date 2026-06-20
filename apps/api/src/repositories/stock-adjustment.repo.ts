/**
 * Stock adjustment repository — manual adjustments / restocks.
 * Phase 3 Gate 2.
 */

import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { stockAdjustments } from '../db/schema/stock.js';
import { NotFoundError } from '../lib/errors.js';

export const stockAdjustmentRepo = {
  async create(data: typeof stockAdjustments.$inferInsert) {
    const [row] = await db.insert(stockAdjustments).values(data).returning();
    return row!;
  },

  async listByProduct(productId: string, limit = 50, offset = 0) {
    return db
      .select()
      .from(stockAdjustments)
      .where(eq(stockAdjustments.productId, productId))
      .orderBy(desc(stockAdjustments.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async listByOutlet(outletId: string, limit = 50, offset = 0) {
    return db
      .select()
      .from(stockAdjustments)
      .where(eq(stockAdjustments.outletId, outletId))
      .orderBy(desc(stockAdjustments.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async getById(id: string) {
    const [row] = await db
      .select()
      .from(stockAdjustments)
      .where(eq(stockAdjustments.id, id))
      .limit(1);
    if (!row) throw new NotFoundError(`Stock adjustment ${id} not found`);
    return row;
  },
};