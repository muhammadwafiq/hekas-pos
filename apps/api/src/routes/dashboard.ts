/**
 * Dashboard routes — Manager + Gudang summary.
 */

import { Elysia } from 'elysia';
import { getAuthUser } from '../lib/auth-helper.js';
import { authorize as requireRole } from '../lib/authorize.js';
import { dashboardGudangService } from '../services/dashboard-gudang.service.js';
import { dashboardManager } from '../services/dashboard-manager.service.js';
import { NotFoundError } from '../lib/errors.js';

export const dashboardRoutes = new Elysia({ prefix: '/api/dashboard', tags: ['Dashboard'] })
  .get('/gudang', async ({ jwt, headers, query, set }) => {
    const user = await getAuthUser(jwt, headers);
    await requireRole(user, ['admin_gudang', 'manager']);
    const outletId = (query.outletId as string) ?? user.outletId;
    if (!outletId) throw new NotFoundError('outletId required');
    return dashboardGudangService.summary({ outletId });
  })

  .get('/manager', async ({ jwt, headers, query, set }) => {
    const user = await getAuthUser(jwt, headers);
    await requireRole(user, ['manager']);
    if (!user.outletId) throw new NotFoundError('User has no outlet');
    const range = (query.range as 'today' | 'week' | 'month' | 'all') ?? 'today';
    return dashboardManager(user.outletId, range);
  });