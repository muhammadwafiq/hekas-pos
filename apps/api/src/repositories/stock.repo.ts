/**
 * Stock repository — current stock + movements.
 */

import { and, eq, sql, desc, inArray, type SQL} from 'drizzle-orm';
import { db, type DbOrTx} from '../config/database.js';
import { stocks, stockMovements } from '../db/schema/stock.js';
import { products } from '../db/schema/master.js';

export const stockRepo = {
  async getStock(productId: string, outletId: string) {
    const [row] = await db
      .select()
      .from(stocks)
      .where(and(eq(stocks.productId, productId), eq(stocks.outletId, outletId)))
      .limit(1);
    return row || null;
  },

  async getStockMany(productIds: string[], outletId: string) {
    if (productIds.length === 0) return [];
    return db
      .select()
      .from(stocks)
      .where(and(eq(stocks.outletId, outletId), inArray(stocks.productId, productIds)));
  },

  async listLowStock(outletId: string, threshold: number = 0) {
    return db
      .select({
        stock: stocks,
        product: products,
      })
      .from(stocks)
      .innerJoin(products, eq(stocks.productId, products.id))
      .where(and(eq(stocks.outletId, outletId), sql`${stocks.quantity} <= ${products.stockMin}`))
      .orderBy(asc(stocks.quantity));
  },

  async listMovements(opts: { productId?: string; outletId: string; limit?: number; offset?: number }) {
    const conditions: SQL[] = [eq(stockMovements.outletId, opts.outletId)];
    if (opts.productId) conditions.push(eq(stockMovements.productId, opts.productId));
    return db
      .select()
      .from(stockMovements)
      .where(and(...conditions))
      .orderBy(desc(stockMovements.createdAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
  },

  async createMovement(movement: typeof stockMovements.$inferInsert, tx: DbOrTx = db) {
    const [row] = await tx.insert(stockMovements).values(movement).returning();
    return row;
  },

  /** Atomic decrement with row lock — caller must be inside transaction */
  async decrementStock(productId: string, outletId: string, qty: number, tx: DbOrTx) {
    const [row] = await tx
      .update(stocks)
      .set({ quantity: sql`${stocks.quantity} - ${qty}`, updatedAt: new Date() })
      .where(and(eq(stocks.productId, productId), eq(stocks.outletId, outletId), sql`${stocks.quantity} >= ${qty}`))
      .returning();
    return row || null;
  },

  /** Atomic increment — caller must be inside transaction */
  async incrementStock(productId: string, outletId: string, qty: number, tx: DbOrTx) {
    const [row] = await tx
      .update(stocks)
      .set({ quantity: sql`${stocks.quantity} + ${qty}`, updatedAt: new Date() })
      .where(and(eq(stocks.productId, productId), eq(stocks.outletId, outletId)))
      .returning();
    return row || null;
  },
};

// Use sql's asc via drizzle
import { asc } from 'drizzle-orm';
