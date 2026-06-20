/**
 * ElysiaJS application entry point.
 * Wires up: env, logger, DB, middleware, routes, Swagger, JWT.
 */

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { jwt } from '@elysiajs/jwt';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pingDb } from './config/database.js';

import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/logger.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { productRoutes } from './routes/products.js';
import { stockRoutes } from './routes/stocks.js';
import { orderRoutes } from './routes/orders.js';
import { shiftRoutes } from './routes/shifts.js';
import { heldDraftRoutes } from './routes/held-drafts.js';
import { supplierRoutes } from './routes/suppliers.js';
import { inventoryRoutes, productImageRoutes, uploadsRoutes } from './routes/inventory.js';
import { incomingRoutes } from './routes/incoming-goods.js';
import { outgoingRoutes } from './routes/outgoing-goods.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { telegramRoutes } from './routes/telegram.js';
import { telegramWebhookRoutes } from './routes/webhook/telegram.js';
import { suratJalanRoutes } from './routes/surat-jalan.js';
import { reportRoutes } from './reports/reports.routes.js';
import { hrRoutes } from './hr/hr.routes.js';
import { telegramSenderWorker } from './workers/telegram-sender.worker.js';
import { startQueue, getQueue } from './config/queue.js';
import { dailyReportWorker } from './workers/daily-report.worker.js';

const app = new Elysia()
  // ====== GLOBAL MIDDLEWARE ======
  .use(
    cors({
      origin: env.APP_CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'],
      exposeHeaders: ['X-Request-ID'],
      maxAge: 600,
    })
  )
  .use(
    swagger({
      path: '/api/docs',
      documentation: {
        info: {
          title: env.APP_NAME,
          version: env.APP_VERSION,
          description: 'HEKAS POS API — Bun + ElysiaJS + Drizzle + PostgreSQL',
        },
        tags: [
          { name: 'Health', description: 'Health & version' },
          { name: 'Auth', description: 'Login, refresh, logout, me' },
          { name: 'Products', description: 'Product catalog' },
          { name: 'Stock', description: 'Stock movements & adjustments' },
          { name: 'Orders', description: 'POS transactions' },
          { name: 'Shifts', description: 'Cashier shift management' },
          { name: 'Held Drafts', description: 'Held orders' },
          { name: 'Suppliers', description: 'Supplier CRUD' },
          { name: 'Inventory', description: 'Stock management (restock, adjust, summary)' },
          { name: 'Product Images', description: 'Product image upload' },
          { name: 'Incoming Goods', description: 'Purchase Orders (PO) + verify/reject' },
          { name: 'Outgoing Goods', description: 'Picking + delivery workflow' },
          { name: 'Reports', description: 'Export reports (Excel/PDF)' },
          { name: 'HR', description: 'Employees, attendance, leave requests' },
        ],
        servers: [
          { url: env.APP_BASE_URL, description: `${env.NODE_ENV}` },
        ],
      },
      swaggerOptions: {
        persistAuthorization: true,
      },
    })
  )
  .use(
    jwt({
      name: 'jwt',
      secret: env.JWT_SECRET,
      exp: `${env.JWT_ACCESS_EXPIRES_IN}s`,
    })
  )
  .use(requestLogger)
  .use(errorHandler)

  // ====== ROUTES ======
  .use(healthRoutes)
  .use(authRoutes)
  .use(productRoutes)
  .use(stockRoutes)
  .use(orderRoutes)
  .use(shiftRoutes)
  .use(heldDraftRoutes)
  .use(supplierRoutes)
  .use(inventoryRoutes)
  .use(productImageRoutes)
  .use(uploadsRoutes)
  .use(incomingRoutes)
  .use(outgoingRoutes)
  .use(dashboardRoutes)
  .use(telegramRoutes)
  .use(telegramWebhookRoutes)
  .use(suratJalanRoutes)
  .use(reportRoutes)
  .use(hrRoutes)

  // ====== GLOBAL ERROR HANDLER (catches everything) ======
  .onError(({ code, error, set, request }) => {
    // Custom AppError
    const errAny = error as any;
    if (errAny?.isAppError) {
      set.status = errAny.statusCode as any;
      return {
        ok: false,
        error: {
          code: errAny.code,
          message: errAny.message,
          details: errAny.details,
        },
        meta: { requestId: (request as any).requestId ?? null },
      };
    }

    // Validation error from Elysia
    if (code === 'VALIDATION') {
      set.status = 422;
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: (errAny?.all ?? []).map((e: any) => ({
            path: e.path,
            message: e.message,
          })),
        },
      };
    }

    // Not found
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      };
    }

    // Unauthorized
    if ((code as string) === 'UNAUTHORIZED' || (code as string) === 'INVALID_TOKEN') {
      (set as any).status = 401;
      return {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      };
    }

    // Internal error
    logger.error({ err: error, code, path: request.url }, 'Unhandled error');
    set.status = 500;
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: (request as any).requestId ?? null,
      },
    };
  })

  // ====== START SERVER ======
  .listen({
    port: Number(env.APP_PORT) || 3001,
    hostname: '0.0.0.0',
  });

logger.info(
  {
    app: env.APP_NAME,
    env: env.NODE_ENV,
    port: env.APP_PORT,
    docs: `${env.APP_BASE_URL}/api/docs`,
  },
  `🚀 ${env.APP_NAME} ready at ${env.APP_BASE_URL}`,
);

// Verify DB connection at startup
pingDb()
  .then(() => logger.info('Database connected'))
  .catch((err) => logger.error({ err }, 'Database connection FAILED'));

// Start Telegram sender worker
if (env.ENABLE_TELEGRAM) {
  telegramSenderWorker.start();
}

// Start pg-boss queue + daily report worker
(async () => {
  try {
    const boss = await startQueue();
    await dailyReportWorker.start(boss);
    await dailyReportWorker.schedule(boss);
    logger.info('pg-boss workers + schedules ready');
  } catch (err) {
    logger.error({ err }, 'pg-boss startup FAILED');
  }
})();

export type App = typeof app;
export default app;