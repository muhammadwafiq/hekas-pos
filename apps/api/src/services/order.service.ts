/**
 * Order service — POS transaction core.
 *
 * CRITICAL: Complete-order is an atomic transaction. Either ALL steps succeed
 * (stock decrement + order insert + items insert + payment insert + shift counter
 * + audit log) or NONE happen.
 *
 * Flow:
 *   1. Idempotency check (return cached if key already used)
 *   2. Open transaction
 *   3. Validate shift is active
 *   4. Lock + validate stocks (FOR UPDATE)
 *   5. Decrement stocks
 *   6. Insert order header
 *   7. Insert order items (with product name snapshot)
 *   8. Insert payment(s)
 *   9. Update shift counter (total_sales, total_transactions)
 *   10. Insert audit log
 *   11. Commit
 *
 * Void is also atomic: restore stock + update order status + audit log.
 */

import { eq, sql, and, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  orders,
  orderItems,
  payments,
} from '../db/schema/pos.js';
import { products } from '../db/schema/master.js';
import { stocks, stockMovements } from '../db/schema/stock.js';
import { shifts } from '../db/schema/shift.js';
import { auditLogs } from '../db/schema/system.js';
import { orderRepo } from '../repositories/order.repo.js';
import { stockRepo } from '../repositories/stock.repo.js';
import { shiftRepo } from '../repositories/shift.repo.js';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../lib/errors.js';
import { logger } from '../config/logger.js';

// ====== TYPES ======

export interface OrderItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number;       // optional, default = product selling price
  discount?: number;        // default 0
  notes?: string;
}

export interface PaymentInput {
  method: 'tunai' | 'qris' | 'debit';
  amount: number;
  reference?: string;       // QRIS/debit reference number
}

export interface CompleteOrderInput {
  outletId: string;
  shiftId: string;
  cashierId: string;
  memberId?: string;
  items: OrderItemInput[];
  payments: PaymentInput[];
  discount?: number;
  tax?: number;
  notes?: string;
  idempotencyKey?: string;
}

export interface CompletedOrder {
  order: typeof orders.$inferSelect;
  items: (typeof orderItems.$inferSelect)[];
  payments: (typeof payments.$inferSelect)[];
}

// ====== SERVICE ======

