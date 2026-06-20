/**
 * RBAC middleware factory.
 * Usage: `.use(requireRole('manager', 'admin_gudang'))` after `.use(authMiddleware)`.
 */

import { Elysia } from 'elysia';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

type Role = 'kasir' | 'admin_gudang' | 'manager' | 'super_admin';

export function requireRole(...allowedRoles: Role[]) {
  return new Elysia({ name: `rbac-${allowedRoles.join('-')}` })
    .onBeforeHandle(({ user }: any) => {
      if (!user) throw new UnauthorizedError('Authentication required');
      if (!allowedRoles.includes(user.role as Role)) {
        throw new ForbiddenError(`Role '${user.role}' not allowed. Required: ${allowedRoles.join(', ')}`);
      }
    });
}
