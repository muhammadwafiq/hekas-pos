/**
 * Shift routes — start/end/current shift.
 * Auth is inlined (not middleware-derived) for reliability across Elysia plugin boundaries.
 */

import { Elysia } from 'elysia';
import { z } from 'zod';
import { shiftService } from '../services/shift.service.js';
import { getAuthUser } from '../lib/auth-helper.js';
import { ValidationError } from '../lib/errors.js';

const StartShiftSchema = z.object({
  outletId: z.string().uuid().optional(),
  startingCash: z.number().nonnegative(),
  notes: z.string().max(500).optional(),
});

const EndShiftSchema = z.object({
  endingCash: z.number().nonnegative(),
  notes: z.string().max(500).optional(),
});

export const shiftRoutes = new Elysia({ prefix: '/api/shifts', tags: ['Shifts'] })
  .post('/start', async ({ body, user: _u, jwt, headers }: any) => {
    const user = await getAuthUser(jwt, headers);
    const parsed = StartShiftSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid request', { issues: parsed.error.issues });

    const shift = await shiftService.startShift({
      cashierId: user.id,
      outletId: parsed.data.outletId || user.outletId!,
      startingCash: parsed.data.startingCash,
      notes: parsed.data.notes,
    });
    return { ok: true, data: shift };
  })

  .post('/:id/end', async ({ params, body, jwt, headers }: any) => {
    const user = await getAuthUser(jwt, headers);
    const parsed = EndShiftSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid request', { issues: parsed.error.issues });

    const shift = await shiftService.endShift({
      shiftId: params.id,
      endingCash: parsed.data.endingCash,
      notes: parsed.data.notes,
    });
    return { ok: true, data: shift };
  })

  .get('/current', async ({ jwt, headers }: any) => {
    const user = await getAuthUser(jwt, headers);
    const shift = await shiftService.getCurrentShift(user.id);
    return { ok: true, data: shift };
  })

  .get('/:id', async ({ params, jwt, headers }: any) => {
    await getAuthUser(jwt, headers);
    return { ok: true, data: await shiftService.getById(params.id) };
  })

  .get('/', async ({ query, jwt, headers }: any) => {
    const user = await getAuthUser(jwt, headers);
    return {
      ok: true,
      data: await shiftService.list({
        outletId: (query.outletId as string) || user.outletId!,
        cashierId: query.cashierId as string | undefined,
        status: query.status as 'aktif' | 'selesai' | 'ditutup_paksa' | undefined,
        limit: Number(query.limit ?? 50),
        offset: Number(query.offset ?? 0),
      }),
    };
  });
