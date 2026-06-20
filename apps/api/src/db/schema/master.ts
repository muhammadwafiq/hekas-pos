/**
 * Master domain — categories, products, suppliers, members.
 */

import { pgTable, uuid, varchar, text, integer, numeric, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { productStatusEnum, memberTierEnum } from './enums.js';

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    iconUrl: text('icon_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    outletIdx: index('categories_outlet_idx').on(t.outletId),
    activeIdx: index('categories_active_idx').on(t.isActive),
  })
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sku: varchar('sku', { length: 50 }).notNull().unique(),
    barcode: varchar('barcode', { length: 50 }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
    supplierId: uuid('supplier_id'),
    outletId: uuid('outlet_id').notNull(),
    purchasePrice: numeric('purchase_price', { precision: 15, scale: 2 }).notNull().default('0'),
    sellingPrice: numeric('selling_price', { precision: 15, scale: 2 }).notNull().default('0'),
    stockMin: integer('stock_min').notNull().default(0),
    stockMax: integer('stock_max'),
    unit: varchar('unit', { length: 20 }).notNull().default('pcs'),
    status: productStatusEnum('status').notNull().default('aktif'),
    imageUrl: text('image_url'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    skuIdx: index('products_sku_idx').on(t.sku),
    barcodeIdx: index('products_barcode_idx').on(t.barcode),
    categoryIdx: index('products_category_idx').on(t.categoryId),
    outletIdx: index('products_outlet_idx').on(t.outletId),
    statusIdx: index('products_status_idx').on(t.status),
    nameIdx: index('products_name_idx').on(t.name),
  })
);

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    imageUrl: text('image_url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productIdx: index('product_images_product_idx').on(t.productId),
  })
);

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 150 }).notNull(),
    contactPerson: varchar('contact_person', { length: 100 }),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 150 }),
    address: text('address'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nameIdx: index('suppliers_name_idx').on(t.name),
    activeIdx: index('suppliers_active_idx').on(t.isActive),
  })
);

export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberCode: varchar('member_code', { length: 50 }).notNull().unique(),
    outletId: uuid('outlet_id').notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    email: varchar('email', { length: 150 }),
    tier: memberTierEnum('tier').notNull().default('silver'),
    points: integer('points').notNull().default(0),
    totalSpent: numeric('total_spent', { precision: 15, scale: 2 }).notNull().default('0'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: index('members_code_idx').on(t.memberCode),
    phoneIdx: index('members_phone_idx').on(t.phone),
    outletIdx: index('members_outlet_idx').on(t.outletId),
    tierIdx: index('members_tier_idx').on(t.tier),
  })
);

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type Member = typeof members.$inferSelect;