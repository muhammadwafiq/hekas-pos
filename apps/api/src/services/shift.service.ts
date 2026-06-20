/**
 * Shift service — start/end shift lifecycle.
 */

import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { shiftRepo } from '../repositories/shift.repo.js';
import { users } from '../db/schema/auth.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';

export const shiftService = {
  async startShift(opts: { cashierId: string; outletId: string; startingCash: number; notes?: string }) {
    // Check no active shift
    const active = await shiftRepo.findActive(opts.cashierId);
    if (active) {
      throw new ConflictError('Cashier already has an active shift', { shiftId: active.id });
    }

    // Verify cashier exists
    const [cashier] = await db.select().from(users).where(eq(users.id, opts.cashierId)).limit(1);
    if (!cashier) throw new NotFoundError('Cashier');

    const shiftCode = `SHF-${Date.now().toString(36).toUpperCase()}`;

    return shiftRepo.create({
      shiftCode,
      outletId: opts.outletId,
      cashierId: opts.cashierId,
      cashierName: cashier.fullName,
      startedAt: new Date(),
      startingCash: opts.startingCash.toString(),
      expectedCash: opts.startingCash.toString(),
      status: 'aktif',
      notes: opts.notes,
    });
  },

  async endShift(opts: { shiftId: string; endingCash: number; notes?: string }) {
    const shift = await shiftRepo.findById(opts.shiftId);
    if (!shift) throw new NotFoundError('Shift');
    if (shift.status !== 'aktif') {
      throw new ConflictError(`Shift is not active (current: ${shift.status})`);
    }

    const expectedCash = Number(shift.expectedCash) + Number(shift.totalSales ?? '0');
    const diff = opts.endingCash - expectedCash;

    return shiftRepo.endShift(opts.shiftId, {
      endingCash: opts.endingCash.toString(),
      expectedCash: expectedCash.toString(),
      cashDifference: diff.toString(),
      totalTransactions: shift.totalTransactions ?? 0,
      totalSales: shift.totalSales ?? '0',
      status: 'selesai',
      notes: opts.notes,
    });
  },

  async getCurrentShift(cashierId: string) {
    return shiftRepo.findActive(cashierId);
  },

  async getById(id: string) {
    const shift = await shiftRepo.findById(id);
    if (!shift) throw new NotFoundError('Shift');
    return shift;
  },

  async list(opts: { outletId?: string; cashierId?: string; status?: string; limit?: number; offset?: number }) {
    return shiftRepo.list(opts);
  },
};
