/**
 * PIN service — verify cashier/manager PIN for sensitive actions.
 * Rate limit: 5 failed attempts per hour (per user).
 */

import { eq, and, gte, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { users, pinAttempts } from '../db/schema/auth.js';
import { verifyPin } from '../lib/password.js';
import { UnauthorizedError, RateLimitError } from '../lib/errors.js';

const PIN_RATE_LIMIT = 5;
const PIN_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export const pinService = {
  async verify(opts: { userId: string; pin: string; ipAddress?: string; requiredRole?: 'manager' | 'admin_gudang' }) {
    const { userId, pin, ipAddress, requiredRole } = opts;

    // Rate limit check — count failed attempts in last hour
    const since = new Date(Date.now() - PIN_RATE_WINDOW_MS);
    const [failedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pinAttempts)
      .where(and(eq(pinAttempts.userId, userId), eq(pinAttempts.success, false), gte(pinAttempts.attemptedAt, since)));

    if ((failedCount?.count ?? 0) >= PIN_RATE_LIMIT) {
      const retryAfter = Math.ceil(PIN_RATE_WINDOW_MS / 1000);
      throw new RateLimitError(
        `Too many failed PIN attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        retryAfter
      );
    }

    // Lookup user
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.isActive) throw new UnauthorizedError('User not found or inactive');

    // Role check
    if (requiredRole && user.role !== requiredRole && user.role !== 'super_admin') {
      throw new UnauthorizedError(`This action requires ${requiredRole} role`);
    }

    // Verify PIN
    const ok = user.pinHash ? await verifyPin(pin, user.pinHash) : false;

    // Log attempt
    await db.insert(pinAttempts).values({
      userId,
      success: ok,
      ipAddress: ipAddress ?? null,
    });

    if (!ok) {
      throw new UnauthorizedError('Invalid PIN');
    }

    return { user };
  },
};
