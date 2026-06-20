/**
 * Auth middleware — verifies JWT and injects `user` into context.
 * Use on any protected route group via `.use(authMiddleware)`.
 *
 * Pattern (Elysia 1.x): use a guard + onBeforeHandle that throws if invalid,
 * then derive user into context. Both run on every request to the route group.
 */

import { Elysia } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { users } from '../db/schema/auth.js';
import { verifyAccessToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/errors.js';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: 'kasir' | 'admin_gudang' | 'manager' | 'super_admin';
  outletId: string | null;
  email: string | null;
}

export const authMiddleware = new Elysia({ name: 'auth' })
  .onBeforeHandle(async ({ jwt, headers }: any) => {
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

    // Re-check user is still active
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user || !user.isActive) throw new UnauthorizedError('User not found or inactive');

    // Stash on request via set.headers is not great; we re-fetch in handler via a helper
    // Alternative: use Elysia state
  })
  .resolve(async ({ jwt, headers, set }: any): Promise<{ user: AuthUser }> => {
    // Second pass — derive user into context
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
    if (!user) throw new UnauthorizedError('User not found');

    return {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role as 'kasir' | 'admin_gudang' | 'manager' | 'super_admin',
        outletId: user.outletId,
        email: user.email,
      },
    };
  });

export const requireAuth = authMiddleware;