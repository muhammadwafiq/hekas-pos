/**
 * Held-draft service — save/resume/delete incomplete POS orders.
 */

import { heldDraftRepo } from '../repositories/held-draft.repo.js';
import { NotFoundError } from '../lib/errors.js';

export const heldDraftService = {
  async save(opts: { cashierId: string; outletId: string; draftData: any; notes?: string; ttlHours?: number }) {
    const expiresAt = new Date(Date.now() + (opts.ttlHours ?? 24) * 3600_000);
    return heldDraftRepo.create({
      cashierId: opts.cashierId,
      outletId: opts.outletId,
      draftData: opts.draftData,
      notes: opts.notes,
      expiresAt,
    });
  },

  async getById(id: string) {
    const draft = await heldDraftRepo.findById(id);
    if (!draft) throw new NotFoundError('Held draft');
    return draft;
  },

  async list(opts: { outletId?: string; cashierId?: string }) {
    return heldDraftRepo.list(opts);
  },

  async delete(id: string) {
    await heldDraftRepo.delete(id);
  },
};
