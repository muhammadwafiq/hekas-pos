/**
 * Inventory routes — stock management endpoints (Admin Gudang).
 */

import { Elysia, t } from 'elysia';
import { getAuthUser } from '../lib/auth-helper.js';
import { authorize as requireRole } from '../lib/authorize.js';
import { stockService } from '../services/stock.service.js';
import { dashboardGudangService } from '../services/dashboard-gudang.service.js';
import { productImageRepo } from '../repositories/product-image.repo.js';
import { productService } from '../services/product.service.js';
import { imageUpload } from '../lib/image-upload.js';
import { NotFoundError } from '../lib/errors.js';

export const inventoryRoutes = new Elysia({ prefix: '/api/inventory', tags: ['Inventory'] })
  .get('/summary', async ({ jwt, query, headers, set }: any) => {
    const user = await requireRole(
      await getAuthUser(jwt, headers),
      ['admin_gudang', 'manager'],
    );
    return dashboardGudangService.summary({ outletId: query.outletId ?? user.outletId });
  }, {
    query: t.Object({
      outletId: t.Optional(t.String()),
    }),
  })

  .post('/restock', async ({ jwt, body, headers, set }: any) => {
    const user = await requireRole(
      await getAuthUser(jwt, headers),
      ['admin_gudang', 'manager'],
    );
    return stockService.restock({
      productId: body.productId,
      outletId: body.outletId ?? user.outletId,
      quantity: body.quantity,
      notes: body.notes,
      user,
    });
  }, {
    body: t.Object({
      productId: t.String(),
      outletId: t.Optional(t.String()),
      quantity: t.Integer({ minimum: 1 }),
      notes: t.Optional(t.String()),
    }),
  })

  .post('/restock-bulk', async ({ jwt, body, headers, set }: any) => {
    const user = await requireRole(
      await getAuthUser(jwt, headers),
      ['admin_gudang', 'manager'],
    );
    return stockService.restockBulk({
      outletId: body.outletId ?? user.outletId,
      items: body.items,
      user,
    });
  }, {
    body: t.Object({
      outletId: t.Optional(t.String()),
      items: t.Array(t.Object({
        productId: t.String(),
        quantity: t.Integer({ minimum: 1 }),
        notes: t.Optional(t.String()),
      }), { minItems: 1, maxItems: 200 }),
    }),
  })

  .post('/adjust', async ({ jwt, body, headers, set }: any) => {
    const user = await requireRole(
      await getAuthUser(jwt, headers),
      ['admin_gudang', 'manager'],
    );
    return stockService.adjust({
      productId: body.productId,
      outletId: body.outletId ?? user.outletId,
      type: body.type,
      quantity: body.quantity,
      reason: body.reason,
      notes: body.notes,
      user,
    });
  }, {
    body: t.Object({
      productId: t.String(),
      outletId: t.Optional(t.String()),
      type: t.UnionEnum(['tambah', 'kurang']),
      quantity: t.Integer({ minimum: 1 }),
      reason: t.String({ minLength: 3 }),
      notes: t.Optional(t.String()),
    }),
  })

  .get('/low-stock', async ({ jwt, query, headers, set }: any) => {
    const user = await requireRole(
      await getAuthUser(jwt, headers),
      ['admin_gudang', 'manager', 'kasir'],
    );
    return stockService.getLowStock(query.outletId ?? user.outletId);
  }, {
    query: t.Object({ outletId: t.Optional(t.String()) }),
  });

export const productImageRoutes = new Elysia({ prefix: '/api/products/:id/images', tags: ['Product Images'] })
  .get('/', async ({ params, jwt, headers, set }: any) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager', 'kasir']);
    return productImageRepo.listByProduct(params.id);
  })

  .post('/', async ({ params, body, jwt, headers, set }: any) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    // multipart upload — body must be file
    const file = body as any;
    if (!file) throw new NotFoundError('No file uploaded');
    return productService.uploadImage(params.id, file);
  })

  .delete('/:imageId', async ({ params, jwt, headers, set }: any) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return productService.deleteImage(params.id, params.imageId);
  })

  .put('/:imageId/primary', async ({ params, jwt, headers, set }: any) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return productService.setPrimaryImage(params.id, params.imageId);
  });

/** Static serving for uploaded images. */
export const uploadsRoutes = new Elysia({ prefix: '/api/uploads', tags: ['Uploads'] })
  .get('/*', async ({ jwt, params, set }: any) =>  {
    const path = (params as any)['*'] ?? '';
    const absPath = imageUpload.resolvePath(path);
    const file = Bun.file(absPath);
    if (!(await file.exists())) {
      set.status = 404;
      return { ok: false, error: { code: 'NOT_FOUND', message: 'File not found' } };
    }
    return file;
  });