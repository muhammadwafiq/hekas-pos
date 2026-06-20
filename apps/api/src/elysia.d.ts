/**
 * Elysia module augmentation — adds JWT, body, query, params to context type
 * inference. The JWT plugin's `name: 'jwt'` decorator isn't inferred into
 * the per-handler context type by Elysia 1.4 unless we declare it here.
 *
 * This is a typed shortcut so route handlers can use `({ jwt, body, query, ... })`
 * without TypeScript complaining about missing properties.
 */

import type { JWT } from './lib/jwt.js';
import type { Cookie } from 'elysia';

declare module 'elysia' {
  interface ElysiaCustomContext {
    /** JWT instance added by the @elysiajs/jwt plugin (name: 'jwt') */
    jwt: JWT;
    /** Elysia already provides headers, but make the value type explicit for callers */
    headers: Record<string, string | string[] | undefined>;
    /** Parsed cookies (already provided by Elysia, narrowed for our helpers) */
    cookie: Record<string, Cookie<unknown>>;
  }
}

export {};
