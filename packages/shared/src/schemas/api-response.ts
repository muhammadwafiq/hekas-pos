/**
 * Standard API response envelope.
 */

import { z } from 'zod';

/** Success response */
export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
    meta: z.object({
      requestId: z.string().optional(),
      timestamp: z.string().datetime().default(() => new Date().toISOString()),
    }).optional(),
  });

/** Error response */
export const ApiErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    stack: z.string().optional(),
  }),
  meta: z.object({
    requestId: z.string().optional(),
    timestamp: z.string().datetime().default(() => new Date().toISOString()),
  }).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Paginated response */
export const PaginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  });

/** Common error codes */
export const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'BUSINESS_RULE_VIOLATION',
  'PAYMENT_REQUIRED',
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;