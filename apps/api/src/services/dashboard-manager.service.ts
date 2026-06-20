/**
 * Dashboard Manager service — KPI summary for Manager.
 * Phase 5.
 */

import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { orders, orderItems, payments } from '../db/schema/pos.js';
import { products } from '../db/schema/master.js';
import { stocks } from '../db/schema/stock.js';
import { shifts } from '../db/schema/shift.js';
import { users } from '../db/schema/auth.js';
import { members } from '../db/schema/master.js';

export type DashboardRange = 'today' | 'week' | 'month' | 'all';

function rangeStart(range: DashboardRange): Date {
  const start = new Date();
  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 7);
  } else if (range === 'month') {
    start.setHours(0, 0, 0, 0);
    start.setDate(1);
  } else {
    // 'all' — anchor to 2000-01-01
    return new Date('2000-01-01T00:00:00.000Z');
  }
  return start;
}

export async function dashboardManager(
  outletId: string,
  range: DashboardRange = 'today',
) {
  const since = rangeStart(range);
  // Fix: Drizzle 0.45 + postgres-js 3.4 doesn't auto-stringify Date in gte() operator.
  // Pre-stringify via toISOString() + cast to timestamp.
  const sinceIso = since.toISOString();

  const [
    salesAgg,
    avgBasket,
    topProducts,
    salesByHour,
    paymentBreakdown,
    totalProducts,
    lowStock,
    outOfStock,
    activeShifts,
    totalEmployees,
    memberCount,
    ordersByStatus,
    recentOrders,
  ] = await Promise.all([
    // 1) Sales KPI
    db
      .select({
        count: sql<number>`count(*)::int`,
        revenue: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
        discount: sql<string>`coalesce(sum(${orders.discount}), 0)::text`,
        tax: sql<string>`coalesce(sum(${orders.tax}), 0)::text`,
        avgTicket: sql<string>`coalesce(avg(${orders.total}), 0)::text`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.outletId, outletId),
          eq(orders.status, 'completed'),
          gte(orders.createdAt, sql`${sinceIso}::timestamp`),
        ),
      ),

    // 2) Avg basket size (items per order)
    db
      .select({
        avgItems: sql<string>`coalesce(avg(item_count), 0)::text`,
      })
      .from(
        sql`(select ${orders.id}, count(${orderItems.id}) as item_count
             from ${orders} left join ${orderItems} on ${orderItems.orderId} = ${orders.id}
             where ${orders.outletId} = ${outletId}
               and ${orders.status} = 'completed'
               and ${orders.createdAt} >= ${sql.raw(`'${sinceIso}'`)}::timestamp
             group by ${orders.id}) as oi`,
      ),

    // 3) Top 5 selling products
    db
      .select({
        productId: orderItems.productId,
        name: products.name,
        sku: products.sku,
        qtySold: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int`,
        revenue: sql<string>`coalesce(sum(${orderItems.subtotal}), 0)::text`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(
        and(
          eq(orders.outletId, outletId),
          eq(orders.status, 'completed'),
          gte(orders.createdAt, sql`${sinceIso}::timestamp`),
        ),
      )
      .groupBy(orderItems.productId, products.name, products.sku)
      .orderBy(sql`sum(${orderItems.subtotal}) desc`)
      .limit(5),

    // 4) Sales by hour-of-day (0-23)
    db
      .select({
        hour: sql<number>`extract(hour from ${orders.createdAt} at time zone 'Asia/Jakarta')::int`,
        count: sql<number>`count(*)::int`,
        revenue: sql<string>`coalesce(sum(${orders.total}), 0)::text`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.outletId, outletId),
          eq(orders.status, 'completed'),
          gte(orders.createdAt, sql`${sinceIso}::timestamp`),
        ),
      )
      .groupBy(sql`extract(hour from ${orders.createdAt} at time zone 'Asia/Jakarta')`)
      .orderBy(sql`extract(hour from ${orders.createdAt} at time zone 'Asia/Jakarta')`),

    // 5) Payment method breakdown
    db
      .select({
        method: payments.method,
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${payments.amount}), 0)::text`,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(
        and(
          eq(orders.outletId, outletId),
          eq(orders.status, 'completed'),
          gte(orders.createdAt, sql`${sinceIso}::timestamp`),
        ),
      )
      .groupBy(payments.method),

    // 6) Inventory totals
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.outletId, outletId)),

    // 7) Low stock count (quantity <= product's stockMin)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(stocks)
      .innerJoin(products, eq(products.id, stocks.productId))
      .where(
        and(
          eq(stocks.outletId, outletId),
          sql`${stocks.quantity} <= ${products.stockMin}`,
        ),
      ),

    // 8) Out of stock count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(stocks)
      .where(and(eq(stocks.outletId, outletId), lte(stocks.quantity, 0))),

    // 9) Active shifts
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(shifts)
      .where(and(eq(shifts.outletId, outletId), eq(shifts.status, 'aktif'))),

    // 10) Total employees at outlet
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.outletId, outletId)),

    // 11) Member count at outlet
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(members)
      .where(eq(members.outletId, outletId)),

    // 12) Orders by status (today snapshot)
    db
      .select({
        status: orders.status,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.outletId, outletId),
          gte(orders.createdAt, sql`${sinceIso}::timestamp`),
        ),
      )
      .groupBy(orders.status),

    // 13) Recent 10 orders
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        total: orders.total,
        status: orders.status,
        createdAt: orders.createdAt,
        cashierId: orders.cashierId,
      })
      .from(orders)
      .where(
        and(
          eq(orders.outletId, outletId),
          gte(orders.createdAt, sql`${sinceIso}::timestamp`),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(10),
  ]);

  // ==== Aggregate ====
  const s = salesAgg[0] ?? { count: 0, revenue: '0', discount: '0', tax: '0', avgTicket: '0' };
  const ab = avgBasket[0] ?? { avgItems: '0' };

  // Build hour map (default 0 for missing)
  const hourMap = new Map<number, { count: number; revenue: string }>();
  for (let h = 0; h < 24; h++) hourMap.set(h, { count: 0, revenue: '0' });
  for (const row of salesByHour) {
    hourMap.set(row.hour, { count: row.count, revenue: row.revenue });
  }

  // Status breakdown map
  const statusMap: Record<string, number> = {};
  for (const row of ordersByStatus) statusMap[row.status] = row.count;

  return {
    outletId,
    range,
    since: sinceIso,
    generatedAt: new Date().toISOString(),
    sales: {
      transactions: s.count,
      revenue: s.revenue,
      discount: s.discount,
      tax: s.tax,
      avgTicket: s.avgTicket,
      avgItemsPerOrder: ab.avgItems,
    },
    inventory: {
      totalProducts: totalProducts[0]?.count ?? 0,
      lowStock: lowStock[0]?.count ?? 0,
      outOfStock: outOfStock[0]?.count ?? 0,
    },
    operations: {
      activeShifts: activeShifts[0]?.count ?? 0,
      totalEmployees: totalEmployees[0]?.count ?? 0,
      members: memberCount[0]?.count ?? 0,
    },
    orders: {
      byStatus: statusMap,
      recent: recentOrders,
    },
    topProducts: topProducts.map((p) => ({
      productId: p.productId,
      name: p.name,
      sku: p.sku,
      qtySold: p.qtySold,
      revenue: p.revenue,
    })),
    salesByHour: Array.from(hourMap.entries()).map(([hour, v]) => ({
      hour,
      count: v.count,
      revenue: v.revenue,
    })),
    payments: paymentBreakdown.map((p) => ({
      method: p.method,
      count: p.count,
      total: p.total,
    })),
  };
}