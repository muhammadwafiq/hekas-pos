/**
 * Product image repository — CRUD for product images (1 product = N images).
 * Phase 3 Gate 2.
 */

import { eq, and, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { productImages } from '../db/schema/master.js';
import { NotFoundError } from '../lib/errors.js';

export const productImageRepo = {
  async listByProduct(productId: string) {
    return db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.sortOrder);
  },

  async getById(id: string) {
    const [row] = await db
      .select()
      .from(productImages)
      .where(eq(productImages.id, id))
      .limit(1);
    if (!row) throw new NotFoundError(`Product image ${id} not found`);
    return row;
  },

  async create(data: typeof productImages.$inferInsert) {
    const [row] = await db.insert(productImages).values(data).returning();
    return row!;
  },

  async update(id: string, data: Partial<typeof productImages.$inferInsert>) {
    const [row] = await db
      .update(productImages)
      .set(data)
      .where(eq(productImages.id, id))
      .returning();
    if (!row) throw new NotFoundError(`Product image ${id} not found`);
    return row;
  },

  async delete(id: string) {
    const [row] = await db
      .delete(productImages)
      .where(eq(productImages.id, id))
      .returning();
    if (!row) throw new NotFoundError(`Product image ${id} not found`);
    return row;
  },

  async setPrimary(productId: string, imageId: string) {
    // TODO: isPrimary column missing in product_images schema — add via db:push
    // Unset previous primary
    await db
      .update(productImages)
      .set({ isPrimary: false } as any)
      .where(eq(productImages.productId, productId));
    // Set new primary
    const [row] = await db
      .update(productImages)
      .set({ isPrimary: true } as any)
      .where(eq(productImages.id, imageId))
      .returning();
    if (!row) throw new NotFoundError(`Product image ${imageId} not found`);
    return row;
  },
};