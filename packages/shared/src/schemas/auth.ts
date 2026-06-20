/**
 * Auth schemas — login, refresh, session, dll.
 */

import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(8).max(100),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const VerifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
});

export type VerifyPinInput = z.infer<typeof VerifyPinSchema>;

export const AuthResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    username: z.string(),
    fullName: z.string(),
    role: z.enum(['kasir', 'admin_gudang', 'manager', 'super_admin']),
    outletId: z.string().uuid().nullable(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;