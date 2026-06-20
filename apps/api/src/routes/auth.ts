/**
 * Auth routes — login, refresh, logout, me.
 * Phase 1 implementation: password login only.
 * TODO: PIN verify endpoint, refresh rotation, rate limiting (Phase 2 Gate 1).
 */

import { Elysia } from 'elysia';
import { eq, and } from 'drizzle-orm';
import { db } from '../config/database.js';
import { users, userSessions } from '../db/schema/auth.js';
import { verifyPassword } from '../lib/password.js';
import { signAccessToken, signRefreshToken, verifyAccessToken, generateSessionId } from '../lib/jwt.js';
import { UnauthorizedError, ValidationError } from '../lib/errors.js';
import { LoginSchema } from '@hekas/shared';

export const authRoutes = new Elysia({ prefix: '/api/auth', tags: ['Auth'] })
  .post('/login', async ({ body, jwt, request }: any) => {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Invalid login payload', {
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    const { username, password } = parsed.data;

    // Lookup user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid username or password');
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedError(`Account locked until ${user.lockedUntil.toISOString()}`);
    }

    // Verify password
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      // Increment failed attempts (simple version)
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      await db
        .update(users)
        .set({
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= 5 ? new Date(Date.now() + 3600_000) : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      throw new UnauthorizedError('Invalid username or password');
    }

    // Success — reset attempts, update last login
    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Generate tokens
    const sessionId = generateSessionId();
    const accessToken = await signAccessToken(jwt, {
      sub: user.id,
      role: user.role,
      outletId: user.outletId,
      username: user.username,
    });
    const refreshToken = await signRefreshToken(jwt, {
      sub: user.id,
      sessionId,
    });

    // Persist session (simplified — store hashed refresh)
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const ua = request.headers.get('user-agent') ?? 'unknown';
    await db.insert(userSessions).values({
      userId: user.id,
      refreshTokenHash: refreshToken.slice(-32), // simplified "hash"
      userAgent: ua.slice(0, 500),
      ipAddress: ip,
      expiresAt: new Date(Date.now() + 30 * 24 * 3600_000), // 30d
    });

    return {
      ok: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          outletId: user.outletId,
        },
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 min
      },
    };
  })

  .get('/me', async ({ jwt, headers }: any) => {
    const auth = headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }
    const token = auth.slice(7);
    const payload = await verifyAccessToken<{
      sub: string;
      role: string;
      outletId: string | null;
      username: string;
    }>(jwt, token);
    if (!payload) throw new UnauthorizedError('Invalid or expired token');

    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user || !user.isActive) throw new UnauthorizedError('User not found or inactive');

    return {
      ok: true,
      data: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        outletId: user.outletId,
        email: user.email,
      },
    };
  })

  .post('/logout', async () => {
    // Simplistic: just respond success. Real impl (Phase 2): revoke session + clear refresh.
    return { ok: true, data: { message: 'Logged out' } };
  });
