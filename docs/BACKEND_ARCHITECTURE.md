# BACKEND ARCHITECTURE — HEKAS POS

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Arsitektur backend ElysiaJS + Bun
**Dasar**: `PRD.md` v1.0.0 + `DATABASE_DESIGN.md` v1.0.0 + `API_SPEC.md` v1.0.0
**Runtime**: Bun
**Framework**: ElysiaJS
**Project root**: `/home/jazli/hekas-pos/` (saat ini `hekas-app/` frontend; backend folder `apps/api/` akan dibuat saat implementasi)

---

## 1. Ringkasan

Backend HEKAS POS adalah REST API server yang melayani frontend SvelteKit dan integrasi eksternal (Telegram webhook, scheduled jobs). Dibangun dengan **ElysiaJS** (Bun-native HTTP framework) + **Drizzle ORM** + **pg-boss** untuk background jobs.

### 1.1 Prinsip Utama

1. **Layer separation**: Routes → Services → Repositories → DB. Bisnis logic TIDAK ada di route handler.
2. **Type-safe end-to-end**: Drizzle types → zod schemas → service return types → API response types.
3. **Atomic transactions**: Aksi sensitif (POS complete, PO verify, restock, void) WAJIB dalam `db.transaction()`.
4. **Defense in depth**: RBAC double-check (route guard + service guard + DB constraint).
5. **Stateless API**: Tidak ada state di memory. Session via JWT. Job state via pg-boss.
6. **Idempotent where possible**: Untuk create actions, dukung `Idempotency-Key`.

## 2. Tech Stack

| Layer               | Pilihan                                                   |
|---------------------|-----------------------------------------------------------|
| Runtime             | Bun (latest)                                              |
| HTTP Framework      | ElysiaJS                                                  |
| Validation          | Zod                                                       |
| ORM                 | Drizzle ORM + drizzle-kit (migrations)                    |
| DB Driver           | `postgres` (postgres.js) atau `pg`                        |
| Background Jobs     | pg-boss                                                   |
| Auth                | `@elysiajs/jwt` + custom PIN module                       |
| Password hashing    | `@node-rs/argon2` atau `bcrypt`                           |
| Rate limit          | `@elysiajs/rate-limit` atau custom                        |
| CORS                | `@elysiajs/cors`                                          |
| Logger              | `pino` + `pino-pretty` (dev only)                         |
| Error tracking      | Sentry (Asumsi) atau custom                               |
| Testing             | Vitest + bun test                                         |
| API docs            | `@elysiajs/swagger`                                       |
| Process manager     | PM2 / systemd / Docker                                    |
| Container           | Docker (oven/bun base image)                              |
| CI                  | GitHub Actions (Asumsi)                                   |

## 3. Struktur Folder

