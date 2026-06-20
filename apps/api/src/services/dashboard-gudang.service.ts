/**
 * Dashboard Gudang service — Admin Gudang summary.
 * Phase 3 Gate 2 (Task 2.18).
 */

import { eq, and, sql, gte, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { stocks, stockMovements } from '../db/schema/stock.js';
import { products } from '../db/schema/master.js';
import { incomingGoods, outgoingGoods } from '../db/schema/inventory.js';

export const dashboardGudangService = {
  async summary(opts: { outletId: string }) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      productCount,
      stockAgg,
      lowStock,
      pendingPO,
      readyOutgoing,
      todayMovements,
      recentMovements,
    ] = await Promise.all([
      // Total active products
      db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(products)
        .where(and(eq(products.outletId, opts.outletId), sql`${products.status} != 'nonaktif'`)),

      // Stock value
      db
        .select({
          totalQty: sql<number>`COALESCE(SUM(${stocks.quantity}), 0)::int`,
          totalValue: sql<string>`COALESCE(SUM(${stocks.quantity} * ${products.purchasePrice}::numeric), 0)::text`,
        })
        .from(stocks)
        .innerJoin(products, eq(products.id, stocks.productId))
        .where(and(eq(stocks.outletId, opts.outletId), sql`${products.status} != 'nonaktif'`)),

      // Low stock list (limit 10)
      db
        .select({
          productId: products.id,
          name: products.name,
          sku: products.sku,
          stockMin: products.stockMin,
          quantity: stocks.quantity,
        })
        .from(stocks)
        .innerJoin(products, eq(products.id, stocks.productId))
        .where(
          and(
            eq(stocks.outletId, opts.outletId),
            sql`${stocks.quantity} <= ${products.stockMin}`,
            sql`${products.status} != 'nonaktif'`,
          ),
        )
        .orderBy(stocks.quantity)
        .limit(10),

      // Pending POs
      db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(incomingGoods)
        .where(and(eq(incomingGoods.outletId, opts.outletId), eq(incomingGoods.status, 'pending'))),

      // Ready outgoing (siap kirim)
      db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(outgoingGoods)
        .where(and(eq(outgoingGoods.outletId, opts.outletId), eq(outgoingGoods.status, 'ready'))),

      // Today's movements count
      db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(stockMovements)
        .where(and(eq(stockMovements.outletId, opts.outletId), gte(stockMovements.createdAt, todayStart))),

      // Recent 10 movements
      db
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.outletId, opts.outletId))
        .orderBy(desc(stockMovements.createdAt))
        .limit(10),
    ]);

    return {
      products: { total: productCount[0]?.total ?? 0 },
      stock: {
        totalQuantity: stockAgg[0]?.totalQty ?? 0,
        totalValue: stockAgg[0]?.totalValue ?? '0',
        lowStockCount: lowStock.length,
        lowStock,
      },
      incoming: { pendingCount: pendingPO[0]?.total ?? 0 },
      outgoing: { readyCount: readyOutgoing[0]?.total ?? 0 },
      movements: {
        todayCount: todayMovements[0]?.total ?? 0,
        recent: recentMovements,
      },
    };
  },
};