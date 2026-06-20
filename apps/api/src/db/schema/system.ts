/**
 * System domain — audit logs, outlet settings, system settings, devices, printers.
 */

import { pgTable, uuid, varchar, text, integer, numeric, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { auditActionEnum, deviceTypeEnum, printerConnectionEnum } from './enums.js';
import { users } from './auth.js';

// ====== AUDIT LOGS ======
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    outletId: uuid('outlet_id'),
    action: auditActionEnum('action').notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id'),
    oldData: jsonb('old_data'),
    newData: jsonb('new_data'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('audit_logs_user_idx').on(t.userId),
    entityIdx: index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    actionIdx: index('audit_logs_action_idx').on(t.action),
    timeIdx: index('audit_logs_time_idx').on(t.createdAt),
  })
);

// ====== OUTLET SETTINGS ======
export const outletSettings = pgTable(
  'outlet_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull().unique(),
    name: varchar('name', { length: 150 }).notNull(),
    address: text('address'),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 150 }),
    taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
    currency: varchar('currency', { length: 10 }).notNull().default('IDR'),
    receiptHeader: text('receipt_header'),
    receiptFooter: text('receipt_footer'),
    openTime: varchar('open_time', { length: 5 }),
    closeTime: varchar('close_time', { length: 5 }),
    timezone: varchar('timezone', { length: 50 }).notNull().default('Asia/Jakarta'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index('outlet_settings_active_idx').on(t.isActive),
  })
);

// ====== SYSTEM SETTINGS ======
export const systemSettings = pgTable(
  'system_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 100 }).notNull().unique(),
    value: jsonb('value').notNull(),
    description: text('description'),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  }
);

// ====== DEVICES ======
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    deviceName: varchar('device_name', { length: 100 }).notNull(),
    deviceType: deviceTypeEnum('device_type').notNull(),
    macAddress: text('mac_address'),
    ipAddress: text('ip_address'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    outletIdx: index('devices_outlet_idx').on(t.outletId),
    typeIdx: index('devices_type_idx').on(t.deviceType),
  })
);

// ====== PRINTERS ======
export const printers = pgTable(
  'printers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outletId: uuid('outlet_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    connectionType: printerConnectionEnum('connection_type').notNull(),
    address: varchar('address', { length: 200 }).notNull(),
    paperWidth: integer('paper_width').notNull().default(80),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    outletIdx: index('printers_outlet_idx').on(t.outletId),
    defaultIdx: index('printers_default_idx').on(t.isDefault),
  })
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type OutletSetting = typeof outletSettings.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type Printer = typeof printers.$inferSelect;