```
apps/api/
├── src/
│   ├── index.ts                       # Entry point, Elysia instance
│   ├── config/
│   │   ├── env.ts                     # Zod-validated env vars
│   │   ├── database.ts                # Drizzle client + connection pool
│   │   ├── logger.ts                  # Pino logger instance
│   │   └── constants.ts               # App-wide constants
│   ├── db/
│   │   ├── schema/                    # Drizzle table definitions
│   │   │   ├── index.ts               # Re-export all schemas
│   │   │   ├── auth.ts                # users, user_sessions, pin_attempts
│   │   │   ├── master.ts              # categories, products, suppliers, members
│   │   │   ├── stock.ts               # stocks, stock_movements, stock_adjustments
│   │   │   ├── pos.ts                 # orders, order_items, payments, held_drafts
│   │   │   ├── shift.ts               # shifts, shift_handovers
│   │   │   ├── inventory.ts           # incoming/outgoing/surat tables
│   │   │   ├── hr.ts                  # employees, attendances, leave_requests
│   │   │   ├── reports.ts             # daily_reports, report_snapshots
│   │   │   ├── telegram.ts            # telegram_links, telegram_messages, notification_queue
│   │   │   ├── ai.ts                  # ai_conversations, ai_messages
│   │   │   └── system.ts              # audit_logs, outlet_settings, devices, printers
│   │   ├── migrations/                # Generated SQL migrations
│   │   ├── seed.ts                    # Initial data (categories, sample products, outlet)
│   │   └── enums.ts                   # Shared pgEnum definitions
│   ├── middleware/                    # Elysia plugins
│   │   ├── request-id.ts              # Generate/forward X-Request-ID
│   │   ├── logger.ts                  # Log request + response
│   │   ├── auth.ts                    # JWT verification, populate context.user
│   │   ├── rbac.ts                    # Role-based access control
│   │   ├── outlet-scope.ts            # Filter by outlet_id
│   │   ├── rate-limit.ts              # Per-route rate limit
│   │   ├── audit.ts                   # Audit log untuk aksi sensitif
│   │   └── error-handler.ts           # Global error handler
│   ├── routes/                        # Elysia route groups (HTTP endpoints)
│   │   ├── index.ts                   # Mount all route groups
│   │   ├── auth.ts                    # /api/auth/*
│   │   ├── products.ts                # /api/products/*
│   │   ├── categories.ts              # /api/categories/*
│   │   ├── members.ts                 # /api/members/*
│   │   ├── orders.ts                  # /api/orders/*
│   │   ├── shifts.ts                  # /api/shifts/*
│   │   ├── inventory.ts               # /api/incoming-goods/*, /api/outgoing-goods/*
│   │   ├── surat-jalan.ts             # /api/surat-jalan/*
│   │   ├── suppliers.ts               # /api/suppliers/*
│   │   ├── employees.ts               # /api/employees/*, /api/leave-requests/*
│   │   ├── reports.ts                 # /api/reports/*
│   │   ├── dashboard.ts               # /api/dashboard/*
│   │   ├── analytics.ts               # /api/analytics/*
│   │   ├── ai.ts                      # /api/ai/*
│   │   ├── telegram.ts                # /api/telegram/*
│   │   ├── settings.ts                # /api/settings/*
│   │   ├── devices.ts                 # /api/devices/*
│   │   ├── printers.ts                # /api/printers/*
│   │   ├── health.ts                  # /api/health, /api/version
│   │   └── webhook/                   # Public webhooks
│   │       └── telegram.ts            # Telegram Bot webhook
│   ├── services/                      # Business logic layer
│   │   ├── auth.service.ts            # Login, logout, refresh, PIN verify
│   │   ├── product.service.ts         # CRUD, restock, bulk
│   │   ├── order.service.ts           # POS order lifecycle (complete, void, hold)
│   │   ├── shift.service.ts           # Shift start/end, summary
│   │   ├── inventory.service.ts       # PO verify, restock, adjustment
│   │   ├── outgoing.service.ts        # Outgoing goods, picking
│   │   ├── surat.service.ts           # SJ creation, 2-stage approval, print
│   │   ├── report.service.ts          # Sales, inventory, finance aggregation
│   │   ├── dashboard.service.ts       # Dashboard data aggregation
│   │   ├── ai.service.ts              # AI chat (MVP echo)
│   │   ├── telegram.service.ts        # Send message, queue, retry
│   │   ├── notification.service.ts    # Generic notification dispatch
│   │   ├── audit.service.ts           # Audit log helper
│   │   └── pdf.service.ts             # PDF generation (receipt, report)
│   ├── repositories/                  # DB query layer (Drizzle wrapper)
│   │   ├── auth.repo.ts
│   │   ├── product.repo.ts
│   │   ├── order.repo.ts
│   │   ├── shift.repo.ts
│   │   ├── inventory.repo.ts
│   │   ├── outgoing.repo.ts
│   │   ├── surat.repo.ts
│   │   ├── supplier.repo.ts
│   │   ├── employee.repo.ts
│   │   ├── member.repo.ts
│   │   ├── telegram.repo.ts
│   │   ├── audit.repo.ts
│   │   └── system.repo.ts
│   ├── validators/                    # Zod schemas (shared types dengan frontend via package)
│   │   ├── auth.schema.ts
│   │   ├── product.schema.ts
│   │   ├── order.schema.ts
│   │   ├── shift.schema.ts
│   │   ├── inventory.schema.ts
│   │   ├── surat.schema.ts
│   │   ├── employee.schema.ts
│   │   ├── report.schema.ts
│   │   └── common.schema.ts           # Pagination, filter, dll
│   ├── workers/                       # pg-boss job handlers
│   │   ├── boss.ts                    # pg-boss instance + queue registration
│   │   ├── telegram-sender.worker.ts  # Send queued telegram messages
│   │   ├── daily-report.worker.ts     # Generate daily report cron
│   │   ├── stock-alert.worker.ts      # Check critical stock + alert
│   │   ├── pdf-export.worker.ts       # Generate PDF in background
│   │   ├── shift-reminder.worker.ts   # (Asumsi) remind kasir end shift
│   │   └── ai-cleanup.worker.ts       # Cleanup old AI history (>90 hari)
│   ├── lib/                           # Internal helpers
│   │   ├── errors.ts                  # Custom error classes (AppError, ValidationError, dll)
│   │   ├── jwt.ts                     # JWT sign/verify helpers
│   │   ├── password.ts                # Hash/verify with argon2
│   │   ├── pin.ts                     # PIN hashing + rate limit
│   │   ├── pagination.ts              # Pagination helpers
│   │   ├── filter.ts                  # Query filter parser
│   │   ├── date.ts                    # Date/timezone helpers
│   │   ├── currency.ts                # Money formatting (display only)
│   │   ├── idempotency.ts             # Idempotency-Key cache
│   │   └── request-context.ts         # Per-request context (request_id, user, dll)
│   ├── types/
│   │   ├── api.ts                     # API response types
│   │   ├── domain.ts                  # Domain entity types
│   │   ├── context.ts                 # Elysia context augmentation
│   │   └── env.d.ts                   # Process env types
│   └── utils/
│       ├── logger.ts                  # Logger instance
│       └── tracer.ts                  # Request tracing
├── tests/
│   ├── unit/                          # Service + repo unit tests
│   ├── integration/                   # Route + DB integration
│   └── e2e/                           # End-to-end API tests
├── package.json
├── tsconfig.json
├── bun.lock
├── drizzle.config.ts                  # Drizzle Kit config
├── Dockerfile
├── .env.example
└── README.md
```

