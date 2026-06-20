/**
 * Stock domain — stocks, movements, adjustments.
 */

import { pgTable, uuid, integer, varchar, text, numeric, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { stockMovementTypeEnum } from './enums.js';
import { products } from './master.js';

export const stocks = pgTable(
  'stocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id').notNull(),
    quantity: integer('quantity').notNull().default(0),
    reserved: integer('reserved').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productOutletUq: unique('stocks_product_outlet_uq').on(t.productId, t.outletId),
    outletIdx: index('stocks_outlet_idx').on(t.outletId),
  })
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id').notNull(),
    type: stockMovementTypeEnum('type').notNull(),
    /** Signed: positive = in, negative = out */
    quantity: integer('quantity').notNull(),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: uuid('reference_id'),
    notes: text('notes'),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productIdx: index('stock_movements_product_idx').on(t.productId),
    outletIdx: index('stock_movements_outlet_idx').on(t.outletId),
    typeIdx: index('stock_movements_type_idx').on(t.type),
    refIdx: index('stock_movements_ref_idx').on(t.referenceType, t.referenceId),
    timeIdx: index('stock_movements_time_idx').on(t.createdAt),
  })
);

export const stockAdjustments = pgTable(
  'stock_adjustments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id').notNull(),
    oldQuantity: integer('old_quantity').notNull(),
    newQuantity: integer('new_quantity').notNull(),
    difference: integer('difference').notNull(),
    reason: text('reason').notNull(),
    adjustedBy: uuid('adjusted_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productIdx: index('stock_adjustments_product_idx').on(t.productId),
    outletIdx: index('stock_adjustments_outlet_idx').on(t.outletId),
    timeIdx: index('stock_adjustments_time_idx').on(t.createdAt),
  })
);

export type Stock = typeof stocks.$inferSelect;
export type NewStock = typeof stocks.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type StockAdjustment = typeof stockAdjustments.$inferSelect;