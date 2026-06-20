/**
 * Telegram domain — links, messages, notification queue.
 */

import { pgTable, uuid, varchar, text, integer, jsonb, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import {
  telegramEventTypeEnum,
  notificationStatusEnum,
  telegramMessageDirectionEnum,
} from './enums.js';
import { users } from './auth.js';

export const telegramLinks = pgTable(
  'telegram_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    telegramChatId: varchar('telegram_chat_id', { length: 50 }),
    telegramUsername: varchar('telegram_username', { length: 100 }),
    linkCode: varchar('link_code', { length: 20 }).notNull().unique(),
    isVerified: boolean('is_verified').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    userIdx: index('telegram_links_user_idx').on(t.userId),
    codeIdx: index('telegram_links_code_idx').on(t.linkCode),
    verifiedIdx: index('telegram_links_verified_idx').on(t.isVerified),
  })
);

export const telegramMessages = pgTable(
  'telegram_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    telegramLinkId: uuid('telegram_link_id').notNull().references(() => telegramLinks.id, { onDelete: 'cascade' }),
    messageText: text('message_text').notNull(),
    direction: telegramMessageDirectionEnum('direction').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    linkIdx: index('telegram_messages_link_idx').on(t.telegramLinkId),
    directionIdx: index('telegram_messages_direction_idx').on(t.direction),
  })
);

export const notificationQueue = pgTable(
  'notification_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventType: telegramEventTypeEnum('event_type').notNull(),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }),
    targetChatId: varchar('target_chat_id', { length: 50 }),
    payload: jsonb('payload').notNull(),
    status: notificationStatusEnum('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    lastError: text('last_error'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    eventIdx: index('notification_queue_event_idx').on(t.eventType),
    statusIdx: index('notification_queue_status_idx').on(t.status),
    nextAttemptIdx: index('notification_queue_next_idx').on(t.nextAttemptAt),
    targetIdx: index('notification_queue_target_idx').on(t.targetUserId),
  })
);

export type TelegramLink = typeof telegramLinks.$inferSelect;
export type TelegramMessage = typeof telegramMessages.$inferSelect;
export type NotificationQueueItem = typeof notificationQueue.$inferSelect;