## 4. Entry Point & Elysia App

```typescript
// src/index.ts
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { env } from './config/env';
import { logger } from './config/logger';
import { db } from './config/database';
import { registerMiddleware } from './middleware';
import { registerRoutes } from './routes';
import { startWorkers } from './workers/boss';

const app = new Elysia()
  .use(cors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
  }))
  .use(swagger({
    path: '/api/docs',
    documentation: { /* OpenAPI spec */ }
  }))
  .onStart(async () => {
    logger.info('HEKAS API starting...');
    await startWorkers();
    logger.info('Workers started');
  })
  .onStop(async () => {
    logger.info('HEKAS API stopping...');
    await db.$client.end();
  });

registerMiddleware(app);
registerRoutes(app);

app.listen({ port: env.PORT, hostname: '0.0.0.0' }, (server) => {
  logger.info(`🦊 HEKAS API running at ${server.url}`);
});
```

## 5. Middleware Pipeline

Urutan middleware di Elysia (sebelum route handler):

```
Request
  ↓
[1] Request ID         → X-Request-ID header (generate jika tidak ada)
  ↓
[2] Logger             → Log entry (method, path, request_id)
  ↓
[3] CORS               → Handle preflight + headers
  ↓
[4] Body Parser        → Parse JSON + multipart (built-in Elysia)
  ↓
[5] Rate Limit         → Per-IP + per-user limit
  ↓
[6] Auth (JWT)         → Verify token, populate ctx.user
  ↓
[7] RBAC               → Periksa role untuk route ini
  ↓
[8] Outlet Scope       → Inject outlet_id filter ke ctx
  ↓
[9] Validation         → Zod validate body/query/params
  ↓
[10] Route Handler     → Call service
  ↓
[11] Audit Log         → Untuk aksi sensitif (POST/PATCH/DELETE tertentu)
  ↓
[12] Logger Response   → Log exit (status, duration)
  ↓
Response
```

### 5.1 Implementasi Middleware

```typescript
// src/middleware/auth.ts
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { env } from '../config/env';
import { UnauthorizedError } from '../lib/errors';
import type { Role } from '../../shared/types';

export const authMiddleware = new Elysia({ name: 'auth' })
  .use(jwt({
    name: 'jwt',
    secret: env.JWT_SECRET,
    exp: '12h'
  }))
  .derive(async ({ jwt, cookie, set }) => {
    const token = cookie.hekas_token?.value;

    if (!token) {
      throw new UnauthorizedError('Token tidak ditemukan');
    }

    const payload = await jwt.verify(token);

    if (!payload) {
      throw new UnauthorizedError('Token tidak valid atau kadaluarsa');
    }

    return {
      user: payload as {
        id: string;
        username: string;
        role: Role;
        outlet_id: number;
      }
    };
  });
```

```typescript
// src/middleware/rbac.ts
import { Elysia } from 'elysia';
import { ForbiddenError } from '../lib/errors';
import type { Role } from '../../shared/types';

type RouteRoles = Role[];

export const rbacMiddleware = (allowedRoles: RouteRoles) =>
  new Elysia({ name: `rbac-${allowedRoles.join('-')}` })
    .onBeforeHandle(({ user, set }) => {
      if (!allowedRoles.includes(user.role)) {
        set.status = 403;
        throw new ForbiddenError(
          `Role ${user.role} tidak punya akses ke endpoint ini`
        );
      }
    });
```

