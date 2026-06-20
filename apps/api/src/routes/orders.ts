/**
 * Order routes — POS transaction core.
 * - POST /api/orders/draft — create draft (status='draft')
 * - POST /api/orders/complete — ATOMIC complete (checkout)
 * - POST /api/orders/:id/void — manager PIN required
 * - GET /api/orders/:id — order detail
 * - GET /api/orders — list (filters: status, shiftId, cashierId)
 */

import { Elysia } from 'elysia';
import { z } from 'zod';
import { orderService } from '../services/order.service.js';
import { pinService } from '../services/pin.service.js';
import { getAuthUser } from '../lib/auth-helper.js';
import { ValidationError, UnauthorizedError } from '../lib/errors.js';

const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  notes: z.string().max(200).optional(),
});

const PaymentSchema = z.object({
  method: z.enum(['tunai', 'qris', 'debit']),
  amount: z.number().positive(),
  reference: z.string().max(100).optional(),
});

const CompleteOrderSchema = z.object({
  shiftId: z.string().uuid(),
  memberId: z.string().uuid().optional(),
  items: z.array(OrderItemSchema).min(1),
  payments: z.array(PaymentSchema).min(1),
  discount: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().max(100).optional(),
});

const DraftOrderSchema = CompleteOrderSchema.omit({ payments: true, idempotencyKey: true });

const VoidOrderSchema = z.object({
  managerUserId: z.string().uuid(),
  managerPin: z.string().regex(/^\d{4,6}$/),
  voidReason: z.string().min(5).max(500),
});

export const orderRoutes = new Elysia({ prefix: '/api/orders', tags: ['Orders'] })
  // Create draft
  .post('/draft', async ({ body, jwt, headers }: any) => {
    const user = await getAuthUser(jwt, headers);
    const parsed = DraftOrderSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid order', { issues: parsed.error.issues });

    const result = await orderService.createDraft({
      outletId: user.outletId!,
      shiftId: parsed.data.shiftId,
      cashierId: user.id,
      memberId: parsed.data.memberId,
      items: parsed.data.items,
      discount: parsed.data.discount,
      tax: parsed.data.tax,
      notes: parsed.data.notes,
    });
    return { ok: true, data: result };
  })

  // Complete order (ATOMIC)
  .post('/complete', async ({ body, jwt, headers }: any) => {
    const user = await getAuthUser(jwt, headers);
    const parsed = CompleteOrderSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid order', { issues: parsed.error.issues });

    const idempotencyKey =
      parsed.data.idempotencyKey || (headers['idempotency-key'] as string | undefined);

    const result = await orderService.completeOrder({
      outletId: user.outletId!,
      shiftId: parsed.data.shiftId,
      cashierId: user.id,
      memberId: parsed.data.memberId,
      items: parsed.data.items,
      payments: parsed.data.payments,
      discount: parsed.data.discount,
      tax: parsed.data.tax,
      notes: parsed.data.notes,
      idempotencyKey,
    });
    return { ok: true, data: result };
  })

  // Void order (manager PIN required)
  .post('/:id/void', async ({ params, body, jwt, headers, request }: any) => {
    const user = await getAuthUser(jwt, headers);
    const parsed = VoidOrderSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid void request', { issues: parsed.error.issues });

    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    await pinService.verify({
      userId: parsed.data.managerUserId,
      pin: parsed.data.managerPin,
      ipAddress: ip,
      requiredRole: 'manager',
    });

    const result = await orderService.voidOrder({
      orderId: params.id,
      voidedBy: user.id,
      voidReason: parsed.data.voidReason,
    });
    return { ok: true, data: result };
  })

  // Get by id
  .get('/:id', async ({ params, jwt, headers }: any) => {
    await getAuthUser(jwt, headers);
    const order = await orderService.getOrder(params.id);
    if (!order) throw new UnauthorizedError('Order not found');
    return { ok: true, data: order };
  })

  // List
  .get('/', async ({ query, jwt, headers }: any) => {
    const user = await getAuthUser(jwt, headers);
    return {
      ok: true,
      data: await orderService.listOrders({
        outletId: user.outletId!,
        cashierId: query.cashierId as string | undefined,
        shiftId: query.shiftId as string | undefined,
        status: query.status as string | undefined,
        limit: Number(query.limit ?? 50),
        offset: Number(query.offset ?? 0),
      }),
    };
  });
