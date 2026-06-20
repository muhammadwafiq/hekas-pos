/**
 * HR service — employees, attendance, leave requests.
 * Phase 6 (HR module).
 */

import { db } from '../config/database.js';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { employees, attendances, leaveRequests } from '../db/schema/hr.js';
import { users } from '../db/schema/auth.js';
import { NotFoundError, BusinessRuleError } from '../lib/errors.js';
import { startOfDayJakarta, endOfDayJakarta } from '../lib/timezone.js';

// ====== Employees ======

export const hrService = {
  // List employees in outlet (active + inactive)
  async listEmployees(opts: { outletId: string; includeInactive?: boolean }) {
    const { outletId, includeInactive = false } = opts;
    const rows = await db
      .select({
        id: employees.id,
        userId: employees.userId,
        fullName: employees.fullName,
        nik: employees.nik,
        phone: employees.phone,
        email: employees.email,
        position: employees.position,
        joinDate: employees.joinDate,
        resignDate: employees.resignDate,
        baseSalary: employees.baseSalary,
        isActive: employees.isActive,
        username: users.username,
        role: users.role,
        createdAt: employees.createdAt,
      })
      .from(employees)
      .leftJoin(users, eq(users.id, employees.userId))
      .where(
        and(
          eq(employees.outletId, outletId),
          includeInactive ? undefined : eq(employees.isActive, true),
        ),
      )
      .orderBy(asc(employees.fullName));
    return rows;
  },

  async getEmployeeById(id: string) {
    const [row] = await db
      .select()
      .from(employees)
      .where(eq(employees.id, id))
      .limit(1);
    if (!row) throw new NotFoundError('Employee not found');
    return row;
  },

  async createEmployee(input: {
    outletId: string;
    userId?: string;
    fullName: string;
    nik?: string;
    phone?: string;
    email?: string;
    position?: string;
    joinDate: string; // YYYY-MM-DD
    baseSalary?: string;
  }) {
    const [created] = await db
      .insert(employees)
      .values({
        outletId: input.outletId,
        userId: input.userId ?? null,
        fullName: input.fullName,
        nik: input.nik ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        position: input.position ?? null,
        joinDate: input.joinDate,
        baseSalary: input.baseSalary ?? '0',
      })
      .returning();
    return created;
  },

  async updateEmployee(
    id: string,
    patch: Partial<{
      fullName: string;
      nik: string;
      phone: string;
      email: string;
      position: string;
      baseSalary: string;
      isActive: boolean;
      resignDate: string;
    }>,
  ) {
    const [updated] = await db
      .update(employees)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(employees.id, id))
      .returning();
    if (!updated) throw new NotFoundError('Employee not found');
    return updated;
  },

  // ====== Attendance ======

  async listAttendance(opts: {
    outletId: string;
    from?: string;
    to?: string;
    employeeId?: string;
    limit?: number;
  }) {
    const { outletId, from, to, employeeId, limit = 200 } = opts;
    const fromIso = from ? startOfDayJakarta(from).toISOString() : null;
    const toIso = to ? endOfDayJakarta(to).toISOString() : null;
    const conditions = [eq(attendances.outletId, outletId)];
    if (fromIso) conditions.push(gte(attendances.checkInAt, sql`${fromIso}::timestamp`));
    if (toIso) conditions.push(lte(attendances.checkInAt, sql`${toIso}::timestamp`));
    if (employeeId) conditions.push(eq(attendances.employeeId, employeeId));

    const rows = await db
      .select({
        id: attendances.id,
        employeeId: attendances.employeeId,
        employeeName: employees.fullName,
        shiftId: attendances.shiftId,
        checkInAt: attendances.checkInAt,
        checkOutAt: attendances.checkOutAt,
        status: attendances.status,
        notes: attendances.notes,
      })
      .from(attendances)
      .innerJoin(employees, eq(employees.id, attendances.employeeId))
      .where(and(...conditions))
      .orderBy(desc(attendances.checkInAt))
      .limit(limit);
    return rows;
  },

  async todayAttendanceByEmployee(employeeId: string) {
    const todayStart = startOfDayJakarta(new Date());
    const todayEnd = endOfDayJakarta(new Date());
    const [row] = await db
      .select()
      .from(attendances)
      .where(
        and(
          eq(attendances.employeeId, employeeId),
          gte(attendances.checkInAt, sql`${todayStart.toISOString()}::timestamp`),
          lte(attendances.checkInAt, sql`${todayEnd.toISOString()}::timestamp`),
        ),
      )
      .orderBy(desc(attendances.checkInAt))
      .limit(1);
    return row ?? null;
  },

  // Idempotent clock-in: if open record exists for today, return it
  async clockIn(input: { employeeId: string; outletId: string; shiftId?: string; notes?: string }) {
    const existing = await this.todayAttendanceByEmployee(input.employeeId);
    if (existing && !existing.checkOutAt) {
      throw new BusinessRuleError('Sudah clock-in hari ini, lakukan clock-out dulu');
    }
    const [created] = await db
      .insert(attendances)
      .values({
        employeeId: input.employeeId,
        outletId: input.outletId,
        shiftId: input.shiftId ?? null,
        checkInAt: new Date(),
        status: 'hadir',
        notes: input.notes ?? null,
      })
      .returning();
    return created;
  },

  async clockOut(input: { employeeId: string; notes?: string }) {
    const open = await this.todayAttendanceByEmployee(input.employeeId);
    if (!open) throw new BusinessRuleError('Belum clock-in hari ini');
    if (open.checkOutAt) throw new BusinessRuleError('Sudah clock-out hari ini');
    const [updated] = await db
      .update(attendances)
      .set({ checkOutAt: new Date(), notes: input.notes ?? open.notes })
      .where(eq(attendances.id, open.id))
      .returning();
    return updated;
  },

  // ====== Leave requests ======

  async listLeaveRequests(opts: { outletId: string; status?: string; employeeId?: string }) {
    const { outletId, status, employeeId } = opts;
    const conditions = [eq(leaveRequests.employeeId, employees.id), eq(employees.outletId, outletId)];
    if (status) conditions.push(eq(leaveRequests.status, status as any));
    if (employeeId) conditions.push(eq(leaveRequests.employeeId, employeeId));

    return db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        employeeName: employees.fullName,
        leaveType: leaveRequests.leaveType,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        totalDays: leaveRequests.totalDays,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        approverId: leaveRequests.approverId,
        approvedAt: leaveRequests.approvedAt,
        rejectReason: leaveRequests.rejectReason,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.createdAt));
  },

  async createLeaveRequest(input: {
    employeeId: string;
    leaveType: 'tahunan' | 'sakit' | 'penting' | 'melahirkan' | 'lainnya';
    startDate: string;
    endDate: string;
    reason: string;
  }) {
    const totalDays = computeLeaveDays(input.startDate, input.endDate);
    if (totalDays <= 0) throw new BusinessRuleError('endDate harus setelah startDate');
    const [created] = await db
      .insert(leaveRequests)
      .values({
        employeeId: input.employeeId,
        leaveType: input.leaveType,
        startDate: input.startDate,
        endDate: input.endDate,
        totalDays,
        reason: input.reason,
        status: 'pending',
      })
      .returning();
    return created;
  },

  async approveLeaveRequest(id: string, approverId: string) {
    const [updated] = await db
      .update(leaveRequests)
      .set({ status: 'approved', approverId, approvedAt: new Date() })
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.status, 'pending')))
      .returning();
    if (!updated) throw new NotFoundError('Leave request not found or not pending');
    return updated;
  },

  async rejectLeaveRequest(id: string, approverId: string, rejectReason: string) {
    if (!rejectReason?.trim()) throw new BusinessRuleError('Reject reason required');
    const [updated] = await db
      .update(leaveRequests)
      .set({ status: 'rejected', approverId, approvedAt: new Date(), rejectReason })
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.status, 'pending')))
      .returning();
    if (!updated) throw new NotFoundError('Leave request not found or not pending');
    return updated;
  },

  // ====== Aggregate helpers ======

  // Today summary (counts + first check-in / last check-out)
  async todaySummary(outletId: string) {
    const todayStart = startOfDayJakarta(new Date());
    const todayEnd = endOfDayJakarta(new Date());
    const [summary] = await db
      .select({
        present: sql<number>`count(*) filter (where ${attendances.status} = 'hadir')::int`,
        izin: sql<number>`count(*) filter (where ${attendances.status} = 'izin')::int`,
        sakit: sql<number>`count(*) filter (where ${attendances.status} = 'sakit')::int`,
        cuti: sql<number>`count(*) filter (where ${attendances.status} = 'cuti')::int`,
        alpha: sql<number>`count(*) filter (where ${attendances.status} = 'alpha')::int`,
        checkedIn: sql<number>`count(*) filter (where ${attendances.checkOutAt} is null)::int`,
        completed: sql<number>`count(*) filter (where ${attendances.checkOutAt} is not null)::int`,
      })
      .from(attendances)
      .where(
        and(
          eq(attendances.outletId, outletId),
          gte(attendances.checkInAt, sql`${todayStart.toISOString()}::timestamp`),
          lte(attendances.checkInAt, sql`${todayEnd.toISOString()}::timestamp`),
        ),
      );
    return summary ?? { present: 0, izin: 0, sakit: 0, cuti: 0, alpha: 0, checkedIn: 0, completed: 0 };
  },
};

function computeLeaveDays(startDate: string, endDate: string): number {
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const diffMs = e.getTime() - s.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}
