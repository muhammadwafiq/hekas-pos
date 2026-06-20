/**
 * Reports routes — Excel/PDF export endpoints.
 * Phase 6.
 * Role: manager + admin_gudang
 */

import { Elysia, t } from 'elysia';
import { getAuthUser } from '../lib/auth-helper.js';
import { authorize } from '../lib/authorize.js';
import { reportsService, type ReportFormat, type ReportRange } from '../reports/reports.service.js';
import { BusinessRuleError } from '../lib/errors.js';

const rangeSchema = t.Optional(
  t.Union([
    t.Literal('today'),
    t.Literal('week'),
    t.Literal('month'),
    t.Literal('all'),
  ]),
);

const formatSchema = t.Optional(
  t.Union([t.Literal('excel'), t.Literal('pdf')]),
);

function ensureOutlet(outletId: string | null | undefined): string {
  if (!outletId) {
    throw new BusinessRuleError('User has no outlet assigned');
  }
  return outletId;
}

function setBinaryResponse(
  set: any,
  contentType: string,
  filename: string,
): void {
  set.headers = {
    ...(set.headers ?? {}),
    'content-type': contentType,
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'no-store',
  };
}

export const reportRoutes = new Elysia({ prefix: '/api/reports', tags: ['Reports'] })
  .get(
    '/sales',
    async ({ jwt, query, headers, set }) => {
      const user = await authorize(await getAuthUser(jwt, headers), [
        'manager',
        'admin_gudang',
      ]);
      const outletId = ensureOutlet(user.outletId);
      const result = await reportsService.sales({
        outletId,
        range: (query.range as ReportRange) ?? 'today',
        format: (query.format as ReportFormat) ?? 'excel',
      });
      setBinaryResponse(set, result.contentType, result.filename);
      return result.buffer;
    },
    {
      query: t.Object({ range: rangeSchema, format: formatSchema }),
    },
  )
  .get(
    '/inventory',
    async ({ jwt, query, headers, set }) => {
      const user = await authorize(await getAuthUser(jwt, headers), [
        'manager',
        'admin_gudang',
      ]);
      const outletId = ensureOutlet(user.outletId);
      const result = await reportsService.inventory({
        outletId,
        format: (query.format as ReportFormat) ?? 'excel',
      });
      setBinaryResponse(set, result.contentType, result.filename);
      return result.buffer;
    },
    {
      query: t.Object({ format: formatSchema }),
    },
  )
  .get(
    '/transactions',
    async ({ jwt, query, headers, set }) => {
      const user = await authorize(await getAuthUser(jwt, headers), [
        'manager',
        'admin_gudang',
      ]);
      const outletId = ensureOutlet(user.outletId);
      const result = await reportsService.transactions({
        outletId,
        range: (query.range as ReportRange) ?? 'today',
        format: (query.format as ReportFormat) ?? 'excel',
      });
      setBinaryResponse(set, result.contentType, result.filename);
      return result.buffer;
    },
    {
      query: t.Object({ range: rangeSchema, format: formatSchema }),
    },
  );
