/**
 * Stock routes — current stock per product + movements history.
 */

import { Elysia } from 'elysia';
import { stockService } from '../services/stock.service.js';
import { getAuthUser } from '../lib/auth-helper.js';

export const stockRoutes = new Elysia({ prefix: '/api/stocks', tags: ['Stock'] })
  .get('/product/:productId', async ({ params, jwt, headers }: any) => {
    const user = await getAuthUser(jwt, headers);
    return {
      ok: true,
      data: await stockService.getStock(params.productId, user.outletId!),
    };
  })

  .get('/product/:productId/movements', async ({ params, jwt, headers, query }: any) => {
    const user = await getAuthUser(jwt, headers);
    return {
      ok: true,
      data: await stockService.getMovements({
        productId: params.productId,
        outletId: user.outletId!,
        limit: Number(query.limit ?? 50),
        offset: Number(query.offset ?? 0),
      }),
    };
  })

  .get('/movements', async ({ jwt, headers, query }: any) => {
    const user = await getAuthUser(jwt, headers);
    return {
      ok: true,
      data: await stockService.getMovements({
        outletId: user.outletId!,
        limit: Number(query.limit ?? 50),
        offset: Number(query.offset ?? 0),
      }),
    };
  })

  .get('/low-stock', async ({ jwt, headers }: any) => {
    const user = await getAuthUser(jwt, headers);
    return { ok: true, data: await stockService.getLowStock(user.outletId!) };
  });
