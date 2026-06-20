/**
 * Dashboard Manager service — KPI summary for Manager.
 * Phase 5 Gate 4 (placeholder; full impl in Phase 5).
 */

import { eq, and, sql, gte, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { orders } from '../db/schema/pos.js';
import { products } from '../db/schema/master.js';
import { stocks } from '../db/schema/stock.js';
import { shifts } from '../db/schema/shift.js';
import { users } from '../db/schema/auth.js';

export async function dashboardManager(outletId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todaySales, totalProducts, lowStock, activeShifts, totalEmployees] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.outletId, outletId),
          eq(orders.status, 'completed'),
          gte(orders.createdAt, todayStart)
        )
      ),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.outletId, outletId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(stocks)
      .where(and(eq(stocks.outletId, outletId), sql`${stocks.quantity} <= ${stocks.stockMin}`)),
    db.select({ count: sql<number>`count(*)::int` }).from(shifts).where(and(eq(shifts.outletId, outletId), eq(shifts.status, 'aktif'))),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.outletId, outletId)),
  ]);

  return {
    today: {
      transactions: todaySales[0]?.count ?? 0,
      revenue: todaySales[0]?.revenue ?? 0,
    },
    inventory: {
      totalProducts: totalProducts[0]?.count ?? 0,
      lowStock: lowStock[0]?.count ?? 0,
    },
    operations: {
      activeShifts: activeShifts[0]?.count ?? 0,
      totalEmployees: totalEmployees[0]?.count ?? 0,
    },
    outletId,
  };
}