```typescript
// src/middleware/audit.ts
import { Elysia } from 'elysia';
import { auditRepo } from '../repositories/audit.repo';

const AUDITED_ROUTES = [
  'POST /api/orders/:id/void',
  'POST /api/orders/:id/complete',
  'POST /api/shifts/:id/end',
  'POST /api/products/:id/restock',
  'POST /api/incoming-goods/:id/verify',
  'POST /api/surat-jalan/:id/approve',
  'POST /api/surat-jalan/:id/reject',
];

export const auditMiddleware = new Elysia({ name: 'audit' })
  .onAfterHandle(async ({ request, user, params, body, response }) => {
    const routeKey = `${request.method} ${new URL(request.url).pathname}`;
    const auditedPath = AUDITED_ROUTES.find(r => matchRoute(r, routeKey, params));

    if (!auditedPath) return;

    await auditRepo.create({
      actor_id: user.id,
      action: auditedPath.split(' ')[1].split('/').pop(),
      entity_type: auditedPath.split('/')[2],
      entity_id: String(params.id),
      payload: { before: null, after: response },
      ip_address: request.headers.get('x-forwarded-for')
    });
  });
```

## 6. Layer Architecture

### 6.1 Layer Hierarchy

```
HTTP Request
    ↓
Route Handler        (HTTP-specific: parse req, format res)
    ↓
Service              (Business logic, orchestration, transactions)
    ↓
Repository           (DB queries, no business logic)
    ↓
Drizzle ORM
    ↓
PostgreSQL
```

**Prinsip**:
- Route handler: tidak ada business logic. Hanya parse + call service + format response.
- Service: orchestrate multiple repos, enforce invariants, handle transactions.
- Repository: hanya Drizzle queries. Tidak ada validasi bisnis.

### 6.2 Contoh: Complete Order

```typescript
// src/routes/orders.ts (route)
.post('/complete', async ({ params, body, user }) => {
  const order = await orderService.completeOrder(
    params.id,
    body.payment,
    user.id
  );
  return { ok: true, data: order };
}, {
  body: z.object({
    payment: z.object({
      method: z.enum(['TUNAI', 'QRIS', 'DEBIT']),
      amount: z.number().positive(),
      received: z.number().positive().optional()
    })
  })
})
```

```typescript
// src/services/order.service.ts (business logic)
export const orderService = {
  async completeOrder(
    orderId: number,
    payment: PaymentInput,
    userId: string
  ): Promise<Order> {
    return await db.transaction(async (tx) => {
      // 1. Lock order
      const order = await orderRepo.findByIdForUpdate(tx, orderId);
      if (!order) throw new NotFoundError('Order tidak ditemukan');
      if (order.status !== 'DRAFT') {
        throw new InvalidStateError('Order bukan DRAFT');
      }

      // 2. Validate stock
      for (const item of order.items) {
        const stock = await stockRepo.findByProduct(tx, item.product_id);
        if (stock.quantity < item.qty) {
          throw new ConflictError('INSUFFICIENT_STOCK', {
            product_id: item.product_id,
            requested: item.qty,
            available: stock.quantity
          });
        }
      }

      // 3. Deduct stock + insert movements
      for (const item of order.items) {
        await stockRepo.decrement(tx, item.product_id, item.qty);
        await stockMovementRepo.insert(tx, {
          product_id: item.product_id,
          movement_type: 'out_sale',
          quantity_delta: -item.qty,
          reference_type: 'order',
          reference_id: orderId,
          created_by: userId
        });
      }

      // 4. Insert payment
      await paymentRepo.insert(tx, {
        order_id: orderId,
        method: payment.method,
        amount: payment.amount,
        received: payment.received,
        change_amount: payment.received
          ? Math.max(0, payment.received - order.total)
          : null
      });

      // 5. Update order status
      const updated = await orderRepo.markCompleted(tx, orderId, {
        shift_id: await shiftService.getActiveShiftId(tx, userId),
        total: order.total
      });

      // 6. Update shift counter (best effort, dalam tx)
      await shiftRepo.incrementCounters(tx, /* shiftId */, payment.method, order.total);

      // 7. Enqueue telegram notification (non-blocking)
      if (order.member_id) {
        await notificationService.enqueue('order_member_purchase', {
          member_id: order.member_id,
          order_id: orderId,
          total: order.total
        });
      }

      return updated;
    });
  },

  async voidOrder(orderId: number, pin: string, reason: string, userId: string) {
    // 1. Verify PIN
    await pinService.verify(userId, 'void_order', pin);

    return await db.transaction(async (tx) => {
      const order = await orderRepo.findByIdForUpdate(tx, orderId);
      if (!order) throw new NotFoundError('Order tidak ditemukan');
      if (order.status !== 'SELESAI') {
        throw new InvalidStateError('Hanya order SELESAI yang bisa di-void');
      }

      // 2. Restore stock
      for (const item of order.items) {
        await stockRepo.increment(tx, item.product_id, item.qty);
        await stockMovementRepo.insert(tx, {
          product_id: item.product_id,
          movement_type: 'out_void_restore',
          quantity_delta: item.qty,
          reference_type: 'order',
          reference_id: orderId,
          created_by: userId
        });
      }

      // 3. Update order
      return await orderRepo.markVoided(tx, orderId, {
        voided_by: userId,
        void_reason: reason
      });
    });
  }
};
```

