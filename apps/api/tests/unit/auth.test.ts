/**
 * Smoke test — verifies AppError class hierarchy.
 */

import { test, expect, describe } from 'bun:test';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BusinessRuleError,
  InternalError,
  isAppError,
} from '../../src/lib/errors.js';

describe('Error hierarchy', () => {
  test('ValidationError has correct statusCode', () => {
    const err = new ValidationError('bad input');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(isAppError(err)).toBe(true);
  });

  test('UnauthorizedError has correct statusCode', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  test('ForbiddenError has correct statusCode', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  test('NotFoundError has correct statusCode', () => {
    const err = new NotFoundError('User');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('User');
  });

  test('ConflictError has correct statusCode', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
  });

  test('RateLimitError has retryAfter', () => {
    const err = new RateLimitError('locked', 3600);
    expect(err.statusCode).toBe(429);
    expect(err.context?.retryAfter).toBe(3600);
  });

  test('InternalError is non-operational', () => {
    const err = new InternalError();
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(false);
  });

  test('isAppError returns false for non-AppError', () => {
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError('string')).toBe(false);
    expect(isAppError(null)).toBe(false);
  });

  test('AppError.toJSON includes context', () => {
    const err = new ValidationError('invalid', { field: 'email' });
    const json = err.toJSON();
    expect(json).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(json).toHaveProperty('details.field', 'email');
  });
});
