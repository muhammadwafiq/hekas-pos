/**
 * Surat Jalan routes — Gate 3.
 * Phase 4.
 *
 * Endpoints:
 *   GET    /api/surat-jalan          list + filter
 *   GET    /api/surat-jalan/:id      detail + items + history
 *   POST   /api/surat-jalan          create draft (admin_gudang)
 *   POST   /api/surat-jalan/:id/review-gudang   submit for approval (admin_gudang)
 *   POST   /api/surat-jalan/:id/approve         approve (manager)
 *   POST   /api/surat-jalan/:id/reject          reject (manager)
 *   POST   /api/surat-jalan/:id/mark-sent       mark delivered (admin_gudang)
 *   GET    /api/surat-jalan/:id/pdf             download PDF
 */

import { Elysia, t } from 'elysia';
import { getAuthUser } from '../lib/auth-helper.js';
import { authorize as requireRole } from '../lib/authorize.js';
import { suratService } from '../services/surat.service.js';
import { renderSuratJalanPdf } from '../services/pdf-sj.service.js';

export const suratJalanRoutes = new Elysia({ prefix: '/api/surat-jalan', tags: ['Surat Jalan'] })

  .get('/', async ({ jwt, query, headers }: any) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return suratService.list({
      outletId: query.outletId as string | undefined,
      status: query.status as string | undefined,
      limit: Number(query.limit ?? 50),
      offset: Number(query.offset ?? 0),
    });
  })

  .get('/:id', async ({ jwt, params, headers }: any) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return suratService.getDetail(params.id);
  })

  .post(
    '/',
    async ({ jwt, body, headers, set }: any) => {
      const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
      const result = await suratService.create({
        outletId: body.outletId,
        destination: body.destination,
        recipientName: body.recipientName,
        recipientPhone: body.recipientPhone,
        notes: body.notes,
        outgoingGoodId: body.outgoingGoodId,
        items: body.items,
        createdBy: user.id,
      });
      set.status = 201;
      return result;
    },
    {
      body: t.Object({
        outletId: t.String(),
        destination: t.String({ minLength: 1 }),
        recipientName: t.String({ minLength: 1 }),
        recipientPhone: t.Optional(t.String()),
        notes: t.Optional(t.String()),
        outgoingGoodId: t.Optional(t.String()),
        items: t.Optional(
          t.Array(
            t.Object({
              productId: t.String(),
              quantity: t.Number({ minimum: 1 }),
              notes: t.Optional(t.String()),
            })
          )
        ),
      }),
    }
  )

  .post('/:id/review-gudang', async ({ jwt, params, body, headers }: any) => {
    const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang']);
    return suratService.reviewGudang(params.id, user, body?.notes);
  })

  .post('/:id/approve', async ({ jwt, params, body, headers }: any) => {
    const user = await requireRole(await getAuthUser(jwt, headers), ['manager']);
    return suratService.approve(params.id, user, body?.notes);
  })

  .post(
    '/:id/reject',
    async ({ jwt, params, body, headers }: any) => {
      const user = await requireRole(await getAuthUser(jwt, headers), ['manager']);
      return suratService.reject(params.id, user, body.reason);
    },
    {
      body: t.Object({
        reason: t.String({ minLength: 1 }),
      }),
    }
  )

  .post('/:id/mark-sent', async ({ jwt, params, headers }: any) => {
    const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return suratService.markSent(params.id, user);
  })

  .get('/:id/pdf', async ({ jwt, params, headers, set }: any) => {
    await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    const sj = await suratService.getDetail(params.id);
    const pdf = await renderSuratJalanPdf({ sj, outletName: sj.destination });
    set.headers['content-type'] = 'application/pdf';
    set.headers['content-disposition'] = `inline; filename="SJ-${sj.documentNumber.replace(/\//g, '_')}.pdf"`;
    return pdf;
  });