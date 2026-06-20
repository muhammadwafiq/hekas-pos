/**
 * Common schemas — pagination, ID, timestamps, dll.
 */

import { z } from 'zod';

/** UUID v4 */
export const UuidSchema = z.string().uuid();

/** CUID/nanoid identifier */
export const IdSchema = z.string().min(1).max(64);

/** Pagination query */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export type Pagination = z.infer<typeof PaginationSchema>;

/** Search query */
export const SearchSchema = z.object({
  q: z.string().min(1).max(200).optional(),
});

/** Sort order */
export const SortOrderSchema = z.enum(['asc', 'desc']).default('desc');

/** Date range */
export const DateRangeSchema = z.object({
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
}).refine(
  (data) => !data.start || !data.end || data.start <= data.end,
  { message: 'start must be before end' }
);

export type DateRange = z.infer<typeof DateRangeSchema>;

/** ISO 8601 datetime */
export const DateTimeSchema = z.string().datetime();