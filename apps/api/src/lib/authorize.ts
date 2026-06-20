/**
 * Authorization helper — check role + return user.
 * Use this in route handlers where you need the AuthUser AND want to enforce role.
 */

import type { AuthUser } from './auth-helper.js';
import { ForbiddenError, UnauthorizedError } from './errors.js';

export type Role = 'kasir' | 'admin_gudang' | 'manager' | 'super_admin';

export async function authorize(
  user: AuthUser,
  allowedRoles: Role[]
): Promise<AuthUser> {
  if (!user) throw new UnauthorizedError('Authentication required');
  if (!allowedRoles.includes(user.role as Role)) {
    throw new ForbiddenError(
      `Role '${user.role}' not allowed. Required: ${allowedRoles.join(', ')}`
    );
  }
  return user;
}