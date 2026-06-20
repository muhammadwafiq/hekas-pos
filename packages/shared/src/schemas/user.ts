/**
 * User schemas.
 */

import { z } from 'zod';

export const UserRoleSchema = z.enum(['kasir', 'admin_gudang', 'manager', 'super_admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  fullName: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  role: UserRoleSchema,
  outletId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  pinHash: z.string().nullable(),
  telegramChatId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;