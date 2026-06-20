/**
 * Telegram integration schemas.
 */

import { z } from 'zod';

export const TelegramEventTypeSchema = z.enum([
  'sj_pending_approval',
  'sj_approved',
  'sj_rejected',
  'stock_kritis',
  'barang_masuk_verified',
  'laporan_harian_ready',
  'shift_dimulai',
  'shift_diakhiri',
  'error_sistem',
]);
export type TelegramEventType = z.infer<typeof TelegramEventTypeSchema>;

export const NotificationStatusSchema = z.enum([
  'pending',
  'sending',
  'sent',
  'failed',
  'cancelled',
]);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

export const TelegramLinkSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  telegramChatId: z.string(),
  telegramUsername: z.string().nullable(),
  linkCode: z.string(),
  isVerified: z.boolean().default(false),
  createdAt: z.string().datetime(),
  verifiedAt: z.string().datetime().nullable(),
});

export type TelegramLink = z.infer<typeof TelegramLinkSchema>;

export const NotificationQueueItemSchema = z.object({
  id: z.string().uuid(),
  eventType: TelegramEventTypeSchema,
  targetUserId: z.string().uuid().nullable(),
  targetChatId: z.string().nullable(),
  payload: z.record(z.unknown()),
  status: NotificationStatusSchema,
  attempts: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(5),
  lastError: z.string().nullable(),
  nextAttemptAt: z.string().datetime().nullable(),
  sentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type NotificationQueueItem = z.infer<typeof NotificationQueueItemSchema>;