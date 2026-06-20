/**
 * JWT helpers — sign + verify access/refresh tokens.
 * Uses Elysia JWT plugin under the hood (wired in index.ts).
 */

import { env } from '../config/env.js';

/**
 * Structural type for the Elysia JWT instance.
 * The `@elysiajs/jwt` plugin doesn't export a `JWT` type; this is the minimal
 * shape we need for sign/verify across the app.
 */
export type JWT = {
  sign(payload: unknown): Promise<string>;
  verify<T = unknown>(token: string): Promise<T | false>;
};

export interface TokenPayload {
  sub: string; // user id
  role: string;
  outletId: string | null;
  username: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
}

export async function signAccessToken(
  jwt: JWT,
  payload: TokenPayload
): Promise<string> {
  return jwt.sign(payload as any);
}

export async function signRefreshToken(
  jwt: JWT,
  payload: RefreshTokenPayload
): Promise<string> {
  return (jwt.sign as any)(
    { ...payload },
    { exp: `${env.JWT_REFRESH_EXPIRES_IN}s` }
  );
}

export async function verifyAccessToken<T = TokenPayload>(
  jwt: JWT,
  token: string
): Promise<T | null> {
  try {
    const payload = await jwt.verify(token);
    if (!payload) return null;
    return payload as unknown as T;
  } catch {
    return null;
  }
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function generateLinkCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit confusable chars
  let code = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    code += chars[arr[i] % chars.length];
  }
  return code;
}
