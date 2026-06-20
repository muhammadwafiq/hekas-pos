/**
 * Request logger middleware.
 * - Generates X-Request-ID if missing
 * - Logs request start (method, path, requestId) and end (status, duration)
 * - Exposes requestId via header on response
 */

import { Elysia } from 'elysia';
import { logger } from '../config/logger.js';

export const requestLogger = new Elysia({ name: 'request-logger' })
  .onRequest(({ request, set }) => {
    const incomingId = request.headers.get('x-request-id');
    const requestId = incomingId && /^[A-Za-z0-9_-]{1,128}$/.test(incomingId)
      ? incomingId
      : crypto.randomUUID();

    // Attach to response header
    set.headers['X-Request-ID'] = requestId;

    // Log request start
    logger.info(
      {
        requestId,
        method: request.method,
        url: request.url,
        userAgent: request.headers.get('user-agent'),
      },
      `→ ${request.method} ${new URL(request.url).pathname}`
    );
  })
  .onAfterHandle(({ set, request }) => {
    const requestId = set.headers['X-Request-ID'] as string | undefined;
    logger.info(
      {
        requestId,
        status: typeof set.status === 'number' ? set.status : 200,
      },
      `← ${new URL(request.url).pathname}`
    );
  });
