/**
 * Surat Jalan (delivery order) schemas.
 */

import { z } from 'zod';

export const SuratJalanStatusSchema = z.enum([
  'draft',
  'pending_review',
  'pending_approval',
  'approved',
  'rejected',
  'sent',
  'cancelled',
]);
export type SuratJalanStatus = z.infer<typeof SuratJalanStatusSchema>;

export const SuratJalanSchema = z.object({
  id: z.string().uuid(),
  documentNumber: z.string(), // SJ-XXXXXX
  outletId: z.string().uuid(),
  outgoingGoodId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
  destination: z.string(),
  recipientName: z.string(),
  recipientPhone: z.string().nullable(),
  totalItems: z.number().int().nonnegative().default(0),
  status: SuratJalanStatusSchema,
  notes: z.string().nullable(),
  reviewedBy: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  approvedBy: z.string().uuid().nullable(),
  approvedAt: z.string().datetime().nullable(),
  rejectedBy: z.string().uuid().nullable(),
  rejectedAt: z.string().datetime().nullable(),
  rejectReason: z.string().nullable(),
  pdfUrl: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type SuratJalan = z.infer<typeof SuratJalanSchema>;

export const ApproveSuratJalanSchema = z.object({
  suratJalanId: z.string().uuid(),
  notes: z.string().max(500).nullable().optional(),
});

export type ApproveSuratJalanInput = z.infer<typeof ApproveSuratJalanSchema>;

export const RejectSuratJalanSchema = z.object({
  suratJalanId: z.string().uuid(),
  reason: z.string().min(3).max(500),
});

export type RejectSuratJalanInput = z.infer<typeof RejectSuratJalanSchema>;