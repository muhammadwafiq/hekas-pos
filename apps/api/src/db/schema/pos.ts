/**
 * POS domain — orders, order_items, payments, held_drafts.
 */

import { pgTable, uuid, varchar, text, integer, numeric, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { orderStatusEnum, paymentMethodEnum } from './enums.js';
import { users } from './auth.js';
import { members } from './master.js';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
    outletId: uuid('outlet_id').notNull(),
    shiftId: uuid('shift_id'),
    cashierId: uuid('cashier_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    memberId: uuid('member_id').references(() => members.id, { onDelete: 'set null' }),
    status: orderStatusEnum('status').notNull().default('draft'),
    subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
    discount: numeric('discount', { precision: 15, scale: 2 }).notNull().default('0'),
    tax: numeric('tax', { precision: 15, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 15, scale: 2 }).notNull().default('0'),
    paid: numeric('paid', { precision: 15, scale: 2 }).notNull().default('0'),
    change: numeric('change', { precision: 15, scale: 2 }).notNull().default('0'),
    notes: text('notes'),
    idempotencyKey: varchar('idempotency_key', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: uuid('voided_by').references(() => users.id, { onDelete: 'set null' }),
    voidReason: text('void_reason'),
  },
  (t) => ({
    outletIdx: index('orders_outlet_idx').on(t.outletId),
    cashierIdx: index('orders_cashier_idx').on(t.cashierId),
    shiftIdx: index('orders_shift_idx').on(t.shiftId),
    memberIdx: index('orders_member_idx').on(t.memberId),
    statusIdx: index('orders_status_idx').on(t.status),
    timeIdx: index('orders_time_idx').on(t.createdAt),
    idempIdx: index('orders_idemp_idx').on(t.idempotencyKey),
  })
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    productName: varchar('product_name', { length: 200 }).notNull(),
    productSku: varchar('product_sku', { length: 50 }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull(),
    discount: numeric('discount', { precision: 15, scale: 2 }).notNull().default('0'),
    subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull(),
    notes: text('notes'),
  },
  (t) => ({
    orderIdx: index('order_items_order_idx').on(t.orderId),
    productIdx: index('order_items_product_idx').on(t.productId),
  })
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    method: paymentMethodEnum('method').notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    reference: varchar('reference', { length: 100 }),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
    cashierId: uuid('cashier_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  },
  (t) => ({
    orderIdx: index('payments_order_idx').on(t.orderId),
    methodIdx: index('payments_method_idx').on(t.method),
    timeIdx: index('payments_time_idx').on(t.paidAt),
  })
);

export const heldDrafts = pgTable(
  'held_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cashierId: uuid('cashier_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id').notNull(),
    draftName: varchar('draft_name', { length: 100 }),
    draftData: jsonb('draft_data').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    cashierIdx: index('held_drafts_cashier_idx').on(t.cashierId),
    expiresIdx: index('held_drafts_expires_idx').on(t.expiresAt),
  })
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type HeldDraft = typeof heldDrafts.$inferSelect;
