/**
 * Auth domain — users, sessions, PIN attempts.
 */

import { pgTable, uuid, varchar, timestamp, boolean, integer, text, index } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: varchar('username', { length: 50 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    fullName: varchar('full_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 150 }),
    phone: varchar('phone', { length: 20 }),
    role: userRoleEnum('role').notNull(),
    outletId: uuid('outlet_id'),
    pinHash: text('pin_hash'),
    telegramChatId: varchar('telegram_chat_id', { length: 50 }),
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    usernameIdx: index('users_username_idx').on(t.username),
    roleIdx: index('users_role_idx').on(t.role),
    outletIdx: index('users_outlet_idx').on(t.outletId),
    activeIdx: index('users_active_idx').on(t.isActive),
  })
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('user_sessions_user_idx').on(t.userId),
    expiresIdx: index('user_sessions_expires_idx').on(t.expiresAt),
  })
);

export const pinAttempts = pgTable(
  'pin_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    success: boolean('success').notNull(),
    ipAddress: text('ip_address'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('pin_attempts_user_idx').on(t.userId),
    timeIdx: index('pin_attempts_time_idx').on(t.attemptedAt),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type PinAttempt = typeof pinAttempts.$inferSelect;