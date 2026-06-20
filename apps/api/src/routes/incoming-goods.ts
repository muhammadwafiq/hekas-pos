/**
 * Incoming goods routes — Purchase Order CRUD + verify + reject.
 */

import { Elysia, t } from 'elysia';
import { getAuthUser } from '../lib/auth-helper.js';
import { authorize as requireRole } from '../lib/authorize.js';
import { incomingService } from '../services/incoming.service.js';
import { NotFoundError } from '../lib/errors.js';

export const incomingRoutes = new Elysia({ prefix: '/api/incoming-goods', tags: ['Incoming Goods'] })

  .get('/', async ({ jwt, query, headers, set }) => {
    const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    const outletId = (query.outletId as string) ?? user.outletId;
    if (!outletId) throw new NotFoundError('outletId required');
    const status = query.status as any;
    const limit = Number(query.limit ?? 50);
    const offset = Number(query.offset ?? 0);
    return incomingService.list({ outletId, status, limit, offset });
  })

  .get('/:id', async ({ jwt, params, headers, set }) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return incomingService.getDetail(params.id);
  })

  .post(
    '/',
    async ({ jwt, body, headers, set }) => {
      const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
      const { outletId, supplierId, notes, items } = body as any;
      if (!outletId || !supplierId || !Array.isArray(items) || items.length === 0) {
        throw new NotFoundError('outletId, supplierId, items required');
      }
      return incomingService.create({
        outletId,
        supplierId,
        notes,
        items,
        user,
      });
    },
    {
      body: t.Object({
        outletId: t.String(),
        supplierId: t.String(),
        notes: t.Optional(t.String()),
        items: t.Array(
          t.Object({
            productId: t.String(),
            quantity: t.Integer({ minimum: 1 }),
            purchasePrice: t.String(),
          })
        ),
      }),
    }
  )

  .post(
    '/:id/verify',
    async ({ jwt, params, body, headers, set }) => {
      const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
      const { items } = body as any;
      if (!Array.isArray(items) || items.length === 0) throw new NotFoundError('items required');
      return incomingService.verify({ id: params.id, items, user });
    },
    {
      body: t.Object({
        items: t.Array(
          t.Object({
            id: t.String(),
            quantityReceived: t.Integer({ minimum: 0 }),
          })
        ),
      }),
    }
  )

  .post(
    '/:id/reject',
    async ({ jwt, params, body, headers, set }) => {
      const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
      const { reason } = body as any;
      if (!reason) throw new NotFoundError('reason required');
      return incomingService.reject({ id: params.id, reason, user });
    },
    { body: t.Object({ reason: t.String() }) }
  );