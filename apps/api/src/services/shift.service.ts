/**
 * Shift service — start/end shift lifecycle for cashiers.
 *
 * Business rules:
 * - One active shift per cashier at a time
 * - endingCash - expectedCash = cashDifference (positive = over, negative = short)
 * - Cannot end a non-active shift
 */

import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { shiftRepo } from '../repositories/shift.repo.js';
import { users } from '../db/schema/auth.js';
import { ConflictError, NotFoundError } from '../lib/errors.js';
import type {
  Shift,
  ShiftStartOpts,
  ShiftEndOpts,
  ShiftListOpts,
} from '../types/services.js';

export const shiftService = {
  /**
   * Start a new shift for a cashier.
   * @throws ConflictError if cashier already has active shift
   * @throws NotFoundError if cashier doesn't exist
   */
  async startShift(opts: ShiftStartOpts): Promise<Shift> {
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

  /**
   * End a shift, computing expected cash from sum of transactions.
   * @throws NotFoundError if shift doesn't exist
   * @throws ConflictError if shift is not active
   */
  async endShift(opts: ShiftEndOpts): Promise<Shift> {
    const shift = await shiftRepo.findById(opts.shiftId);
    if (!shift) throw new NotFoundError('Shift');
    if (shift.status !== 'aktif') {
      throw new ConflictError(`Shift is not active (current: ${shift.status})`);
    }

    const expectedCash = Number(shift.expectedCash) + Number(shift.totalSales ?? '0');
    const diff = opts.endingCash - expectedCash;

    return shiftRepo.endShift(opts.shiftId, {
      endingCash: opts.endingCash,
      expectedCash,
      cashDifference: diff,
      totalTransactions: shift.totalTransactions ?? 0,
      totalSales: Number(shift.totalSales ?? '0'),
      status: 'selesai',
      notes: opts.notes,
    });
  },

  /** Get the cashier's currently active shift (or null). */
  async getCurrentShift(cashierId: string): Promise<Shift | null> {
    return shiftRepo.findActive(cashierId);
  },

  /** Get shift by ID. */
  async getById(id: string): Promise<Shift> {
    const shift = await shiftRepo.findById(id);
    if (!shift) throw new NotFoundError('Shift');
    return shift;
  },

  /** List shifts with filters and pagination. */
  async list(opts: ShiftListOpts): Promise<Shift[]> {
    return shiftRepo.list(opts);
  },
};
