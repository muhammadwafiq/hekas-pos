/**
 * Environment configuration with Zod validation.
 * Throws on startup if any required env var is missing or invalid.
 */

import { z } from 'zod';

const EnvSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  APP_NAME: z.string().default('HEKAS POS API'),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_VERSION: z.string().default('0.1.0'),
  APP_BASE_URL: z.string().url().default('http://localhost:3001'),
  APP_CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string().min(10),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DATABASE_URL_TEST: z.string().min(10).optional(),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_EXPIRES_IN: z.coerce.number().int().positive().default(2592000),
  PIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  PIN_LOCKOUT_WINDOW: z.coerce.number().int().positive().default(3600),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_BOT_USERNAME: z.string().default('hekas_pos_bot'),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(''),
  TELEGRAM_WEBHOOK_URL: z.string().default(''),
  TELEGRAM_POLLING: z.coerce.boolean().default(false),
  TELEGRAM_MAX_RETRY: z.coerce.number().int().positive().default(5),

  // Workers
  PGBOSS_SCHEMA: z.string().default('pgboss'),
  PGBOSS_MIGRATE: z.coerce.boolean().default(true),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),

  // Storage
  UPLOAD_DIR: z.string().default('./static/uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(10),
  PDF_OUTPUT_DIR: z.string().default('./static/pdfs'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),

  // Rate limiting
  RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  // Monitoring
  SENTRY_DSN: z.string().default(''),
  HEALTH_CHECK_PATH: z.string().default('/api/health'),

  // Feature flags
  ENABLE_AI: z.coerce.boolean().default(false),
  ENABLE_PDF_EXPORT: z.coerce.boolean().default(true),
  ENABLE_TELEGRAM: z.coerce.boolean().default(false),
  ENABLE_SWAGGER: z.coerce.boolean().default(true),

  // Seed
  SEED_DEFAULT_PASSWORD: z.string().min(6).default('password123'),
});

function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;