/**
 * Auth helper — used in routes to verify token + load user.
 * Inline approach (not middleware) for guaranteed behavior.
 */

import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { users } from '../db/schema/auth.js';
import { verifyAccessToken, type JWT } from './jwt.js';
import { UnauthorizedError, ForbiddenError } from './errors.js';

export type { JWT };

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: 'kasir' | 'admin_gudang' | 'manager' | 'super_admin';
  outletId: string | null;
  email: string | null;
}

export async function getAuthUser(jwt: JWT, headers: Record<string, string | undefined>): Promise<AuthUser> {
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
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role as 'kasir' | 'admin_gudang' | 'manager' | 'super_admin',
    outletId: user.outletId,
    email: user.email,
  };
}

/**
 * Verify user has one of the required roles. Throws ForbiddenError if not.
 * Use as: await requireRole(jwt, headers, ['admin_gudang', 'manager'])
 */
export async function requireRole(
  jwt: JWT,
  headers: Record<string, string | undefined>,
  allowedRoles: Array<'kasir' | 'admin_gudang' | 'manager' | 'super_admin'>,
): Promise<AuthUser> {
  const user = await getAuthUser(jwt, headers);
  if (!allowedRoles.includes(user.role as any)) {
    throw new ForbiddenError(
      `Role '${user.role}' tidak punya akses. Required: ${allowedRoles.join(', ')}`,
    );
  }
  return user;
}