```typescript
// src/repositories/order.repo.ts (DB queries only)
export const orderRepo = {
  async findByIdForUpdate(tx: Tx, id: number): Promise<Order | null> {
    return await tx
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .for('update')           // row lock
      .then(rows => rows[0] ?? null);
  },

  async markCompleted(tx: Tx, id: number, data: { shift_id: number; total: number }): Promise<Order> {
    const [updated] = await tx
      .update(orders)
      .set({
        status: 'SELESAI',
        shift_id: data.shift_id,
        total: data.total,
        completed_at: new Date()
      })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  },

  async markVoided(tx: Tx, id: number, data: { voided_by: string; void_reason: string }): Promise<Order> {
    const [updated] = await tx
      .update(orders)
      .set({
        status: 'VOID',
        voided_by: data.voided_by,
        void_reason: data.void_reason,
        voided_at: new Date()
      })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  // ... more queries
};
```

## 7. Database Access

### 7.1 Drizzle Setup

```typescript
// src/config/database.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env';
import * as schema from '../db/schema';

export const client = postgres(env.DATABASE_URL, {
  max: env.DB_POOL_MAX,          // default 10
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false                // disable for pg-boss compatibility
});

export const db = drizzle(client, { schema });

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
```

### 7.2 Migration Workflow

```bash
# Generate migration setelah schema update
bun run drizzle-kit generate

# Apply migration
bun run drizzle-kit migrate

# Push schema (dev only, no migration file)
bun run drizzle-kit push
```

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/*',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  },
  strict: true,
  verbose: true
} satisfies Config;
```

### 7.3 Transaction Pattern

```typescript
// Gunakan db.transaction untuk atomic multi-step operations
const result = await db.transaction(async (tx) => {
  // ... multiple queries
}, {
  isolationLevel: 'read committed',  // default
  accessMode: 'read write'
});

// Read-only transactions (untuk reports)
const data = await db.transaction(async (tx) => {
  // ... read-only queries
}, {
  isolationLevel: 'repeatable read',
  accessMode: 'read only'
});
```

## 8. Validation Layer

Zod schemas didefinisikan di `validators/` dan digunakan untuk:
- Route body/query/params validation
- Service input validation
- Shared types dengan frontend (via monorepo package)

```typescript
// src/validators/product.schema.ts
import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().min(1).max(64),
  barcode: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  category_id: z.number().int().positive(),
  unit: z.enum(['pcs', 'btl', 'kg', 'ltr', 'bks']),
  price_sell: z.number().positive(),
  price_buy: z.number().positive(),
  min_stock: z.number().int().nonnegative().default(0)
});

export const updateProductSchema = createProductSchema.partial();

export const restockSchema = z.object({
  quantity: z.number().int().positive(),
  supplier_id: z.number().int().positive(),
  notes: z.string().max(500).optional()
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type RestockDto = z.infer<typeof restockSchema>;
```

## 9. Error Handling

### 9.1 Custom Error Classes

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Tidak terautentikasi') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details?: any) {
    super(code, message, 409, details);
  }
}

export class InvalidStateError extends AppError {
  constructor(message: string) {
    super('INVALID_STATE', message, 422);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Terlalu banyak permintaan', retryAfter?: number) {
    super('RATE_LIMIT_EXCEEDED', message, 429, { retry_after: retryAfter });
  }
}
```

### 9.2 Global Error Handler

```typescript
// src/middleware/error-handler.ts
import { Elysia } from 'elysia';
import { AppError } from '../lib/errors';
import { logger } from '../config/logger';

export const errorHandler = new Elysia({ name: 'error-handler' })
  .onError(({ error, set, request }) => {
    const requestId = request.headers.get('x-request-id') ?? 'unknown';

    if (error instanceof AppError) {
      set.status = error.statusCode;
      logger.warn({
        request_id: requestId,
        code: error.code,
        message: error.message,
        details: error.details
      });
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          request_id: requestId
        }
      };
    }

    // Unknown error
    logger.error({
      request_id: requestId,
      error: error.message,
      stack: error.stack
    });

    set.status = 500;
    return {
      ok: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan pada server',
        request_id: requestId
      }
    };
  });
```

## 10. Background Workers (pg-boss)

### 10.1 Setup

```typescript
// src/workers/boss.ts
import PgBoss from 'pg-boss';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
  schema: 'pgboss',
  retryLimit: 5,
  retryBackoff: true,
  retryDelay: 30  // 30s base, exponential
});

// Register workers
boss.work('telegram.send', { teamSize: 5 }, telegramSenderWorker.handle);
boss.work('daily-report.generate', { teamSize: 1 }, dailyReportWorker.handle);
boss.work('stock-alert.check', { teamSize: 1 }, stockAlertWorker.handle);
boss.work('pdf-export.generate', { teamSize: 3 }, pdfExportWorker.handle);
boss.work('ai-cleanup.purge', { teamSize: 1 }, aiCleanupWorker.handle);

// Schedules
boss.schedule('daily-report.generate', '0 0 * * *', { tz: 'Asia/Jakarta' });   // 00:00 WIB
boss.schedule('stock-alert.check', '0 */1 * * *', { tz: 'Asia/Jakarta' });     // setiap jam
boss.schedule('ai-cleanup.purge', '0 3 * * 0', { tz: 'Asia/Jakarta' });        // Minggu 03:00 WIB

