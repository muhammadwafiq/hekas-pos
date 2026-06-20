/**
 * Outgoing goods routes — Picking + delivery (Admin Gudang).
 */

import { Elysia, t } from 'elysia';
import { getAuthUser } from '../lib/auth-helper.js';
import { authorize as requireRole } from '../lib/authorize.js';
import { outgoingService } from '../services/outgoing.service.js';
import { NotFoundError } from '../lib/errors.js';

export const outgoingRoutes = new Elysia({ prefix: '/api/outgoing-goods', tags: ['Outgoing Goods'] })

  .get('/', async ({ jwt, query, headers, set }: any) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    const outletId = query.outletId as string;
    const status = query.status as any;
    const limit = Number(query.limit ?? 50);
    const offset = Number(query.offset ?? 0);
    if (!outletId) throw new NotFoundError('outletId required');
    return outgoingService.list({ outletId, status, limit, offset });
  })

  .get('/:id', async ({ jwt, params, headers, set }: any) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return outgoingService.getDetail(params.id);
  })

  .post(
    '/',
    async ({ jwt, body, headers, set }: any) => {
      const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
      const { outletId, destination, notes, items, referenceType, referenceId } = body as any;
      if (!outletId || !destination || !Array.isArray(items) || items.length === 0) {
        throw new NotFoundError('outletId, destination, items required');
      }
      return outgoingService.create({ outletId, destination, notes, items, referenceType, referenceId, createdBy: user.id });
    },
    {
      body: t.Object({
        outletId: t.String(),
        destination: t.String(),
        notes: t.Optional(t.String()),
        items: t.Array(t.Object({ productId: t.String(), quantitySent: t.Number({ minimum: 1 }) })),
        referenceType: t.Optional(t.String()),
        referenceId: t.Optional(t.String()),
      }),
    }
  )

  .post(
    '/:id/pick',
    async ({ jwt, params, body, headers, set }: any) => {
      const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
      const { items } = body as any;
      if (!Array.isArray(items) || items.length === 0) throw new NotFoundError('items required');
      return outgoingService.pick({ id: params.id, items, user });
    },
    {
      body: t.Object({
        items: t.Array(
          t.Object({
            id: t.String(),
            quantityPicked: t.Number({ minimum: 0 }),
          })
        ),
      }),
    }
  )

  .post('/:id/mark-sent', async ({ params, jwt, headers, set }: any) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return outgoingService.markSent(params.id);
  })

  .post(
    '/:id/cancel',
    async ({ params, jwt, body, headers, set }: any) => {
      await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
      const { reason } = body as any;
      if (!reason) throw new NotFoundError('reason required');
      return outgoingService.cancel(params.id, reason);
    },
    { body: t.Object({ reason: t.String() }) }
  );