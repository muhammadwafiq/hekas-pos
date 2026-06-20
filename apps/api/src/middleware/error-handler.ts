/**
 * Global error-handler middleware.
 * Catches all thrown errors, maps to API error envelope:
 *   { ok: false, error: { code, message, details? }, meta?: {...} }
 */

import { Elysia } from 'elysia';
import { ZodError } from 'zod';
import { logger } from '../config/logger.js';
import { AppError, isAppError } from '../lib/errors.js';

export const errorHandler = new Elysia({ name: 'error-handler' })
  .onError(({ code, error, set, request }) => {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // ====== AppError (operational, expected) ======
    if (isAppError(error)) {
      set.status = error.statusCode;
      logger.warn(
        { requestId, code: error.code, status: error.statusCode, msg: error.message },
        'AppError thrown'
      );
      return {
        ok: false,
        error: error.toJSON(),
        meta: { requestId, timestamp },
      };
    }

    // ====== Zod validation (defensive — Elysia may surface these directly) ======
    if (error instanceof ZodError) {
      set.status = 422;
      logger.warn({ requestId, issues: error.issues }, 'Zod validation failed');
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: {
            issues: error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
              code: i.code,
            })),
          },
        },
        meta: { requestId, timestamp },
      };
    }

    // ====== Elysia framework errors ======
    if (code === 'VALIDATION') {
      set.status = 422;
      const msg = error instanceof Error ? error.message : 'Validation failed';
      logger.warn({ requestId, msg }, 'Elysia validation error');
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: msg },
        meta: { requestId, timestamp },
      };
    }

    if (code === 'NOT_FOUND' || code === 404) {
      set.status = 404;
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Route not found' },
        meta: { requestId, timestamp },
      };
    }

    // ====== Unknown / non-Error throws ======
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Internal server error';

    // Default status
    if (!set.status || set.status === 200) set.status = 500;

    logger.error(
      { requestId, code, message, err: error },
      'Unhandled error'
    );

    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: code === 'INTERNAL_SERVER_ERROR' || code === 500
          ? 'Internal server error'
          : message,
      },
      meta: { requestId, timestamp },
    };
  });
