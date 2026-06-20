/**
 * Application error hierarchy.
 * Single root: AppError. Each subclass maps to an HTTP status code.
 * Throwing these anywhere → error-handler middleware formats the API response.
 */

export type ErrorContext = Record<string, unknown>;

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly isAppError: boolean;
  public readonly context?: ErrorContext;
  public readonly cause?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    context?: ErrorContext,
    cause?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.isAppError = true;
    this.context = context;
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.context ? { details: this.context } : {}),
    };
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', context?: ErrorContext) {
    super('VALIDATION_ERROR', message, 422, context);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', context?: ErrorContext) {
    super('UNAUTHORIZED', message, 401, context);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', context?: ErrorContext) {
    super('FORBIDDEN', message, 403, context);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', context?: ErrorContext) {
    super('NOT_FOUND', `${resource} not found`, 404, context);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', context?: ErrorContext) {
    super('CONFLICT', message, 409, context);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter?: number, context?: ErrorContext) {
    super('RATE_LIMITED', message, 429, { ...context, retryAfter });
  }
}

export class BusinessRuleError extends AppError {
  constructor(message = 'Business rule violation', context?: ErrorContext) {
    super('BUSINESS_RULE_VIOLATION', message, 422, context);
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error', context?: ErrorContext, cause?: unknown) {
    super('INTERNAL_ERROR', message, 500, context, cause);
    this.isOperational = false;
  }
}

export const isAppError = (err: unknown): err is AppError =>
  err instanceof AppError;
