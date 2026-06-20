/**
 * Logger (Pino) — production-ready logging with X-Request-ID context support.
 */

import pino from 'pino';
import { env } from './env.js';

const isDev = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isDev && env.LOG_PRETTY
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        },
      }
    : {}),
  base: {
    service: env.APP_NAME,
    version: env.APP_VERSION,
    env: env.NODE_ENV,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.pin',
      '*.token',
      '*.secret',
      '*.jwt',
      '*.refreshToken',
      '*.accessToken',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/** Child logger factory — pass requestId for correlation */
export function childLogger(requestId: string, context?: Record<string, unknown>) {
  return logger.child({ requestId, ...context });
}

export type Logger = typeof logger;