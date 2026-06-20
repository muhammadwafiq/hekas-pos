/**
 * Stock service — read + admin operations (Phase 3 Gate 2).
 *
 * NOTE: stockAdjustments schema uses `oldQuantity/newQuantity/difference`
 * (NO adjustmentType, NO quantityBefore/Change/After, NO notes).
 * stockMovements uses `type` enum: in_purchase, in_adjustment, out_sale, etc.
 * quantity is signed (positive=in, negative=out).
 */

import { eq, and, sql, desc, inArray, lte, gte } from 'drizzle-orm';
import { db } from '../config/database.js';
import { stocks, stockMovements, stockAdjustments } from '../db/schema/stock.js';
import { products } from '../db/schema/master.js';
import { NotFoundError, ValidationError, BusinessRuleError } from '../lib/errors.js';
import { logger } from '../config/logger.js';
import type { AuthUser } from '../lib/auth-helper.js';

export const stockService = {
  // ===== Phase 2 read functions (preserved) =====

  async getStock(productId: string, outletId: string) {
    const [stock] = await db
      .select()
      .from(stocks)
      .where(and(eq(stocks.productId, productId), eq(stocks.outletId, outletId)))
      .limit(1);
    if (!stock) return { productId, outletId, quantity: 0 };
    return stock;
  },

  async getLowStock(outletId: string) {
    return db
      .select({
        productId: products.id,
        name: products.name,
        sku: products.sku,
        stockMin: products.stockMin,
        quantity: stocks.quantity,
        unit: products.unit,
      })
      .from(stocks)
      .innerJoin(products, eq(products.id, stocks.productId))
      .where(
        and(
          eq(stocks.outletId, outletId),
          sql`${stocks.quantity} <= ${products.stockMin}`
        )
      )
      .limit(50);
  },

  async getMovements(opts: { productId?: string; outletId?: string; limit?: number; offset?: number }) {
    return this.listMovements(opts);
  },

  async listMovements(opts: { productId?: string; outletId?: string; limit?: number; offset?: number }) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const conds = [] as any[];
    if (opts.productId) conds.push(eq(stockMovements.productId, opts.productId));
    if (opts.outletId) conds.push(eq(stockMovements.outletId, opts.outletId));

    return db
      .select()
      .from(stockMovements)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit)
      .offset(offset);
  },

  // ===== Phase 3 write functions =====

  /**
   * Restock single product — atomic (lock product, insert movement + adjustment).
   * Updates stock.quantity = stock.quantity + qty.
   */
  async restock(opts: {
    productId: string;
    outletId: string;
    quantity: number;
    notes?: string;
    user: AuthUser;
  }) {
    if (opts.quantity <= 0) throw new ValidationError('quantity must be > 0');

    return db.transaction(async (tx) => {
      // Lock stock row
      const [stock] = await tx
        .select()
        .from(stocks)
        .where(and(eq(stocks.productId, opts.productId), eq(stocks.outletId, opts.outletId)))
        .for('update')
        .limit(1);

      if (!stock) {
        // Auto-create stock row
        await tx.insert(stocks).values({ productId: opts.productId, outletId: opts.outletId, quantity: 0 });
      }

      const prevQty = stock?.quantity ?? 0;
      const newQty = prevQty + opts.quantity;

      // Update stock
      await tx
        .update(stocks)
        .set({ quantity: newQty, updatedAt: new Date() })
        .where(and(eq(stocks.productId, opts.productId), eq(stocks.outletId, opts.outletId)));

      // Insert movement (positive quantity = in)
      await tx.insert(stockMovements).values({
        productId: opts.productId,
        outletId: opts.outletId,
        type: 'in_purchase',
        quantity: opts.quantity,
        referenceType: 'manual_restock',
        referenceId: null,
        notes: opts.notes ?? null,
        createdBy: opts.user.id,
      });

      // Insert adjustment audit
      await tx.insert(stockAdjustments).values({
        productId: opts.productId,
        outletId: opts.outletId,
        oldQuantity: prevQty,
        newQuantity: newQty,
        difference: opts.quantity,
        reason: opts.notes ?? 'manual_restock',
        adjustedBy: opts.user.id,
      });

      return { productId: opts.productId, oldQuantity: prevQty, newQuantity: newQty, adjusted: opts.quantity };
    });
  },

  /**
   * Bulk restock — for multiple products at once.
   */
  async restockBulk(opts: {
    outletId: string;
    items: Array<{ productId: string; quantity: number; unitCost?: string; notes?: string }>;
    notes?: string;
    user: AuthUser;
  }) {
    if (!Array.isArray(opts.items) || opts.items.length === 0) {
      throw new ValidationError('items required');
    }

    return db.transaction(async (tx) => {
      const results = [];
      for (const item of opts.items) {
        if (item.quantity <= 0) continue;

        const [stock] = await tx
          .select()
          .from(stocks)
          .where(and(eq(stocks.productId, item.productId), eq(stocks.outletId, opts.outletId)))
          .for('update')
          .limit(1);

        const prevQty = stock?.quantity ?? 0;
        const newQty = prevQty + item.quantity;

        if (stock) {
          await tx
            .update(stocks)
            .set({ quantity: newQty, updatedAt: new Date() })
            .where(and(eq(stocks.productId, item.productId), eq(stocks.outletId, opts.outletId)));
        } else {
          await tx.insert(stocks).values({
            productId: item.productId,
            outletId: opts.outletId,
            quantity: newQty,
          });
        }

        await tx.insert(stockMovements).values({
          productId: item.productId,
          outletId: opts.outletId,
          type: 'in_purchase',
          quantity: item.quantity,
          referenceType: 'bulk_restock',
          referenceId: null,
          notes: opts.notes ?? item.notes ?? null,
          createdBy: opts.user.id,
        });

        await tx.insert(stockAdjustments).values({
          productId: item.productId,
          outletId: opts.outletId,
          oldQuantity: prevQty,
          newQuantity: newQty,
          difference: item.quantity,
          reason: opts.notes ?? 'bulk_restock',
          adjustedBy: opts.user.id,
        });

        results.push({ productId: item.productId, oldQuantity: prevQty, newQuantity: newQty, adjusted: item.quantity });
      }
      return results;
    });
  },

  /**
   * Manual adjustment — admin corrects stock count.
   * opts.type: 'tambah' (+) | 'kurang' (-)
   */
  async adjust(opts: {
    productId: string;
    outletId: string;
    type: 'tambah' | 'kurang';
    quantity: number;
    reason: string;
    notes?: string;
    user: AuthUser;
  }) {
    if (opts.quantity <= 0) throw new ValidationError('quantity must be > 0');
    if (!opts.reason) throw new ValidationError('reason required');
    if (opts.type !== 'tambah' && opts.type !== 'kurang') {
      throw new ValidationError(`type must be 'tambah' or 'kurang', got '${opts.type}'`);
    }

    const qtyChange = opts.type === 'tambah' ? opts.quantity : -opts.quantity;

    return db.transaction(async (tx) => {
      const [stock] = await tx
        .select()
        .from(stocks)
        .where(and(eq(stocks.productId, opts.productId), eq(stocks.outletId, opts.outletId)))
        .for('update')
        .limit(1);

      const prevQty = stock?.quantity ?? 0;
      const newQty = prevQty + qtyChange;
      if (newQty < 0) throw new BusinessRuleError('Stock cannot go negative');

      if (stock) {
        await tx
          .update(stocks)
          .set({ quantity: newQty, updatedAt: new Date() })
          .where(and(eq(stocks.productId, opts.productId), eq(stocks.outletId, opts.outletId)));
      } else {
        await tx.insert(stocks).values({ productId: opts.productId, outletId: opts.outletId, quantity: newQty });
      }

      await tx.insert(stockMovements).values({
        productId: opts.productId,
        outletId: opts.outletId,
        type: qtyChange > 0 ? 'in_adjustment' : 'out_adjustment',
        quantity: qtyChange,
        referenceType: 'manual_adjustment',
        referenceId: null,
        notes: opts.notes ?? opts.reason,
        createdBy: opts.user.id,
      });

      await tx.insert(stockAdjustments).values({
        productId: opts.productId,
        outletId: opts.outletId,
        oldQuantity: prevQty,
        newQuantity: newQty,
        difference: qtyChange,
        reason: opts.reason,
        adjustedBy: opts.user.id,
      });

      return { productId: opts.productId, oldQuantity: prevQty, newQuantity: newQty, adjusted: qtyChange };
    });
  },
};