export const orderService = {
  /**
   * Create a draft order (status='held') without stock changes.
   * Use for "save as draft" before final checkout.
   */
  async createDraft(opts: {
    outletId: string;
    shiftId: string;
    cashierId: string;
    memberId?: string;
    items: OrderItemInput[];
    discount?: number;
    tax?: number;
    notes?: string;
  }): Promise<CompletedOrder> {
    if (opts.items.length === 0) {
      throw new ValidationError('Order must have at least 1 item');
    }

    return db.transaction(async (tx) => {
      // Verify shift
      const [shift] = await tx.select().from(shifts).where(eq(shifts.id, opts.shiftId)).limit(1);
      if (!shift || shift.status !== 'aktif' || shift.outletId !== opts.outletId) {
        throw new BusinessRuleError('Shift not active or invalid');
      }

      // Resolve products
      const productIds = opts.items.map((i) => i.productId);
      const productRows = await tx
        .select()
        .from(products)
        .where(sql`${products.id} = ANY(${productIds})`);

      const productMap = new Map(productRows.map((p) => [p.id, p]));

      let subtotal = 0;
      const orderItemsData: (typeof orderItems.$inferInsert)[] = [];

      for (const item of opts.items) {
        const product = productMap.get(item.productId);
        if (!product) throw new NotFoundError(`Product ${item.productId}`);

        const unitPrice = item.unitPrice ?? Number(product.sellingPrice);
        const discount = item.discount ?? 0;
        const lineTotal = (unitPrice - discount) * item.quantity;
        subtotal += lineTotal;

        orderItemsData.push({
          orderId: '', // placeholder, will be set after order insert
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity: item.quantity,
          unitPrice: unitPrice.toString(),
          discount: discount.toString(),
          subtotal: lineTotal.toString(),
          notes: item.notes,
        });
      }

      const discount = opts.discount ?? 0;
      const tax = opts.tax ?? 0;
      const total = subtotal - discount + tax;

      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          outletId: opts.outletId,
          shiftId: opts.shiftId,
          cashierId: opts.cashierId,
          memberId: opts.memberId,
          status: 'draft',
          subtotal: subtotal.toString(),
          discount: discount.toString(),
          tax: tax.toString(),
          total: total.toString(),
          paid: '0',
          change: '0',
          notes: opts.notes,
        })
        .returning();

      const itemsInsert = orderItemsData.map((i) => ({ ...i, orderId: order.id }));
      const items = await tx.insert(orderItems).values(itemsInsert).returning();

      return { order, items, payments: [] };
    });
  },

  /**
   * 🔴 ATOMIC: complete the order — full transaction.
   * Locks stocks, validates, decrements, inserts order/items/payments,
   * updates shift counter, writes audit log.
   */
  async completeOrder(opts: CompleteOrderInput): Promise<CompletedOrder> {
    // ====== Pre-checks (outside transaction) ======
    if (opts.items.length === 0) throw new ValidationError('Order must have at least 1 item');
    if (opts.payments.length === 0) throw new ValidationError('At least 1 payment is required');

    // Idempotency check — return cached if key already used
    if (opts.idempotencyKey) {
      const existing = await orderRepo.findByIdempotencyKey(opts.idempotencyKey);
      if (existing) {
        logger.info({ idempotencyKey: opts.idempotencyKey, orderId: existing.id }, 'Idempotent replay');
        const payments = await orderRepo.findByIdempotencyKey(opts.idempotencyKey);
        return {
          order: { ...existing } as any,
          items: (existing as any).items || [],
          payments: [],
        };
      }
    }

    // ====== Atomic Transaction ======
    return db.transaction(async (tx) => {
      // 1. Verify shift is active and belongs to outlet
      const [shift] = await tx
        .select()
        .from(shifts)
        .where(eq(shifts.id, opts.shiftId))
        .for('update') // pessimistic lock
        .limit(1);

      if (!shift) throw new NotFoundError('Shift');
      if (shift.status !== 'aktif') throw new BusinessRuleError(`Shift is not active (current: ${shift.status})`);
      if (shift.outletId !== opts.outletId) throw new BusinessRuleError('Shift does not belong to outlet');
      if (shift.cashierId !== opts.cashierId) throw new BusinessRuleError('Shift belongs to another cashier');

      // 2. Resolve products + lock stocks
      const productIds = opts.items.map((i) => i.productId);
      const productRows = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds))
        .for('update');

      const productMap = new Map(productRows.map((p) => [p.id, p]));

      // 3. Calculate prices + validate stock (without lock yet — we lock next)
      let subtotal = 0;
      const orderItemsData: (typeof orderItems.$inferInsert)[] = [];

      for (const item of opts.items) {
        const product = productMap.get(item.productId);
        if (!product) throw new NotFoundError(`Product ${item.productId}`);
        if (product.status === 'nonaktif') throw new BusinessRuleError(`Product ${product.name} is inactive`);

        const unitPrice = item.unitPrice ?? Number(product.sellingPrice);
        const discount = item.discount ?? 0;
        const lineTotal = (unitPrice - discount) * item.quantity;
        subtotal += lineTotal;

        orderItemsData.push({
          orderId: '', // placeholder
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity: item.quantity,
          unitPrice: unitPrice.toString(),
          discount: discount.toString(),
          subtotal: lineTotal.toString(),
          notes: item.notes,
        });
      }

      const totalDiscount = opts.discount ?? 0;
      const tax = opts.tax ?? 0;
      const total = subtotal - totalDiscount + tax;

      // 4. Lock all stocks FOR UPDATE
      const stockRows = await tx
        .select()
        .from(stocks)
        .where(and(eq(stocks.outletId, opts.outletId), inArray(stocks.productId, productIds)))
        .for('update');

      const stockMap = new Map(stockRows.map((s) => [s.productId, s]));

      // 5. Validate all stocks BEFORE decrementing any
      for (const item of opts.items) {
        const stock = stockMap.get(item.productId);
        if (!stock || stock.quantity < item.quantity) {
          const product = productMap.get(item.productId);
          throw new BusinessRuleError(
            `Insufficient stock for "${product?.name ?? item.productId}" (need ${item.quantity}, have ${stock?.quantity ?? 0})`,
            { productId: item.productId, requested: item.quantity, available: stock?.quantity ?? 0 }
          );
        }
      }

      // 6. Decrement stocks (we already validated, safe to do)
      const movementRecords: (typeof stockMovements.$inferInsert)[] = [];
      for (const item of opts.items) {
        await stockRepo.decrementStock(item.productId, opts.outletId, item.quantity, tx);
        movementRecords.push({
          productId: item.productId,
          outletId: opts.outletId,
          type: 'out_sale',
          quantity: -item.quantity,
          referenceType: 'order',
          referenceId: null, // set after order insert
          notes: 'POS sale',
          createdBy: opts.cashierId,
        });
      }

      // 7. Validate payment total >= order total
      const paid = opts.payments.reduce((sum, p) => sum + p.amount, 0);
      if (paid < total) {
        throw new BusinessRuleError(
          `Payment insufficient: total=${total}, paid=${paid}, missing=${total - paid}`,
          { total, paid, missing: total - paid }
        );
      }
      const change = paid - total;

      // 8. Insert order header
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          outletId: opts.outletId,
          shiftId: opts.shiftId,
          cashierId: opts.cashierId,
          memberId: opts.memberId,
          status: 'completed',
          subtotal: subtotal.toString(),
          discount: totalDiscount.toString(),
          tax: tax.toString(),
          total: total.toString(),
          paid: paid.toString(),
          change: change.toString(),
          notes: opts.notes,
          idempotencyKey: opts.idempotencyKey,
          completedAt: new Date(),
        })
        .returning();

      // 9. Update movement referenceIds
      for (const m of movementRecords) {
        m.referenceId = order.id;
      }

      // 10. Insert order items
      const itemsInsert = orderItemsData.map((i) => ({ ...i, orderId: order.id }));
      const items = await tx.insert(orderItems).values(itemsInsert).returning();

      // 11. Insert stock movements
      await tx.insert(stockMovements).values(movementRecords);

      // 12. Insert payments
      const paymentRecords = opts.payments.map((p) => ({
        orderId: order.id,
        method: p.method,
        amount: p.amount.toString(),
        reference: p.reference,
        paidAt: new Date(),
        cashierId: opts.cashierId,
      }));
      const paymentRows = await tx.insert(payments).values(paymentRecords).returning();

      // 13. Update shift counter (increment totalSales + totalTransactions)
      await tx
        .update(shifts)
        .set({
          totalSales: sql`${shifts.totalSales} + ${total}::numeric`,
          totalTransactions: sql`${shifts.totalTransactions} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(shifts.id, opts.shiftId));

      // 14. Audit log
      await tx.insert(auditLogs).values({
        userId: opts.cashierId,
        outletId: opts.outletId,
        action: 'create',
        entityType: 'order',
        entityId: order.id,
        newData: { orderNumber, total, items: items.length, payments: paymentRows.length },
      });

      logger.info(
        { orderNumber, total, items: items.length, cashierId: opts.cashierId },
        '✅ Order completed atomically'
      );

      return { order, items, payments: paymentRows };
    });
  },

  /**
   * Void an order — atomic.
   * Restores stock + updates order status + audit log.
   * Requires manager PIN verified (enforced by route — see pinService).
   */
  async voidOrder(opts: {
    orderId: string;
    voidedBy: string;
    voidReason: string;
  }) {
    if (!opts.voidReason || opts.voidReason.length < 5) {
      throw new ValidationError('Void reason is required (min 5 chars)');
    }

    return db.transaction(async (tx) => {
      // 1. Lock order
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, opts.orderId))
        .for('update')
        .limit(1);

      if (!order) throw new NotFoundError('Order');
      if (order.status !== 'completed') {
        throw new BusinessRuleError(`Only completed orders can be voided (current: ${order.status})`);
      }

      // 2. Get items to restore stock
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, opts.orderId));

      // 3. Restore stock for each item
      const restoreMovements: (typeof stockMovements.$inferInsert)[] = [];
      for (const item of items) {
        await stockRepo.incrementStock(item.productId, order.outletId, item.quantity, tx);
        restoreMovements.push({
          productId: item.productId,
          outletId: order.outletId,
          type: 'in_adjustment',
          quantity: item.quantity,
          referenceType: 'order_void',
          referenceId: order.id,
          notes: `Void: ${opts.voidReason}`,
          createdBy: opts.voidedBy,
        });
      }
      await tx.insert(stockMovements).values(restoreMovements);

      // 4. Update order status
      const [voidedOrder] = await tx
        .update(orders)
        .set({
          status: 'voided',
          voidedAt: new Date(),
          voidedBy: opts.voidedBy,
          voidReason: opts.voidReason,
        })
        .where(eq(orders.id, opts.orderId))
        .returning();

      // 5. Decrement shift counter (reverse the sale)
      await tx
        .update(shifts)
        .set({
          totalSales: sql`${shifts.totalSales} - ${order.total}::numeric`,
          totalTransactions: sql`${shifts.totalTransactions} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(shifts.id, order.shiftId));

      // 6. Audit log
      await tx.insert(auditLogs).values({
        userId: opts.voidedBy,
        outletId: order.outletId,
        action: 'void',
        entityType: 'order',
        entityId: order.id,
        oldData: { status: 'completed', total: order.total },
        newData: { status: 'voided', voidReason: opts.voidReason },
      });

      logger.info(
        { orderNumber: order.orderNumber, voidReason: opts.voidReason },
        'Order voided atomically'
      );

      return voidedOrder;
    });
  },

  async getOrder(id: string) {
    return orderRepo.findById(id);
  },

  async listOrders(opts: { outletId?: string; cashierId?: string; shiftId?: string; status?: string; limit?: number; offset?: number }) {
    return orderRepo.list(opts);
  },
};
