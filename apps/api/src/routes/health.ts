/**
 * Health & version endpoints.
 */

import { Elysia } from 'elysia';
import { env } from '../config/env.js';
import { pingDb } from '../config/database.js';

export const healthRoutes = new Elysia({ prefix: '/api', tags: ['Health'] })
  .get('/health', async () => {
    const dbOk = await pingDb();
    const uptime = process.uptime();
    return {
      ok: true,
      data: {
        status: dbOk ? 'healthy' : 'degraded',
        service: env.APP_NAME,
        version: env.APP_VERSION,
        env: env.NODE_ENV,
        uptime: Math.round(uptime),
        database: dbOk ? 'connected' : 'unreachable',
        timestamp: new Date().toISOString(),
      },
    };
  })
  .get('/version', () => ({
    ok: true,
    data: {
      name: env.APP_NAME,
      version: env.APP_VERSION,
      phase: '1 — Gate 0 Foundation',
    },
  }));
