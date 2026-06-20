/**
 * Order schemas.
 */

import { z } from 'zod';

export const OrderStatusSchema = z.enum([
  'draft',
  'held',
  'pending_payment',
  'completed',
  'voided',
  'refunded',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(), // snapshot
  productSku: z.string(), // snapshot
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  subtotal: z.number().nonnegative(),
  notes: z.string().nullable(),
});

export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(), // ORD-XXXXXX
  outletId: z.string().uuid(),
  shiftId: z.string().uuid().nullable(),
  cashierId: z.string().uuid(),
  memberId: z.string().uuid().nullable(),
  status: OrderStatusSchema,
  items: z.array(OrderItemSchema),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  paid: z.number().nonnegative().default(0),
  change: z.number().nonnegative().default(0),
  notes: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  voidedAt: z.string().datetime().nullable(),
  voidedBy: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
});

export type Order = z.infer<typeof OrderSchema>;

export const CreateOrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().default(0),
  notes: z.string().max(500).nullable().optional(),
});

export type CreateOrderItemInput = z.infer<typeof CreateOrderItemSchema>;

export const CreateOrderSchema = z.object({
  memberId: z.string().uuid().nullable().optional(),
  items: z.array(CreateOrderItemSchema).min(1),
  discount: z.number().nonnegative().default(0),
  notes: z.string().max(500).nullable().optional(),
  idempotencyKey: z.string().max(100).optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const CompleteOrderSchema = z.object({
  orderId: z.string().uuid(),
  payments: z.array(z.object({
    method: z.enum(['tunai', 'qris', 'debit']),
    amount: z.number().positive(),
    reference: z.string().optional(),
  })).min(1),
});

export type CompleteOrderInput = z.infer<typeof CompleteOrderSchema>;

export const VoidOrderSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().min(3).max(500),
  pin: z.string().regex(/^\d{4,6}$/),
});

export type VoidOrderInput = z.infer<typeof VoidOrderSchema>;