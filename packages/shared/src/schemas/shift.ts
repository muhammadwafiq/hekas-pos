/**
 * Shift schemas.
 */

import { z } from 'zod';

export const ShiftStatusSchema = z.enum(['aktif', 'selesai', 'ditutup_paksa']);
export type ShiftStatus = z.infer<typeof ShiftStatusSchema>;

export const ShiftSchema = z.object({
  id: z.string().uuid(),
  shiftCode: z.string(), // SHF-XXX
  outletId: z.string().uuid(),
  cashierId: z.string().uuid(),
  cashierName: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  startingCash: z.number().nonnegative(),
  endingCash: z.number().nullable(),
  expectedCash: z.number().nullable(),
  cashDifference: z.number().nullable(),
  totalTransactions: z.number().int().nonnegative().default(0),
  totalSales: z.number().nonnegative().default(0),
  status: ShiftStatusSchema,
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type Shift = z.infer<typeof ShiftSchema>;

export const StartShiftSchema = z.object({
  outletId: z.string().uuid(),
  startingCash: z.number().nonnegative().default(0),
  pin: z.string().regex(/^\d{4,6}$/),
});

export type StartShiftInput = z.infer<typeof StartShiftSchema>;

export const EndShiftSchema = z.object({
  shiftId: z.string().uuid(),
  endingCash: z.number().nonnegative(),
  notes: z.string().max(500).nullable().optional(),
});

export type EndShiftInput = z.infer<typeof EndShiftSchema>;