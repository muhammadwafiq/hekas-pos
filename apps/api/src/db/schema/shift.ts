/**
 * Shift domain — shifts, handovers.
 */

import { pgTable, uuid, varchar, text, numeric, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { shiftStatusEnum } from './enums.js';
import { users } from './auth.js';

export const shifts = pgTable(
  'shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shiftCode: varchar('shift_code', { length: 50 }).notNull().unique(),
    outletId: uuid('outlet_id').notNull(),
    cashierId: uuid('cashier_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    cashierName: varchar('cashier_name', { length: 100 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    startingCash: numeric('starting_cash', { precision: 15, scale: 2 }).notNull().default('0'),
    endingCash: numeric('ending_cash', { precision: 15, scale: 2 }),
    expectedCash: numeric('expected_cash', { precision: 15, scale: 2 }),
    cashDifference: numeric('cash_difference', { precision: 15, scale: 2 }),
    totalTransactions: integer('total_transactions').notNull().default(0),
    totalSales: numeric('total_sales', { precision: 15, scale: 2 }).notNull().default('0'),
    status: shiftStatusEnum('status').notNull().default('aktif'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    cashierIdx: index('shifts_cashier_idx').on(t.cashierId),
    outletIdx: index('shifts_outlet_idx').on(t.outletId),
    statusIdx: index('shifts_status_idx').on(t.status),
    startedIdx: index('shifts_started_idx').on(t.startedAt),
  })
);

export const shiftHandovers = pgTable(
  'shift_handovers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromShiftId: uuid('from_shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
    toCashierId: uuid('to_cashier_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    handoverNotes: text('handover_notes'),
    cashTransferred: numeric('cash_transferred', { precision: 15, scale: 2 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    fromShiftIdx: index('shift_handovers_from_idx').on(t.fromShiftId),
    toCashierIdx: index('shift_handovers_to_idx').on(t.toCashierId),
  })
);

export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type ShiftHandover = typeof shiftHandovers.$inferSelect;
