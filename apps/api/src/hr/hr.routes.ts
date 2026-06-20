/**
 * HR routes — employees, attendance, leave requests.
 * Phase 6 (HR module).
 *
 * Roles:
 *  - manager: full CRUD on employees + leave approval
 *  - admin_gudang: read-only employees, no leave approval
 *  - kasir: clock-in/out for own employee record
 */

import { Elysia, t } from 'elysia';
import { getAuthUser } from '../lib/auth-helper.js';
import { authorize } from '../lib/authorize.js';
import { hrService } from '../hr/hr.service.js';
import { BusinessRuleError, NotFoundError } from '../lib/errors.js';

const dateSchema = t.Optional(
  t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
);

function ensureOutlet(outletId: string | null | undefined): string {
  if (!outletId) {
    throw new BusinessRuleError('User has no outlet assigned');
  }
  return outletId;
}

async function findEmployeeIdForUser(userId: string, outletId: string): Promise<string> {
  const { db } = await import('../config/database.js');
  const { employees } = await import('../db/schema/hr.js');
  const { eq, and } = await import('drizzle-orm');
  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.userId, userId), eq(employees.outletId, outletId)))
    .limit(1);
  if (!row) {
    throw new NotFoundError('No employee record linked to this user');
  }
  return row.id;
}

