/**
 * Payment schemas.
 */

import { z } from 'zod';

export const PaymentMethodSchema = z.enum(['tunai', 'qris', 'debit']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  method: PaymentMethodSchema,
  amount: z.number().positive(),
  reference: z.string().nullable(),
  paidAt: z.string().datetime(),
  cashierId: z.string().uuid(),
});

export type Payment = z.infer<typeof PaymentSchema>;