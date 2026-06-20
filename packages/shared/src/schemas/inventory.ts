/**
 * Inventory schemas — incoming goods (PO), outgoing goods.
 */

import { z } from 'zod';

export const IncomingGoodStatusSchema = z.enum([
  'draft',
  'pending',
  'verified',
  'rejected',
]);
export type IncomingGoodStatus = z.infer<typeof IncomingGoodStatusSchema>;

export const IncomingGoodSchema = z.object({
  id: z.string().uuid(),
  documentNumber: z.string(), // PO-XXXXXX
  outletId: z.string().uuid(),
  supplierId: z.string().uuid(),
  supplierName: z.string(), // snapshot
  receivedDate: z.string().datetime(),
  totalItems: z.number().int().nonnegative().default(0),
  status: IncomingGoodStatusSchema,
  notes: z.string().nullable(),
  verifiedBy: z.string().uuid().nullable(),
  verifiedAt: z.string().datetime().nullable(),
  rejectedBy: z.string().uuid().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  rejectReason: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type IncomingGood = z.infer<typeof IncomingGoodSchema>;

export const OutgoingGoodStatusSchema = z.enum([
  'draft',
  'picking',
  'ready',
  'sent',
  'cancelled',
]);
export type OutgoingGoodStatus = z.infer<typeof OutgoingGoodStatusSchema>;

export const OutgoingGoodSchema = z.object({
  id: z.string().uuid(),
  documentNumber: z.string(), // OUT-XXXXXX
  outletId: z.string().uuid(),
  destination: z.string(),
  referenceType: z.string().nullable(), // 'surat_jalan' | 'manual'
  referenceId: z.string().uuid().nullable(),
  totalItems: z.number().int().nonnegative().default(0),
  status: OutgoingGoodStatusSchema,
  sentAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type OutgoingGood = z.infer<typeof OutgoingGoodSchema>;