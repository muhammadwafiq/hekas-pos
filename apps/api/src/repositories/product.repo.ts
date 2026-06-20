/**
 * Product repository — data access for products.
 */

import { and, eq, like, or, sql, ilike, desc, asc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { products } from '../db/schema/master.js';

export const productRepo = {
  async findById(id: string) {
    const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return row || null;
  },

  async findByBarcode(barcode: string) {
    const [row] = await db.select().from(products).where(eq(products.barcode, barcode)).limit(1);
    return row || null;
  },

  async findBySku(sku: string) {
    const [row] = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
    return row || null;
  },

  async search(opts: { q?: string; outletId?: string; categoryId?: string; limit?: number; offset?: number }) {
    const conditions: any[] = [];
    if (opts.outletId) conditions.push(eq(products.outletId, opts.outletId));
    if (opts.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
    if (opts.q) {
      const q = `%${opts.q}%`;
      conditions.push(
        or(ilike(products.name, q), ilike(products.sku, q), ilike(products.barcode, q))!
      );
    }

    return db
      .select()
      .from(products)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(products.name))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
  },

  async list(opts: { outletId: string; categoryId?: string; limit?: number; offset?: number }) {
    const conditions: any[] = [eq(products.outletId, opts.outletId)];
    if (opts.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
    return db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(asc(products.name))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
  },

  async count(opts: { outletId: string; categoryId?: string; q?: string }) {
    const conditions: any[] = [eq(products.outletId, opts.outletId)];
    if (opts.categoryId) conditions.push(eq(products.categoryId, opts.categoryId));
    if (opts.q) {
      const q = `%${opts.q}%`;
      conditions.push(
        or(ilike(products.name, q), ilike(products.sku, q), ilike(products.barcode, q))!
      );
    }
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(and(...conditions));
    return row?.count ?? 0;
  },
};