export async function startWorkers() {
  await boss.start();
  logger.info('pg-boss workers started');
}
```

### 10.2 Contoh: Telegram Sender Worker

```typescript
// src/workers/telegram-sender.worker.ts
import { boss } from './boss';
import { telegramRepo } from '../repositories/telegram.repo';
import { sendTelegramMessage } from '../lib/telegram';
import { logger } from '../config/logger';

export const telegramSenderWorker = {
  async handle(job: any) {
    const { queue_id, telegram_message_id } = job.data;

    const queue = await telegramRepo.findQueueItem(queue_id);
    if (!queue) {
      logger.warn(`Queue item ${queue_id} not found`);
      return;
    }

    try {
      const result = await sendTelegramMessage(
        queue.target,
        queue.payload.text,
        queue.payload.options
      );

      await telegramRepo.updateQueueStatus(queue_id, 'DONE');
      await telegramRepo.insertMessage({
        chat_id: queue.target,
        event_type: queue.payload.event_type,
        payload: queue.payload,
        status: 'SENT',
        attempts: queue.attempts + 1,
        sent_at: new Date()
      });

      logger.info(`Telegram sent to ${queue.target} for ${queue.payload.event_type}`);
    } catch (err) {
      const newAttempts = queue.attempts + 1;
      const maxAttempts = 5;

      if (newAttempts >= maxAttempts) {
        await telegramRepo.updateQueueStatus(queue_id, 'FAILED', err.message);
        await telegramRepo.insertMessage({
          chat_id: queue.target,
          event_type: queue.payload.event_type,
          payload: queue.payload,
          status: 'FAILED',
          attempts: newAttempts,
          last_error: err.message
        });
        logger.error(`Telegram FAILED after ${newAttempts} attempts: ${err.message}`);
      } else {
        const nextRetry = new Date(Date.now() + Math.pow(2, newAttempts) * 60_000); // exponential backoff
        await telegramRepo.updateQueueRetry(queue_id, newAttempts, nextRetry, err.message);
        throw err; // pg-boss will retry
      }
    }
  }
};
```

### 10.3 Job Enqueue Pattern

```typescript
// src/services/notification.service.ts
export const notificationService = {
  async enqueueTelegram(eventType: string, payload: any, targets: string[]) {
    for (const target of targets) {
      await boss.send('telegram.send', {
        payload: {
          event_type: eventType,
          text: renderMessage(eventType, payload),
          options: payload.options || {}
        },
        target
      }, {
        retryLimit: 5,
        retryDelay: 30
      });
    }
  },

  async enqueuePdfExport(reportType: string, filters: any, userId: string) {
    const jobId = await boss.send('pdf-export.generate', {
      report_type: reportType,
      filters,
      requested_by: userId
    });
    return jobId;
  }
};
```

## 11. Auth & Session

### 11.1 Login Flow

```typescript
// src/services/auth.service.ts
import argon2 from '@node-rs/argon2';
import { jwt } from '@elysiajs/jwt';
import { env } from '../config/env';
import { userRepo } from '../repositories/user.repo';
import { UnauthorizedError, RateLimitError } from '../lib/errors';

