/**
 * Supplier routes — Admin Gudang supplier CRUD.
 */

import { Elysia, t } from 'elysia';
import { getAuthUser } from '../lib/auth-helper.js';
import { authorize as requireRole } from '../lib/authorize.js';
import { supplierRepo } from '../repositories/supplier.repo.js';

export const supplierRoutes = new Elysia({ prefix: '/api/suppliers', tags: ['Suppliers'] })
  .get('/', async ({ jwt, query, headers, set }) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return supplierRepo.list({
      q: query.q,
      active: query.active === undefined ? undefined : query.active === 'true',
      limit: query.limit,
      offset: query.offset,
    });
  }, {
    query: t.Object({
      q: t.Optional(t.String()),
      active: t.Optional(t.String()),
      limit: t.Optional(t.Integer({ minimum: 1, maximum: 200 })),
      offset: t.Optional(t.Integer({ minimum: 0 })),
    }),
  })

  .get('/:id', async ({ jwt, params, headers, set }) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return supplierRepo.getById(params.id);
  })

  .post('/', async ({ jwt, body, headers, set }) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return supplierRepo.create(body as any);
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 200 }),
      contactPerson: t.Optional(t.String()),
      phone: t.Optional(t.String()),
      email: t.Optional(t.String()),
      address: t.Optional(t.String()),
      notes: t.Optional(t.String()),
      isActive: t.Optional(t.Boolean()),
    }),
  })

  .patch('/:id', async ({ jwt, params, body, headers, set }) =>  {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return supplierRepo.update(params.id, body as any);
  })

  .delete('/:id', async ({ jwt, params, headers, set }) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return supplierRepo.softDelete(params.id);
  });