export const hrRoutes = new Elysia({ prefix: '/api/hr', tags: ['HR'] })
  // ====== Employees ======
  .get(
    '/employees',
    async ({ jwt, query, headers }: any) => {
      const user = await authorize(await getAuthUser(jwt, headers), [
        'manager',
        'admin_gudang',
      ]);
      const outletId = ensureOutlet(user.outletId);
      return hrService.listEmployees({
        outletId,
        includeInactive: query.includeInactive === 'true',
      });
    },
    {
      query: t.Object({
        includeInactive: t.Optional(t.String()),
      }),
    },
  )

  .get(
    '/employees/:id',
    async ({ jwt, params, headers }: any) => {
      await authorize(await getAuthUser(jwt, headers), [
        'manager',
        'admin_gudang',
      ]);
      return hrService.getEmployeeById(params.id);
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  .post(
    '/employees',
    async ({ jwt, body, headers }: any) => {
      const user = await authorize(await getAuthUser(jwt, headers), ['manager']);
      const outletId = ensureOutlet(user.outletId);
      return hrService.createEmployee({
        outletId,
        ...body,
      });
    },
    {
      body: t.Object({
        userId: t.Optional(t.String()),
        fullName: t.String({ minLength: 1, maxLength: 150 }),
        nik: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        email: t.Optional(t.String()),
        position: t.Optional(t.String()),
        joinDate: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
        baseSalary: t.Optional(t.String()),
      }),
    },
  )

  .patch(
    '/employees/:id',
    async ({ jwt, params, body, headers }: any) => {
      await authorize(await getAuthUser(jwt, headers), ['manager']);
      return hrService.updateEmployee(params.id, body);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        fullName: t.Optional(t.String()),
        nik: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        email: t.Optional(t.String()),
        position: t.Optional(t.String()),
        baseSalary: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        resignDate: t.Optional(t.String()),
      }),
    },
  )

  // ====== Attendance ======
  .get(
    '/attendance',
    async ({ jwt, query, headers }: any) => {
      const user = await authorize(await getAuthUser(jwt, headers), [
        'manager',
        'admin_gudang',
      ]);
      const outletId = ensureOutlet(user.outletId);
      return hrService.listAttendance({
        outletId,
        from: query.from,
        to: query.to,
        employeeId: query.employeeId,
      });
    },
    {
      query: t.Object({
        from: dateSchema,
        to: dateSchema,
        employeeId: t.Optional(t.String()),
      }),
    },
  )

  .get(
    '/attendance/today',
    async ({ jwt, query, headers }: any) => {
      const user = await authorize(await getAuthUser(jwt, headers), [
        'manager',
        'admin_gudang',
      ]);
      const outletId = ensureOutlet(user.outletId);
      return hrService.listAttendance({
        outletId,
        from: new Date().toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
        employeeId: query.employeeId,
      });
    },
    {
      query: t.Object({ employeeId: t.Optional(t.String()) }),
    },
  )

  .get(
    '/attendance/today-summary',
    async ({ jwt, headers }: any) => {
      const user = await authorize(await getAuthUser(jwt, headers), [
        'manager',
        'admin_gudang',
      ]);
      const outletId = ensureOutlet(user.outletId);
      return hrService.todaySummary(outletId);
    },
  )

  .post(
    '/attendance/clock-in',
    async ({ jwt, body, headers }: any) => {
      // kasir/admin_gudang/manager can clock-in their own record
      const user = await authorize(await getAuthUser(jwt, headers), [
        'kasir',
        'admin_gudang',
        'manager',
      ]);
      const outletId = ensureOutlet(user.outletId);
      const employeeId = await findEmployeeIdForUser(user.id, outletId);
      return hrService.clockIn({
        employeeId,
        outletId,
        shiftId: body?.shiftId,
        notes: body?.notes,
      });
    },
    {
      body: t.Optional(
        t.Object({
          shiftId: t.Optional(t.String()),
          notes: t.Optional(t.String()),
        }),
      ),
    },
  )

  .post(
    '/attendance/clock-out',
    async ({ jwt, body, headers }: any) => {
      const user = await authorize(await getAuthUser(jwt, headers), [
        'kasir',
        'admin_gudang',
        'manager',
      ]);
      const outletId = ensureOutlet(user.outletId);
      const employeeId = await findEmployeeIdForUser(user.id, outletId);
      return hrService.clockOut({
        employeeId,
        notes: body?.notes,
      });
    },
    {
      body: t.Optional(
        t.Object({ notes: t.Optional(t.String()) }),
      ),
    },
  )

  // ====== Leave requests ======
  .get(
    '/leave-requests',
    async ({ jwt, query, headers }: any) => {
      const user = await authorize(await getAuthUser(jwt, headers), [
        'manager',
        'admin_gudang',
      ]);
      const outletId = ensureOutlet(user.outletId);
      return hrService.listLeaveRequests({
        outletId,
        status: query.status,
        employeeId: query.employeeId,
      });
    },
    {
      query: t.Object({
        status: t.Optional(
          t.Union([
            t.Literal('pending'),
            t.Literal('approved'),
            t.Literal('rejected'),
            t.Literal('cancelled'),
          ]),
        ),
        employeeId: t.Optional(t.String()),
      }),
    },
  )

  .post(
    '/leave-requests',
    async ({ jwt, body, headers }: any) => {
      const user = await authorize(await getAuthUser(jwt, headers), [
        'manager',
        'admin_gudang',
        'kasir',
      ]);
      const outletId = ensureOutlet(user.outletId);
      const employeeId = body.employeeId ?? (await findEmployeeIdForUser(user.id, outletId));
      return hrService.createLeaveRequest({
        employeeId,
        leaveType: body.leaveType,
        startDate: body.startDate,
        endDate: body.endDate,
        reason: body.reason,
      });
    },
    {
      body: t.Object({
        employeeId: t.Optional(t.String()),
        leaveType: t.Union([
          t.Literal('tahunan'),
          t.Literal('sakit'),
          t.Literal('penting'),
          t.Literal('melahirkan'),
          t.Literal('lainnya'),
        ]),
        startDate: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
        endDate: t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
        reason: t.String({ minLength: 1 }),
      }),
    },
  )

  .patch(
    '/leave-requests/:id/approve',
    async ({ jwt, params, headers }: any) => {
      const user = await authorize(await getAuthUser(jwt, headers), ['manager']);
      return hrService.approveLeaveRequest(params.id, user.id);
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  .patch(
    '/leave-requests/:id/reject',
    async ({ jwt, params, body, headers }: any) => {
      const user = await authorize(await getAuthUser(jwt, headers), ['manager']);
      return hrService.rejectLeaveRequest(params.id, user.id, body.rejectReason);
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        rejectReason: t.String({ minLength: 1 }),
      }),
    },
  );
