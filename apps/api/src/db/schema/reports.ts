/**
 * Reports domain — daily reports, snapshots.
 */

import { pgTable, uuid, varchar, integer, numeric, date, jsonb, timestamp, index } from 'drizzle-orm/pg-core';

export const dailyReports = pgTable(
  'daily_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    reportDate: date('report_date').notNull(),
    totalOrders: integer('total_orders').notNull().default(0),
    totalSales: numeric('total_sales', { precision: 15, scale: 2 }).notNull().default('0'),
    totalItemsSold: integer('total_items_sold').notNull().default(0),
    totalVoid: integer('total_void').notNull().default(0),
    totalVoidAmount: numeric('total_void_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    totalDiscount: numeric('total_discount', { precision: 15, scale: 2 }).notNull().default('0'),
    totalTax: numeric('total_tax', { precision: 15, scale: 2 }).notNull().default('0'),
    paymentBreakdown: jsonb('payment_breakdown'),
    topProducts: jsonb('top_products'),
    cashierBreakdown: jsonb('cashier_breakdown'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    outletIdx: index('daily_reports_outlet_idx').on(t.outletId),
    dateIdx: index('daily_reports_date_idx').on(t.reportDate),
  })
);

export const reportSnapshots = pgTable(
  'report_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    snapshotType: varchar('snapshot_type', { length: 50 }).notNull(),
    snapshotData: jsonb('snapshot_data').notNull(),
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    outletIdx: index('report_snapshots_outlet_idx').on(t.outletId),
    typeIdx: index('report_snapshots_type_idx').on(t.snapshotType),
    validIdx: index('report_snapshots_valid_idx').on(t.validFrom),
  })
);

export type DailyReport = typeof dailyReports.$inferSelect;
export type ReportSnapshot = typeof reportSnapshots.$inferSelect;
