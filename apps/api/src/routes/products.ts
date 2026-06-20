/**
 * Product routes — POS catalog (read) + Admin Gudang CRUD + image upload.
 * Phase 3 Gate 2 extension.
 */

import { Elysia, t } from 'elysia';
import { productService } from '../services/product.service.js';
import { getAuthUser, requireRole } from '../lib/auth-helper.js';
import { stockService } from '../services/stock.service.js';

export const productRoutes = new Elysia({ prefix: '/api/products', tags: ['Products'] })

  // ===== Read (Phase 2 preserved, all roles) =====

  .get('/', async ({ query, jwt, headers }) => {
    const user = await getAuthUser(jwt, headers);
    const outletId = (query.outletId as string) || user.outletId!;
    const result = await productService.search({
      q: query.q as string | undefined,
      outletId,
      categoryId: query.categoryId as string | undefined,
      supplierId: query.supplierId as string | undefined,
      status: query.status as any,
      sort: query.sort as any,
      order: query.order as any,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });
    return { ok: true, data: result };
  })

  .get('/barcode/:barcode', async ({ params, jwt, headers }) => {
    await getAuthUser(jwt, headers);
    return { ok: true, data: await productService.getByBarcode(params.barcode) };
  })

  .get('/:id', async ({ params, jwt, headers }) => {
    await getAuthUser(jwt, headers);
    return { ok: true, data: await productService.getById(params.id) };
  })

  .get('/:id/stock-movements', async ({ params, jwt, headers, query }) => {
    const user = await getAuthUser(jwt, headers);
    const outletId = (query.outletId as string) || user.outletId!;
    return {
      ok: true,
      data: await stockService.getMovements({
        productId: params.id,
        outletId,
        type: query.type as any,
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      }),
    };
  }, {
    query: t.Object({
      outletId: t.Optional(t.String()),
      type: t.Optional(t.String()),
      limit: t.Optional(t.Number()),
      offset: t.Optional(t.Number()),
    }),
  })

  // ===== Admin Gudang CRUD (Phase 3) =====

  .post('/', async ({ body, jwt, headers }) => {
    const user = await requireRole(jwt, headers, ['admin_gudang', 'manager']);
    return {
      ok: true,
      data: await productService.create({
        outletId: body.outletId ?? user.outletId!,
        ...body,
      }),
    };
  }, {
    body: t.Object({
      outletId: t.Optional(t.String()),
      categoryId: t.String(),
      supplierId: t.Optional(t.String()),
      sku: t.String({ minLength: 1, maxLength: 100 }),
      barcode: t.Optional(t.String()),
      name: t.String({ minLength: 1, maxLength: 200 }),
      description: t.Optional(t.String()),
      purchasePrice: t.String(),
      sellingPrice: t.String(),
      stockMin: t.Optional(t.Number()),
      stockMax: t.Optional(t.Number()),
      unit: t.Optional(t.String()),
    }),
  })

  .patch('/:id', async ({ params, body, jwt, headers }) => {
    await requireRole(jwt, headers, ['admin_gudang', 'manager']);
    return { ok: true, data: await productService.update(params.id, body) };
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      description: t.Optional(t.String()),
      categoryId: t.Optional(t.String()),
      supplierId: t.Optional(t.String()),
      barcode: t.Optional(t.String()),
      purchasePrice: t.Optional(t.String()),
      sellingPrice: t.Optional(t.String()),
      stockMin: t.Optional(t.Number()),
      stockMax: t.Optional(t.Number()),
      unit: t.Optional(t.String()),
      status: t.Optional(t.Union(['aktif', 'stok_tipis', 'habis', 'nonaktif'])),
    }),
  })

  .delete('/:id', async ({ params, jwt, headers }) => {
    await requireRole(jwt, headers, ['admin_gudang', 'manager']);
    return { ok: true, data: await productService.softDelete(params.id) };
  })

  // ===== Image management =====

  .post('/:id/image', async ({ params, request, jwt, headers }) => {
    await requireRole(jwt, headers, ['admin_gudang', 'manager']);
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      throw new Error('File tidak ditemukan di form data');
    }
    const isPrimary = formData.get('isPrimary') === 'true';
    const sortOrder = formData.get('sortOrder') ? Number(formData.get('sortOrder')) : undefined;

    const data = new Uint8Array(await file.arrayBuffer());
    const image = await productService.uploadImage(
      params.id,
      { data, type: file.type, name: file.name, size: file.size },
      { isPrimary, sortOrder },
    );
    return { ok: true, data: image };
  })

  .delete('/:id/image/:imageId', async ({ params, jwt, headers }) => {
    await requireRole(jwt, headers, ['admin_gudang', 'manager']);
    return { ok: true, data: await productService.deleteImage(params.id, params.imageId) };
  })

  .post('/:id/image/:imageId/primary', async ({ params, jwt, headers }) => {
    await requireRole(jwt, headers, ['admin_gudang', 'manager']);
    return { ok: true, data: await productService.setPrimaryImage(params.id, params.imageId) };
  })

  // ===== Stock operations =====

  .post('/:id/restock', async ({ params, body, jwt, headers }) => {
    const user = await requireRole(jwt, headers, ['admin_gudang', 'manager']);
    return {
      ok: true,
      data: await stockService.restock({
        productId: params.id,
        outletId: body.outletId ?? user.outletId!,
        quantity: body.quantity,
        notes: body.notes,
        user,
      }),
    };
  }, {
    body: t.Object({
      outletId: t.Optional(t.String()),
      quantity: t.Number({ minimum: 1 }),
      notes: t.Optional(t.String()),
    }),
  })

  .post('/restock-bulk', async ({ body, jwt, headers }) => {
    const user = await requireRole(jwt, headers, ['admin_gudang', 'manager']);
    return {
      ok: true,
      data: await stockService.restockBulk({
        outletId: body.outletId ?? user.outletId!,
        items: body.items,
        user,
      }),
    };
  }, {
    body: t.Object({
      outletId: t.Optional(t.String()),
      items: t.Array(t.Object({
        productId: t.String(),
        quantity: t.Number({ minimum: 1 }),
        notes: t.Optional(t.String()),
      }), { minItems: 1, maxItems: 200 }),
    }),
  });