export const authService = {
  async login(username: string, password: string) {
    const user = await userRepo.findByUsername(username);
    if (!user || !user.is_active) {
      throw new UnauthorizedError('Username atau password salah');
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      throw new UnauthorizedError('Username atau password salah');
    }

    const token = await jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role,
      outlet_id: user.outlet_id
    });

    await userRepo.updateLastLogin(user.id, new Date());
    await userRepo.createSession({
      user_id: user.id,
      token_hash: await hashToken(token),
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000)
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        outlet_id: user.outlet_id
      },
      expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000)
    };
  },

  async logout(token: string) {
    const tokenHash = await hashToken(token);
    await userRepo.revokeSession(tokenHash);
  },

  async verifyPin(userId: string, action: string, pin: string) {
    // 1. Rate limit
    const recentAttempts = await pinRepo.countRecentAttempts(userId, action, 60);
    if (recentAttempts >= 5) {
      throw new RateLimitError('Terlalu banyak percobaan PIN', 3600);
    }

    // 2. Verify PIN
    const user = await userRepo.findById(userId);
    if (!user || !user.pin_hash) {
      throw new UnauthorizedError('PIN belum diatur');
    }

    const valid = await argon2.verify(user.pin_hash, pin);
    await pinRepo.logAttempt(userId, action, valid);

    if (!valid) {
      throw new UnauthorizedError('PIN salah');
    }
  }
};

