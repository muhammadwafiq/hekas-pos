/**
 * Incoming goods service — Purchase Order (PO) workflow.
 * Phase 3 Gate 2.
 *
 * Status: pending → (verified | rejected)
 * stock_movements.type = 'in_purchase' (signed positive qty).
 * stock_adjustments uses oldQuantity/newQuantity/difference.
 */

import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { stocks, stockMovements, stockAdjustments } from '../db/schema/stock.js';
import { products } from '../db/schema/master.js';
import { incomingGoods, incomingGoodItems } from '../db/schema/inventory.js';
import { NotFoundError, ValidationError, BusinessRuleError } from '../lib/errors.js';
import type { AuthUser } from '../lib/auth-helper.js';

export const incomingService = {
  async list(opts: { outletId: string; supplierId?: string; status?: string; limit?: number; offset?: number }) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const conds = [] as any[];
    if (opts.outletId) conds.push(eq(incomingGoods.outletId, opts.outletId));
    if (opts.supplierId) conds.push(eq(incomingGoods.supplierId, opts.supplierId));
    if (opts.status) conds.push(eq(incomingGoods.status, opts.status as any));
    return db
      .select()
      .from(incomingGoods)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(incomingGoods.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async getDetail(id: string) {
    const [po] = await db.select().from(incomingGoods).where(eq(incomingGoods.id, id)).limit(1);
    if (!po) throw new NotFoundError(`PO ${id} not found`);
    const items = await db.select().from(incomingGoodItems).where(eq(incomingGoodItems.incomingGoodId, id));
    return { ...po, items };
  },

  /**
   * Create PO with items.
   * Generates documentNumber like "PO-20260620-001".
   * Status = 'pending' (not draft — schema has only pending|verified|rejected).
   */
  async create(opts: {
    outletId: string;
    supplierId: string;
    notes?: string;
    items: Array<{ productId: string; quantity: number; purchasePrice: string }>;
    user: AuthUser;
  }) {
    if (!opts.items?.length) throw new ValidationError('items required');

    return db.transaction(async (tx) => {
      const docNumber = await generateDocumentNumber(tx, opts.outletId);
      const totalItems = opts.items.reduce((sum, i) => sum + i.quantity, 0);

      const [po] = await tx
        .insert(incomingGoods)
        .values({
          outletId: opts.outletId,
          supplierId: opts.supplierId,
          supplierName: opts.supplierId,
          documentNumber: docNumber,
          status: 'pending',
          totalItems,
          notes: opts.notes ?? null,
          createdBy: opts.user.id,
        })
        .returning();

      // Lookup product names + sku snapshots
      const productIds = opts.items.map((i) => i.productId);
      const prodRows = await tx.select().from(products).where(inArray(products.id, productIds));
      const prodMap = new Map(prodRows.map((p) => [p.id, p]));

      const itemRows = opts.items.map((item) => {
        const p = prodMap.get(item.productId);
        return {
          incomingGoodId: po.id,
          productId: item.productId,
          productName: p?.name ?? '',
          productSku: p?.sku ?? '',
          quantity: item.quantity,
          purchasePrice: item.purchasePrice,
          subtotal: (Number(item.purchasePrice) * item.quantity).toFixed(2),
        };
      });
      const items = await tx.insert(incomingGoodItems).values(itemRows).returning();

      logger.info({ poId: po.id, docNumber, items: items.length }, 'PO created');
      return { ...po, items };
    });
  },

  /**
   * Verify PO — ATOMIC stock increment.
   * Status pending → verified.
   * Creates stock_movement(type='in_purchase') + stock_adjustment per item.
   */
  async verify(opts: {
    id: string;
    items: Array<{ id: string; quantityReceived: number }>;
    user: AuthUser;
  }) {
    if (!opts.items?.length) throw new ValidationError('items required');

    return db.transaction(async (tx) => {
      // Lock PO
      const [po] = await tx
        .select()
        .from(incomingGoods)
        .where(eq(incomingGoods.id, opts.id))
        .for('update')
        .limit(1);
      if (!po) throw new NotFoundError(`PO ${opts.id} not found`);
      if (po.status !== 'pending') {
        throw new BusinessRuleError(`Cannot verify PO with status ${po.status}`);
      }

      // Lock stocks for all items at once
      const itemIds = opts.items.map((i) => i.id);
      const itemRows = await tx
        .select()
        .from(incomingGoodItems)
        .where(
          and(eq(incomingGoodItems.incomingGoodId, po.id), inArray(incomingGoodItems.id, itemIds))
        )
        .for('update');
      const itemMap = new Map(itemRows.map((i) => [i.id, i]));

      // Lock stocks
      const productIds = Array.from(new Set(itemRows.map((i) => i.productId)));
      const [stockRows, productRows] = await Promise.all([
        tx
          .select()
          .from(stocks)
          .where(and(eq(stocks.outletId, po.outletId), inArray(stocks.productId, productIds)))
          .for('update'),
        tx.select().from(products).where(inArray(products.id, productIds)),
      ]);
      const stockMap = new Map(stockRows.map((s) => [s.productId, s]));
      const productMap = new Map(productRows.map((p) => [p.id, p]));

      const movements = [];
      const adjustments = [];
      for (const received of opts.items) {
        const item = itemMap.get(received.id);
        if (!item) throw new NotFoundError(`PO item ${received.id} not found`);
        if (received.quantityReceived < 0) {
          throw new ValidationError(`quantityReceived must be >= 0 for item ${received.id}`);
        }
        if (received.quantityReceived === 0) continue;

        const prevStock = stockMap.get(item.productId);
        const prevQty = prevStock?.quantity ?? 0;
        const newQty = prevQty + received.quantityReceived;

        // Update stock
        if (prevStock) {
          await tx
            .update(stocks)
            .set({ quantity: newQty, updatedAt: new Date() })
            .where(and(eq(stocks.productId, item.productId), eq(stocks.outletId, po.outletId)));
        } else {
          await tx.insert(stocks).values({
            productId: item.productId,
            outletId: po.outletId,
            quantity: newQty,
          });
        }

        movements.push({
          productId: item.productId,
          outletId: po.outletId,
          type: 'in_purchase' as const,
          quantity: received.quantityReceived,
          referenceType: 'incoming_good',
          referenceId: po.id,
          notes: `PO ${po.documentNumber} verified`,
          createdBy: opts.user.id,
        });

        adjustments.push({
          productId: item.productId,
          outletId: po.outletId,
          oldQuantity: prevQty,
          newQuantity: newQty,
          difference: received.quantityReceived,
          reason: `PO ${po.documentNumber}`,
          adjustedBy: opts.user.id,
        });
      }

      if (movements.length) {
        await tx.insert(stockMovements).values(movements);
        await tx.insert(stockAdjustments).values(adjustments);
      }

      // Update PO status
      const verifiedAt = new Date();
      const [updated] = await tx
        .update(incomingGoods)
        .set({
          status: 'verified',
          verifiedBy: opts.user.id,
          verifiedAt,
          receivedDate: verifiedAt,
        })
        .where(eq(incomingGoods.id, po.id))
        .returning();

      logger.info({ poId: po.id, itemsVerified: movements.length }, 'PO verified atomically');
      return { ...updated, items: itemRows };
    });
  },

  /**
   * Reject PO — status pending → rejected.
   * No stock changes.
   */
  async reject(opts: { id: string; reason: string; user: AuthUser }) {
    if (!opts.reason) throw new ValidationError('reason required');

    return db.transaction(async (tx) => {
      const [po] = await tx
        .select()
        .from(incomingGoods)
        .where(eq(incomingGoods.id, opts.id))
        .for('update')
        .limit(1);
      if (!po) throw new NotFoundError(`PO ${opts.id} not found`);
      if (po.status !== 'pending') {
        throw new BusinessRuleError(`Cannot reject PO with status ${po.status}`);
      }

      const [updated] = await tx
        .update(incomingGoods)
        .set({
          status: 'rejected',
          rejectedBy: opts.user.id,
          rejectedAt: new Date(),
          rejectReason: opts.reason,
        })
        .where(eq(incomingGoods.id, po.id))
        .returning();

      logger.info({ poId: po.id, reason: opts.reason }, 'PO rejected');
      return updated;
    });
  },
};

// ===== HELPERS =====

async function generateDocumentNumber(
  tx: any,
  outletId: string
): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `PO-${dateStr}-`;

  // Count today's POs (race-condition tolerant: just generate sequential, accept gap if collision)
  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(incomingGoods)
    .where(sql`${incomingGoods.documentNumber} LIKE ${prefix + '%'}`);

  return `${prefix}${String((count ?? 0) + 1).padStart(3, '0')}`;
}