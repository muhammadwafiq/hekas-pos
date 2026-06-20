/**
 * Held-draft routes — save/resume incomplete POS orders.
 */

import { Elysia } from 'elysia';
import { z } from 'zod';
import { heldDraftService } from '../services/held-draft.service.js';
import { getAuthUser } from '../lib/auth-helper.js';
import { ValidationError } from '../lib/errors.js';

const SaveDraftSchema = z.object({
  draftData: z.any(), // flexible JSON
  notes: z.string().max(500).optional(),
  ttlHours: z.number().int().positive().max(168).optional(), // max 1 week
});

export const heldDraftRoutes = new Elysia({ prefix: '/api/held-drafts', tags: ['Held Drafts'] })
  .post('/', async ({ body, jwt, headers }) => {
    const user = await getAuthUser(jwt, headers);
    const parsed = SaveDraftSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid request', { issues: parsed.error.issues });

    const draft = await heldDraftService.save({
      cashierId: user.id,
      outletId: user.outletId!,
      draftData: parsed.data.draftData,
      notes: parsed.data.notes,
      ttlHours: parsed.data.ttlHours,
    });
    return { ok: true, data: draft };
  })

  .get('/:id', async ({ params, jwt, headers }) => {
    await getAuthUser(jwt, headers);
    return { ok: true, data: await heldDraftService.getById(params.id) };
  })

  .get('/', async ({ query, jwt, headers }) => {
    const user = await getAuthUser(jwt, headers);
    return {
      ok: true,
      data: await heldDraftService.list({
        outletId: user.outletId!,
        cashierId: query.cashierId as string | undefined,
      }),
    };
  })

  .delete('/:id', async ({ params, jwt, headers }) => {
    await getAuthUser(jwt, headers);
    await heldDraftService.delete(params.id);
    return { ok: true, data: { message: 'Draft deleted' } };
  });