async function hashToken(token: string): Promise<string> {
  // Use SHA-256 for token hash (fast, since JWT is high-entropy)
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

## 12. RBAC Implementation

Defense in depth:
1. **Route guard** (`rbacMiddleware`) — periksa role sebelum route handler.
2. **Service guard** — periksa role lagi di service layer.
3. **DB constraint** — beberapa aksi sensitive di-enforce via DB constraint.

```typescript
// src/routes/products.ts
.get('/', async ({ user, query }) => {
  if (user.role === 'kasir') {
    return productRepo.findActive(user.outlet_id, query);
  }
  return productRepo.findAll(user.outlet_id, query);
}, { /* kasir, gudang, manager */ })
```

```typescript
// src/services/surat.service.ts
async approve(suratId: number, userId: string, userRole: Role) {
  if (userRole !== 'manager') {
    throw new ForbiddenError('Hanya Manager yang bisa approve SJ');
  }
  // ... business logic
}
```

## 13. Logging & Monitoring

### 13.1 Structured Logging

```typescript
// src/config/logger.ts
import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL || 'info',
  transport: env.NODE_ENV === 'production'
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true } },
  base: {
    service: 'hekas-api',
    version: env.APP_VERSION
  }
});
```

### 13.2 Request Logging

```typescript
// src/middleware/logger.ts
export const loggerMiddleware = new Elysia({ name: 'logger' })
  .onRequest(({ request, set }) => {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    set.headers['x-request-id'] = requestId;
    logger.info({
      request_id: requestId,
      method: request.method,
      url: request.url,
      ip: request.headers.get('x-forwarded-for')
    }, 'request_start');
  })
  .onAfterHandle(({ request, set }) => {
    const requestId = set.headers['x-request-id'];
    logger.info({
      request_id: requestId,
      method: request.method,
      url: request.url,
      status: set.status
    }, 'request_end');
  });
```

## 14. Security

| Concern              | Mitigation                                          |
|----------------------|-----------------------------------------------------|
| SQL injection        | Drizzle ORM (parameterized queries)                 |
| XSS                  | Frontend render escaping (Svelte default)          |
| CSRF                 | SameSite cookie + JWT di Authorization header      |
| Brute force login    | Rate limit 5/menit per IP                           |
| Brute force PIN      | Rate limit 5/jam per user                           |
| Password storage     | Argon2id hash                                       |
| Token theft          | HTTP-only cookie + short expiry (12h)               |
| Token reuse          | Hash token di DB, bisa revoke                       |
| Audit trail          | Append-only `audit_logs` (DB trigger enforce)       |
| Stock race condition | `FOR UPDATE` row lock dalam transaction             |
| Telegram webhook     | Verify `X-Telegram-Bot-Api-Secret-Token` header    |
| Rate limit DoS       | Global rate limit + per-endpoint                    |
| Input validation     | Zod schema validation di semua input                |
| File upload          | Size limit, type whitelist, virus scan (Asumsi)     |

## 15. Testing Strategy

| Level          | Tool            | Cakupan                                |
|----------------|-----------------|----------------------------------------|
| Unit           | Vitest          | Service pure functions, utils          |
| Integration    | Vitest + test DB | Service + Repo dengan real DB         |
| API            | Vitest + supertest | HTTP request/response via Elysia    |
| E2E            | bun test + Docker | Full flow dari login ke action        |

Critical integration tests:
- Login flow (valid, invalid, rate limit)
- POS complete (atomic transaction)
- Void order (stock restore + audit)
- PO verify (stock update + movement)
- SJ approve 2-stage
- Telegram queue retry

Test DB: gunakan schema terpisah atau container per test run.

## 16. Build & Deploy

### 16.1 Build

```bash
# Install
bun install

# Dev (hot reload)
bun run dev

# Build (production binary)
bun build src/index.ts --target=bun --outfile=dist/api --minify

# Run production
./dist/api
```

### 16.2 Dockerfile

```dockerfile
FROM oven/bun:1.1 AS base
WORKDIR /app

# Install deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY src ./src
COPY drizzle.config.ts ./

# Build
FROM base AS build
RUN bun build src/index.ts --target=bun --outfile=dist/api --minify

# Run
FROM oven/bun:1.1
WORKDIR /app
COPY --from=build /app/dist/api /app/dist/api
COPY --from=build /app/src/db/migrations /app/src/db/migrations
ENV NODE_ENV=production
EXPOSE 3001
CMD ["/app/dist/api"]
```

### 16.3 Environment Variables

```bash
# .env.example
NODE_ENV=development
PORT=3001
APP_VERSION=1.0.0

DATABASE_URL=postgres://user:pass@localhost:5432/hekas_pos
DB_POOL_MAX=10

JWT_SECRET=change-me-to-32-byte-random-string
JWT_EXPIRES_IN=12h

CORS_ORIGINS=http://localhost:5173,https://app.hekas.id

TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_WEBHOOK_SECRET=xxx

LOG_LEVEL=info

# Sentry (Asumsi)
SENTRY_DSN=
```

## 17. Catatan & Prinsip Backend

### 17.1 Yang TIDAK Boleh Dilakukan

1. **Jangan business logic di route handler**. Route hanya parse + delegate.
2. **Jangan raw SQL**. Selalu Drizzle query builder.
3. **Jangan SELECT \***. Selalu specify columns yang dibutuhkan (perf).
4. **Jangan N+1 query**. Pakai Drizzle `with` (eager loading) atau batch query.
5. **Jangan lupa transaction**. Multi-step write WAJIB `db.transaction()`.
6. **Jangan expose password_hash / pin_hash ke response**.
7. **Jangan trust client-side role check**. Backend selalu re-verify.
8. **Jangan simpan secret di git**. Pakai env vars.
9. **Jangan skip rate limit**. Bahkan untuk endpoint internal.
10. **Jangan lupa timeout di external API call** (Telegram, payment).

### 17.2 Performance Target

| Metric                      | Target              |
|-----------------------------|---------------------|
| API response p95            | < 200ms             |
| API response p99            | < 500ms             |
| DB query p95                | < 50ms              |
| Background job throughput   | 100 jobs/min        |
| Telegram send throughput    | 50 msg/min          |
| Uptime                      | 99.5% (Asumsi)      |

### 17.3 Prinsip Scaling (Tahap 2)

- **Horizontal**: stateless API bisa di-scale ke N instance, share DB.
- **Vertical**: pg-boss worker bisa di-scale per queue (teamSize).
- **Read replica**: untuk reports heavy query (Asumsi Tahap 2).
- **Cache layer**: Redis untuk session & idempotency cache (Asumsi Tahap 2).
- **CDN**: untuk static asset + image (Asumsi Tahap 2).

## 18. Open Questions

1. **Session storage**: JWT only atau DB-backed mandatory? Saat ini hybrid (JWT + DB session tracking untuk revocation). Bisa pure JWT tanpa DB kalau OK tanpa revocation.
2. **Refresh token**: Sliding window (extend on activity) atau fixed 12h tanpa refresh? (Asumsi: sliding 12h, auto-extend jika user aktif)
3. **Multi-tenancy**: Single DB single schema atau schema-per-outlet? (Asumsi: single DB single schema dengan `outlet_id` filter)
4. **Backup strategy**: pg_dump harian atau WAL archiving? (Asumsi: WAL archiving untuk prod)
5. **API versioning**: path-based `/api/v1` atau header-based? (Asumsi: path-based)
6. **OpenAPI generation**: Auto-generate dari zod schema atau manual? (Asumsi: pakai `@elysiajs/swagger` dengan zod-to-openapi)
7. **GraphQL**: REST saja atau tambah GraphQL untuk flexible query? (Asumsi: REST only, GraphQL Tahap 2 kalau perlu)
8. **Real-time push**: SSE (Server-Sent Events) atau WebSocket? (Asumsi: SSE untuk MVP, WebSocket Tahap 2)

---

**Akhir dokumen BACKEND_ARCHITECTURE.md**
