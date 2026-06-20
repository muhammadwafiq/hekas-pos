/**
 * Inventory + Surat Jalan domain.
 * Includes: incoming_goods, outgoing_goods, surats (delivery orders).
 */

import { pgTable, uuid, varchar, text, integer, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import {
  incomingGoodStatusEnum,
  outgoingGoodStatusEnum,
  suratJalanStatusEnum,
  suratApprovalActionEnum,
} from './enums.js';
import { users } from './auth.js';
import { suppliers } from './master.js';

// ====== INCOMING GOODS (PURCHASE ORDERS) ======
export const incomingGoods = pgTable(
  'incoming_goods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentNumber: varchar('document_number', { length: 50 }).notNull().unique(),
    outletId: uuid('outlet_id').notNull(),
    supplierId: uuid('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'restrict' }),
    supplierName: varchar('supplier_name', { length: 150 }).notNull(),
    receivedDate: timestamp('received_date', { withTimezone: true }).notNull().defaultNow(),
    totalItems: integer('total_items').notNull().default(0),
    status: incomingGoodStatusEnum('status').notNull().default('pending'),
    notes: text('notes'),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    rejectedBy: uuid('rejected_by').references(() => users.id, { onDelete: 'set null' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectReason: text('reject_reason'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    outletIdx: index('incoming_goods_outlet_idx').on(t.outletId),
    supplierIdx: index('incoming_goods_supplier_idx').on(t.supplierId),
    statusIdx: index('incoming_goods_status_idx').on(t.status),
    dateIdx: index('incoming_goods_date_idx').on(t.receivedDate),
  })
);

export const incomingGoodItems = pgTable(
  'incoming_good_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incomingGoodId: uuid('incoming_good_id').notNull().references(() => incomingGoods.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    productName: varchar('product_name', { length: 200 }).notNull(),
    productSku: varchar('product_sku', { length: 50 }).notNull(),
    quantity: integer('quantity').notNull(),
    purchasePrice: numeric('purchase_price', { precision: 15, scale: 2 }).notNull(),
    subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull(),
    notes: text('notes'),
  },
  (t) => ({
    incomingIdx: index('incoming_good_items_incoming_idx').on(t.incomingGoodId),
    productIdx: index('incoming_good_items_product_idx').on(t.productId),
  })
);

// ====== OUTGOING GOODS ======
export const outgoingGoods = pgTable(
  'outgoing_goods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentNumber: varchar('document_number', { length: 50 }).notNull().unique(),
    outletId: uuid('outlet_id').notNull(),
    destination: varchar('destination', { length: 200 }).notNull(),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: uuid('reference_id'),
    totalItems: integer('total_items').notNull().default(0),
    status: outgoingGoodStatusEnum('status').notNull().default('draft'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    outletIdx: index('outgoing_goods_outlet_idx').on(t.outletId),
    statusIdx: index('outgoing_goods_status_idx').on(t.status),
    refIdx: index('outgoing_goods_ref_idx').on(t.referenceType, t.referenceId),
  })
);

export const outgoingGoodItems = pgTable(
  'outgoing_good_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outgoingGoodId: uuid('outgoing_good_id').notNull().references(() => outgoingGoods.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    productName: varchar('product_name', { length: 200 }).notNull(),
    productSku: varchar('product_sku', { length: 50 }).notNull(),
    quantityPicked: integer('quantity_picked').notNull().default(0),
    quantitySent: integer('quantity_sent').notNull().default(0),
    pickedBy: uuid('picked_by').references(() => users.id, { onDelete: 'set null' }),
    pickedAt: timestamp('picked_at', { withTimezone: true }),
    notes: text('notes'),
  },
  (t) => ({
    outgoingIdx: index('outgoing_good_items_outgoing_idx').on(t.outgoingGoodId),
    productIdx: index('outgoing_good_items_product_idx').on(t.productId),
  })
);

// ====== SURAT JALAN (DELIVERY ORDERS) ======
export const surats = pgTable(
  'surats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentNumber: varchar('document_number', { length: 50 }).notNull().unique(),
    outletId: uuid('outlet_id').notNull(),
    outgoingGoodId: uuid('outgoing_good_id').references(() => outgoingGoods.id, { onDelete: 'set null' }),
    orderId: uuid('order_id'),
    destination: varchar('destination', { length: 200 }).notNull(),
    recipientName: varchar('recipient_name', { length: 150 }).notNull(),
    recipientPhone: varchar('recipient_phone', { length: 20 }),
    totalItems: integer('total_items').notNull().default(0),
    status: suratJalanStatusEnum('status').notNull().default('draft'),
    notes: text('notes'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedBy: uuid('rejected_by').references(() => users.id, { onDelete: 'set null' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectReason: text('reject_reason'),
    pdfUrl: text('pdf_url'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    outletIdx: index('surats_outlet_idx').on(t.outletId),
    statusIdx: index('surats_status_idx').on(t.status),
    outgoingIdx: index('surats_outgoing_idx').on(t.outgoingGoodId),
  })
);

export const suratItems = pgTable(
  'surat_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    suratId: uuid('surat_id').notNull().references(() => surats.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    productName: varchar('product_name', { length: 200 }).notNull(),
    productSku: varchar('product_sku', { length: 50 }).notNull(),
    quantity: integer('quantity').notNull(),
    notes: text('notes'),
  },
  (t) => ({
    suratIdx: index('surat_items_surat_idx').on(t.suratId),
    productIdx: index('surat_items_product_idx').on(t.productId),
  })
);

export const suratApprovals = pgTable(
  'surat_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    suratId: uuid('surat_id').notNull().references(() => surats.id, { onDelete: 'cascade' }),
    approverId: uuid('approver_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    action: suratApprovalActionEnum('action').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    suratIdx: index('surat_approvals_surat_idx').on(t.suratId),
    approverIdx: index('surat_approvals_approver_idx').on(t.approverId),
  })
);

export type IncomingGood = typeof incomingGoods.$inferSelect;
export type IncomingGoodItem = typeof incomingGoodItems.$inferSelect;
export type OutgoingGood = typeof outgoingGoods.$inferSelect;
export type OutgoingGoodItem = typeof outgoingGoodItems.$inferSelect;
export type Surat = typeof surats.$inferSelect;
export type SuratItem = typeof suratItems.$inferSelect;
export type SuratApproval = typeof suratApprovals.$inferSelect;
