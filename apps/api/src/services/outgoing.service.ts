/**
 * Outgoing goods service — picking + delivery workflow.
 * Phase 3 Gate 2.
 *
 * Status: draft → picking → ready → sent
 * stock_movements.type = 'out_transfer' (negative qty) or 'out_adjustment'.
 */

import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { stocks, stockMovements, stockAdjustments } from '../db/schema/stock.js';
import { products } from '../db/schema/master.js';
import { outgoingGoods, outgoingGoodItems } from '../db/schema/inventory.js';
import { NotFoundError, ValidationError, BusinessRuleError } from '../lib/errors.js';
import type { AuthUser } from '../lib/auth-helper.js';

export const outgoingService = {
  async list(opts: { outletId: string; status?: string; limit?: number; offset?: number }) {
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const conds = [] as any[];
    if (opts.outletId) conds.push(eq(outgoingGoods.outletId, opts.outletId));
    if (opts.status) conds.push(eq(outgoingGoods.status, opts.status as any));
    return db
      .select()
      .from(outgoingGoods)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(outgoingGoods.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async getDetail(id: string) {
    const [og] = await db.select().from(outgoingGoods).where(eq(outgoingGoods.id, id)).limit(1);
    if (!og) throw new NotFoundError(`Outgoing good ${id} not found`);
    const items = await db.select().from(outgoingGoodItems).where(eq(outgoingGoodItems.outgoingGoodId, id));
    return { ...og, items };
  },

  /**
   * Create outgoing (picking list) — status='draft'.
   * Items: { productId, quantitySent }.
   */
  async create(opts: {
    outletId: string;
    destination: string;
    notes?: string;
    items: Array<{ productId: string; quantitySent: number }>;
    referenceType?: string;
    referenceId?: string;
    createdBy: string;
  }) {
    if (!opts.destination) throw new ValidationError('destination required');
    if (!opts.items?.length) throw new ValidationError('items required');

    return db.transaction(async (tx) => {
      const docNumber = await generateOutgoingDocNumber(tx, opts.outletId);
      const totalItems = opts.items.reduce((s, i) => s + i.quantitySent, 0);

      const [og] = await tx
        .insert(outgoingGoods)
        .values({
          outletId: opts.outletId,
          documentNumber: docNumber,
          destination: opts.destination,
          status: 'draft',
          totalItems,
          referenceType: opts.referenceType ?? null,
          referenceId: opts.referenceId ?? null,
          notes: opts.notes ?? null,
          createdBy: opts.createdBy,
        })
        .returning();

      // Product snapshots
      const productIds = opts.items.map((i) => i.productId);
      const prodRows = await tx.select().from(products).where(inArray(products.id, productIds));
      const prodMap = new Map(prodRows.map((p) => [p.id, p]));

      const itemRows = opts.items.map((item) => {
        const p = prodMap.get(item.productId);
        return {
          outgoingGoodId: og.id,
          productId: item.productId,
          productName: p?.name ?? '',
          productSku: p?.sku ?? '',
          quantitySent: item.quantitySent,
          quantityPicked: 0,
        };
      });
      const items = await tx.insert(outgoingGoodItems).values(itemRows).returning();

      logger.info({ ogId: og.id, docNumber, items: items.length }, 'Outgoing good created');
      return { ...og, items };
    });
  },

  /**
   * Pick items from warehouse — ATOMIC stock decrement.
   * Status: draft → picking → ready (auto when all items fully picked).
   */
  async pick(opts: {
    id: string;
    items: Array<{ id: string; quantityPicked: number }>;
    user: AuthUser;
  }) {
    if (!opts.items?.length) throw new ValidationError('items required');

    return db.transaction(async (tx) => {
      // Lock OG header
      const [og] = await tx
        .select()
        .from(outgoingGoods)
        .where(eq(outgoingGoods.id, opts.id))
        .for('update')
        .limit(1);
      if (!og) throw new NotFoundError(`Outgoing good ${opts.id} not found`);
      if (!['draft', 'picking'].includes(og.status)) {
        throw new BusinessRuleError(`Cannot pick outgoing with status ${og.status}`);
      }

      // Lock all items
      const itemIds = opts.items.map((i) => i.id);
      const items = await tx
        .select()
        .from(outgoingGoodItems)
        .where(
          and(eq(outgoingGoodItems.outgoingGoodId, og.id), inArray(outgoingGoodItems.id, itemIds))
        )
        .for('update');
      const itemMap = new Map(items.map((i) => [i.id, i]));

      // Lock stocks
      const productIds = Array.from(new Set(items.map((i) => i.productId)));
      const stockRows = await tx
        .select()
        .from(stocks)
        .where(and(eq(stocks.outletId, og.outletId), inArray(stocks.productId, productIds)))
        .for('update');
      const stockMap = new Map(stockRows.map((s) => [s.productId, s]));

      const movements = [];
      const adjustments = [];
      for (const picked of opts.items) {
        const item = itemMap.get(picked.id);
        if (!item) throw new NotFoundError(`Item ${picked.id} not found in outgoing`);
        if (picked.quantityPicked < 0) throw new ValidationError('quantityPicked must be >= 0');

        // Update item.quantityPicked
        const newPicked = (item.quantityPicked ?? 0) + picked.quantityPicked;
        if (newPicked > item.quantitySent) {
          throw new BusinessRuleError(`Cannot pick more than sent for item ${item.productSku}`);
        }
        await tx
          .update(outgoingGoodItems)
          .set({ quantityPicked: newPicked })
          .where(eq(outgoingGoodItems.id, item.id));

        if (picked.quantityPicked === 0) continue;

        const stock = stockMap.get(item.productId);
        const prevQty = stock?.quantity ?? 0;
        const newQty = prevQty - picked.quantityPicked;
        if (newQty < 0) {
          throw new BusinessRuleError(
            `Insufficient stock for ${item.productSku}: have ${prevQty}, need ${picked.quantityPicked}`
          );
        }

        if (stock) {
          await tx
            .update(stocks)
            .set({ quantity: newQty, updatedAt: new Date() })
            .where(and(eq(stocks.productId, item.productId), eq(stocks.outletId, og.outletId)));
        }

        movements.push({
          productId: item.productId,
          outletId: og.outletId,
          type: 'out_transfer' as const,
          quantity: -picked.quantityPicked, // negative for out
          referenceType: 'outgoing_good',
          referenceId: og.id,
          notes: `Outgoing ${og.documentNumber} picked`,
          createdBy: opts.user.id,
        });

        adjustments.push({
          productId: item.productId,
          outletId: og.outletId,
          oldQuantity: prevQty,
          newQuantity: newQty,
          difference: -picked.quantityPicked,
          reason: `Outgoing ${og.documentNumber}`,
          adjustedBy: opts.user.id,
        });
      }

      if (movements.length) {
        await tx.insert(stockMovements).values(movements);
        await tx.insert(stockAdjustments).values(adjustments);
      }

      // Determine next status
      const updatedItems = await tx
        .select()
        .from(outgoingGoodItems)
        .where(eq(outgoingGoodItems.outgoingGoodId, og.id));
      const allFullyPicked = updatedItems.every((i) => (i.quantityPicked ?? 0) >= i.quantitySent);
      const nextStatus = allFullyPicked ? 'ready' : 'picking';

      const [updated] = await tx
        .update(outgoingGoods)
        .set({ status: nextStatus as any })
        .where(eq(outgoingGoods.id, og.id))
        .returning();

      logger.info(
        { ogId: og.id, picked: opts.items.length, nextStatus },
        'Items picked'
      );
      return { ...updated, items: updatedItems };
    });
  },

  /** Mark as sent — status: ready → sent. */
  async markSent(id: string) {
    return db.transaction(async (tx) => {
      const [og] = await tx
        .select()
        .from(outgoingGoods)
        .where(eq(outgoingGoods.id, id))
        .for('update')
        .limit(1);
      if (!og) throw new NotFoundError(`Outgoing good ${id} not found`);
      if (og.status !== 'ready') {
        throw new BusinessRuleError(`Cannot mark sent: status is ${og.status}`);
      }
      const [updated] = await tx
        .update(outgoingGoods)
        .set({ status: 'sent', sentAt: new Date() })
        .where(eq(outgoingGoods.id, id))
        .returning();
      logger.info({ ogId: og.id }, 'Outgoing marked sent');
      return updated;
    });
  },

  /** Cancel — status: any → cancelled. Stock restored if already picked. */
  async cancel(id: string, reason: string) {
    if (!reason) throw new ValidationError('reason required');
    return db.transaction(async (tx) => {
      const [og] = await tx
        .select()
        .from(outgoingGoods)
        .where(eq(outgoingGoods.id, id))
        .for('update')
        .limit(1);
      if (!og) throw new NotFoundError(`Outgoing good ${id} not found`);
      if (['sent', 'cancelled'].includes(og.status)) {
        throw new BusinessRuleError(`Cannot cancel outgoing with status ${og.status}`);
      }

      // Restore stock if items were picked
      const items = await tx
        .select()
        .from(outgoingGoodItems)
        .where(eq(outgoingGoodItems.outgoingGoodId, id));
      const toRestore = items.filter((i) => (i.quantityPicked ?? 0) > 0);
      if (toRestore.length) {
        const productIds = Array.from(new Set(toRestore.map((i) => i.productId)));
        const stockRows = await tx
          .select()
          .from(stocks)
          .where(and(eq(stocks.outletId, og.outletId), inArray(stocks.productId, productIds)))
          .for('update');
        const stockMap = new Map(stockRows.map((s) => [s.productId, s]));

        const movements = [];
        const adjustments = [];
        for (const item of toRestore) {
          const stock = stockMap.get(item.productId);
          if (!stock) continue;
          const newQty = stock.quantity + (item.quantityPicked ?? 0);
          await tx
            .update(stocks)
            .set({ quantity: newQty, updatedAt: new Date() })
            .where(and(eq(stocks.productId, item.productId), eq(stocks.outletId, og.outletId)));

          movements.push({
            productId: item.productId,
            outletId: og.outletId,
            type: 'in_adjustment' as const,
            quantity: item.quantityPicked ?? 0,
            referenceType: 'outgoing_cancel',
            referenceId: og.id,
            notes: `Restored from cancel of ${og.documentNumber}`,
            createdBy: og.createdBy,
          });
          adjustments.push({
            productId: item.productId,
            outletId: og.outletId,
            oldQuantity: stock.quantity,
            newQuantity: newQty,
            difference: item.quantityPicked ?? 0,
            reason: `Cancel ${og.documentNumber}: ${reason}`,
            adjustedBy: og.createdBy,
          });
        }
        if (movements.length) {
          await tx.insert(stockMovements).values(movements);
          await tx.insert(stockAdjustments).values(adjustments);
        }
      }

      const [updated] = await tx
        .update(outgoingGoods)
        .set({ status: 'cancelled', notes: `${og.notes ?? ''}\nCancelled: ${reason}`.trim() })
        .where(eq(outgoingGoods.id, id))
        .returning();

      logger.info({ ogId: og.id, reason }, 'Outgoing cancelled');
      return updated;
    });
  },
};

async function generateOutgoingDocNumber(tx: any, outletId: string): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `OG-${dateStr}-`;
  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(outgoingGoods)
    .where(sql`${outgoingGoods.documentNumber} LIKE ${prefix + '%'}`);
  return `${prefix}${String((count ?? 0) + 1).padStart(3, '0')}`;
}