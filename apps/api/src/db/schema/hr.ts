/**
 * HR domain — employees, attendances, leave_requests, performances.
 */

import { pgTable, uuid, varchar, text, integer, numeric, boolean, date, timestamp, index } from 'drizzle-orm/pg-core';
import { attendanceStatusEnum, leaveTypeEnum, leaveRequestStatusEnum } from './enums.js';
import { users } from './auth.js';

export const employees = pgTable(
  'employees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    outletId: uuid('outlet_id').notNull(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    nik: varchar('nik', { length: 30 }),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 150 }),
    position: varchar('position', { length: 100 }),
    joinDate: date('join_date').notNull(),
    resignDate: date('resign_date'),
    baseSalary: numeric('base_salary', { precision: 15, scale: 2 }).notNull().default('0'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    outletIdx: index('employees_outlet_idx').on(t.outletId),
    userIdx: index('employees_user_idx').on(t.userId),
    activeIdx: index('employees_active_idx').on(t.isActive),
  })
);

export const attendances = pgTable(
  'attendances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
    outletId: uuid('outlet_id').notNull(),
    shiftId: uuid('shift_id'),
    checkInAt: timestamp('check_in_at', { withTimezone: true }).notNull(),
    checkOutAt: timestamp('check_out_at', { withTimezone: true }),
    status: attendanceStatusEnum('status').notNull().default('hadir'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employeeIdx: index('attendances_employee_idx').on(t.employeeId),
    outletIdx: index('attendances_outlet_idx').on(t.outletId),
    dateIdx: index('attendances_date_idx').on(t.checkInAt),
  })
);

export const leaveRequests = pgTable(
  'leave_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
    leaveType: leaveTypeEnum('leave_type').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    totalDays: integer('total_days').notNull(),
    reason: text('reason').notNull(),
    status: leaveRequestStatusEnum('status').notNull().default('pending'),
    approverId: uuid('approver_id').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectReason: text('reject_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employeeIdx: index('leave_requests_employee_idx').on(t.employeeId),
    statusIdx: index('leave_requests_status_idx').on(t.status),
  })
);

export const employeePerformances = pgTable(
  'employee_performances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    totalTransactions: integer('total_transactions').notNull().default(0),
    totalSales: numeric('total_sales', { precision: 15, scale: 2 }).notNull().default('0'),
    attendanceScore: numeric('attendance_score', { precision: 5, scale: 2 }),
    performanceScore: numeric('performance_score', { precision: 5, scale: 2 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    employeeIdx: index('employee_performances_employee_idx').on(t.employeeId),
    periodIdx: index('employee_performances_period_idx').on(t.periodStart, t.periodEnd),
  })
);

export type Employee = typeof employees.$inferSelect;
export type Attendance = typeof attendances.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type EmployeePerformance = typeof employeePerformances.$inferSelect;
