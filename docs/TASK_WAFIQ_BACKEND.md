# TASK BREAKDOWN — WAFIQ (BACKEND LEAD)

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Detail task breakdown untuk backend developer (Wafiq)
**Dasar**: `DEVELOPMENT_ROADMAP.md` v1.0.0 + `BACKEND_ARCHITECTURE.md` v1.0.0 + `TELEGRAM_INTEGRATION.md` v1.0.0 + `DATABASE_DESIGN.md` v1.0.0 + `API_SPEC.md` v1.0.0
**Project root**: `/home/jazli/hekas-pos/apps/api/` (akan dibuat)
**Frontend sync**: Jazli (lihat `TASK_JAZLI_FRONTEND.md`)

---

## 1. Ringkasan

Tugas backend owner: **Wafiq**. Total estimasi: **~109 hari kerja** (~22 sprint × ~5 hari kerja, atau ~5.5 bulan kalender full-time). Parallel dengan frontend Jazli.

> **Catatan**: Estimasi hari kerja termasuk schema design, migration, test, dan revisi. Beberapa gate (Gate 3 Telegram) lebih berat di backend.

## 2. Workflow Harian

| Jam          | Aktivitas                                                              |
|--------------|------------------------------------------------------------------------|
| 09:00-09:15  | Daily standup (async atau sync dengan Jazli)                           |
| 09:15-12:00  | Coding block 1 (schema design, business logic)                        |
| 12:00-13:00  | Istirahat                                                              |
| 13:00-15:30  | Coding block 2 (routes, services, integration)                        |
| 15:30-16:00  | Code review (PR dari Jazli atau junior)                                |
| 16:00-17:00  | Testing (unit, integration) + bugfix                                   |
| 17:00-17:30  | Update task board + eskalasi blocker ke pak bos                        |

## 3. Konvensi Kode (Backend)

### 3.1 Naming

| Jenis              | Convention                | Contoh                                   |
|--------------------|---------------------------|------------------------------------------|
| File (TS)          | kebab-case.ts             | `order.service.ts`                       |
| Class              | PascalCase                | `OrderService`                           |
| Function (export)  | camelCase                 | `completeOrder`                          |
| Variable (local)   | camelCase                 | `orderId`, `isLoading`                   |
| Constant           | UPPER_SNAKE_CASE          | `MAX_RETRY_ATTEMPTS`                     |
| Type/Interface     | PascalCase                | `Order`, `CreateOrderInput`              |
| Drizzle table      | camelCase (plural)        | `orders`, `orderItems`                   |
| DB column          | snake_case                | `order_id`, `created_at`                 |
| Enum value (TS)    | camelCase                 | `stockMovementType.out_sale`             |
| Enum value (DB)    | UPPER_SNAKE_CASE          | `out_sale` (lihat DATABASE_DESIGN §5)   |
| API path           | kebab-case (plural)       | `/api/incoming-goods`                    |
| Env var            | UPPER_SNAKE_CASE          | `DATABASE_URL`                           |

### 3.2 Git Workflow

Sama dengan frontend:
- **Branch naming**: `feat/...`, `fix/...`, `chore/...`, `refactor/...`
- Contoh: `feat/pos-orders-atomic`, `fix/telegram-retry-attempts`
- **Commit**: Conventional Commits
- **PR review**: 1 approval required
- **Squash merge** ke `main`

### 3.3 Quality Gate (per PR)

- [ ] TypeScript: zero error (`bun run check`)
- [ ] Lint: zero warning (`bun run lint`)
- [ ] Migration generated & tested locally (`bun run db:migrate`)
- [ ] Unit tests pass (`bun run test`)
- [ ] Integration tests pass (`bun run test:integration`)
- [ ] Build sukses (`bun run build`)
- [ ] API documentation updated (jika endpoint baru)
- [ ] Audit log untuk aksi destruktif (verify di PR)

## 4. Task Detail per Gate

### Gate 0 — Foundation (Sprint 1-2, ~12 hari kerja)

| # | Task | File/Folder | Detail | Estimasi |
|---|------|-------------|--------|----------|
| 0.1 | Setup monorepo | `package.json`, `bun.lock` | Bun workspaces: apps/web, apps/api, packages/shared | 1 hari |
| 0.2 | Setup ElysiaJS | `apps/api/src/index.ts`, `package.json` | Elysia + CORS + Swagger plugin | 1 hari |
| 0.3 | Env validation | `apps/api/src/config/env.ts` | Zod-validated env vars | 0.5 hari |
| 0.4 | Database config | `apps/api/src/config/database.ts` | postgres-js + Drizzle | 0.5 hari |
| 0.5 | Logger setup | `apps/api/src/config/logger.ts` | Pino + pino-pretty dev | 0.5 hari |
| 0.6 | Drizzle config | `apps/api/drizzle.config.ts` | Migration setup | 0.5 hari |
| 0.7 | Schema: Auth | `apps/api/src/db/schema/auth.ts` | users, user_sessions, pin_attempts | 1 hari |
| 0.8 | Schema: Master | `apps/api/src/db/schema/master.ts` | categories, products, product_images, suppliers, members | 1 hari |
| 0.9 | Schema: Stock | `apps/api/src/db/schema/stock.ts` | stocks, stock_movements, stock_adjustments | 0.5 hari |
| 0.10 | Schema: POS | `apps/api/src/db/schema/pos.ts` | orders, order_items, payments, held_drafts | 1 hari |
| 0.11 | Schema: Shift | `apps/api/src/db/schema/shift.ts` | shifts, shift_handovers | 0.5 hari |
| 0.12 | Schema: Inventory | `apps/api/src/db/schema/inventory.ts` | incoming/outgoing/surat | 1 hari |
| 0.13 | Schema: HR | `apps/api/src/db/schema/hr.ts` | employees, attendances, leave_requests, employee_performances | 0.5 hari |
| 0.14 | Schema: Reports | `apps/api/src/db/schema/reports.ts` | daily_reports, report_snapshots | 0.5 hari |
| 0.15 | Schema: Telegram | `apps/api/src/db/schema/telegram.ts` | telegram_links, telegram_messages, notification_queue | 0.5 hari |
| 0.16 | Schema: AI | `apps/api/src/db/schema/ai.ts` | ai_conversations, ai_messages | 0.5 hari |
| 0.17 | Schema: System | `apps/api/src/db/schema/system.ts` | audit_logs, outlet_settings, system_settings, devices, printers | 0.5 hari |
| 0.18 | Enum exports | `apps/api/src/db/enums.ts` | pgEnum semua enum terpusat | 0.5 hari |
| 0.19 | Generate + apply migration | Terminal commands | `bun drizzle-kit generate` + migrate | 0.5 hari |
| 0.20 | Seed script | `apps/api/src/db/seed.ts` | 1 outlet, 6 kategori, 20 sample products, 3 users (satu per role), 4 members sample | 1 hari |
| 0.21 | JWT module | `apps/api/src/lib/jwt.ts` | sign + verify + refresh | 0.5 hari |
| 0.22 | Password module | `apps/api/src/lib/password.ts` | argon2 hash + verify | 0.5 hari |
| 0.23 | Error classes | `apps/api/src/lib/errors.ts` | AppError + 7 subclasses | 0.5 hari |
| 0.24 | Error handler middleware | `apps/api/src/middleware/error-handler.ts` | Global error handler | 0.5 hari |
| 0.25 | Logger middleware | `apps/api/src/middleware/logger.ts` | Request/response log + X-Request-ID | 0.5 hari |
| 0.26 | Auth middleware | `apps/api/src/middleware/auth.ts` | Verify JWT, populate context.user | 0.5 hari |
| 0.27 | RBAC middleware | `apps/api/src/middleware/rbac.ts` | Per-route role check | 0.5 hari |
| 0.28 | Auth service | `apps/api/src/services/auth.service.ts` | login + logout + refresh + me | 1 hari |
| 0.29 | User repository | `apps/api/src/repositories/user.repo.ts` | findByUsername, findById, createSession | 0.5 hari |
| 0.30 | Auth routes | `apps/api/src/routes/auth.ts` | /api/auth/* endpoints | 0.5 hari |
| 0.31 | Health route | `apps/api/src/routes/health.ts` | /api/health, /api/version | 0.25 hari |
| 0.32 | Validators: Auth | `apps/api/src/validators/auth.schema.ts` | Zod schemas untuk login | 0.5 hari |
| 0.33 | pg-boss setup | `apps/api/src/workers/boss.ts` | Connection + queue registration | 0.5 hari |
| 0.34 | Test setup | `apps/api/tests/` + bun test config | Test environment dengan test DB | 1 hari |

**Total Gate 0 backend**: ~19 hari kerja (di roadmap 12 hari, lebih detail dengan breakdown schema)

---

### Gate 1 — Auth + POS (Sprint 3-4, ~16.5 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 1.1 | Product repository | `src/repositories/product.repo.ts` | findActive, findAll, search, findById | 0.5 hari |
| 1.2 | Product service | `src/services/product.service.ts` | list, get, search, filter logic | 0.5 hari |
| 1.3 | Product validators | `src/validators/product.schema.ts` | Zod schemas | 0.5 hari |
| 1.4 | Products routes | `src/routes/products.ts` | GET /products, /:id | 0.5 hari |
| 1.5 | Categories routes | `src/routes/categories.ts` | GET /categories | 0.25 hari |
| 1.6 | Member repository | `src/repositories/member.repo.ts` | find, search | 0.25 hari |
| 1.7 | Member routes | `src/routes/members.ts` | GET /members, /:id, purchase-history | 0.5 hari |
| 1.8 | Stock repository | `src/repositories/stock.repo.ts` | find, increment, decrement (FOR UPDATE) | 1 hari |
| 1.9 | Stock movement repository | `src/repositories/stock-movement.repo.ts` | insert (append-only) | 0.5 hari |
| 1.10 | Order repository | `src/repositories/order.repo.ts` | CRUD + findByIdForUpdate + list + search | 1 hari |
| 1.11 | Order item repository | `src/repositories/order-item.repo.ts` | CRUD + snapshot logic | 0.5 hari |
| 1.12 | Payment repository | `src/repositories/payment.repo.ts` | insert, find | 0.25 hari |
| 1.13 | Order service | `src/services/order.service.ts` | create (DRAFT), update, completeOrder (ATOMIC), voidOrder, hold, resume | 3 hari |
| 1.14 | Order validators | `src/validators/order.schema.ts` | Zod schemas | 0.5 hari |
| 1.15 | Orders routes | `src/routes/orders.ts` | POST /orders, GET /:id, /, POST /complete, /void, /hold, /held-drafts, /:id/resume | 1.5 hari |
| 1.16 | Shift repository | `src/repositories/shift.repo.ts` | CRUD + findActive + summary aggregations | 1 hari |
| 1.17 | Shift handover repository | `src/repositories/shift-handover.repo.ts` | insert + get | 0.25 hari |
| 1.18 | PIN service | `src/services/pin.service.ts` | verify + rate limit (5/hour) | 1 hari |
| 1.19 | PIN repository | `src/repositories/pin.repo.ts` | log attempt + count recent | 0.5 hari |
| 1.20 | Shift service | `src/services/shift.service.ts` | start + end (with PIN) + summary | 2 hari |
| 1.21 | Shift validators | `src/validators/shift.schema.ts` | Zod schemas | 0.25 hari |
| 1.22 | Shifts routes | `src/routes/shifts.ts` | POST /shifts/start, /:id/end, GET /, /active, /:id, /:id/summary | 1 hari |
| 1.23 | Held draft repository | `src/repositories/held-draft.repo.ts` | CRUD | 0.25 hari |
| 1.24 | Held drafts service | `src/services/held-draft.service.ts` | save, list, resume | 0.5 hari |
| 1.25 | Idempotency helper | `src/lib/idempotency.ts` | Cache response by key | 0.5 hari |
| 1.26 | Unit tests: order service | `tests/unit/order.service.test.ts` | Complete, void, atomic test | 1 hari |
| 1.27 | Integration test: POS E2E | `tests/integration/pos.test.ts` | Full flow create → complete → void | 1 hari |

**Total Gate 1 backend**: ~18 hari kerja

---

### Gate 2 — Admin Gudang (Sprint 5-6, ~14 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 2.1 | Product service (full CRUD) | `src/services/product.service.ts` | Tambah create, update, softDelete, image upload | 1 hari |
| 2.2 | Image upload handler | `src/lib/image-upload.ts` | Multipart parser + local FS storage | 1 hari |
| 2.3 | Product image repository | `src/repositories/product-image.repo.ts` | CRUD per product | 0.5 hari |
| 2.4 | Products routes (extended) | `src/routes/products.ts` | POST, PATCH, DELETE, /:id/image, /:id/restock, /restock-bulk, /:id/stock-movements | 1 hari |
| 2.5 | Supplier repository | `src/repositories/supplier.repo.ts` | CRUD | 0.25 hari |
| 2.6 | Suppliers routes | `src/routes/suppliers.ts` | GET, POST, PATCH | 0.5 hari |
| 2.7 | Stock service | `src/services/stock.service.ts` | Restock (single + bulk) + adjustment | 1 hari |
| 2.8 | Stock adjustment repository | `src/repositories/stock-adjustment.repo.ts` | insert | 0.25 hari |
| 2.9 | Inventory routes | `src/routes/inventory.ts` | /api/inventory/summary, /export | 0.5 hari |
| 2.10 | Incoming goods repository | `src/repositories/incoming-good.repo.ts` | CRUD + items | 0.5 hari |
| 2.11 | Incoming good item repository | `src/repositories/incoming-good-item.repo.ts` | CRUD | 0.25 hari |
| 2.12 | Incoming service | `src/services/incoming.service.ts` | createPO, verify (ATOMIC stock update + movements), reject | 2 hari |
| 2.13 | Incoming routes | `src/routes/incoming-goods.ts` | GET, POST, /:id, /:id/verify, /:id/reject | 0.75 hari |
| 2.14 | Outgoing repository | `src/repositories/outgoing-good.repo.ts` | CRUD | 0.5 hari |
| 2.15 | Outgoing item repository | `src/repositories/outgoing-good-item.repo.ts` | CRUD + per-item picking | 0.25 hari |
| 2.16 | Outgoing service | `src/services/outgoing.service.ts` | create, picking process, mark sent | 1 hari |
| 2.17 | Outgoing routes | `src/routes/outgoing-goods.ts` | GET, POST, /:id, /:id/pick, /:id/mark-sent | 0.75 hari |
| 2.18 | Dashboard gudang service | `src/services/dashboard-gudang.service.ts` | Summary aggregation | 0.5 hari |
| 2.19 | Stock movement routes | extend inventory routes | GET /api/products/:id/stock-movements | 0.25 hari |
| 2.20 | Integration test: Gudang | `tests/integration/gudang.test.ts` | PO verify, restock flow | 1 hari |

**Total Gate 2 backend**: ~13 hari kerja

---

### Gate 3 — Surat Jalan Approval (Sprint 7, ~12 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 3.1 | Surat repository | `src/repositories/surat.repo.ts` | CRUD + list dengan filter | 0.5 hari |
| 3.2 | Surat item repository | `src/repositories/surat-item.repo.ts` | CRUD + snapshot logic | 0.25 hari |
| 3.3 | Surat approval repository | `src/repositories/surat-approval.repo.ts` | insert + get history | 0.25 hari |
| 3.4 | Surat service | `src/services/surat.service.ts` | createSJ, reviewGudang, approve, reject, print, mark sent | 2 hari |
| 3.5 | Surat validators | `src/validators/surat.schema.ts` | Zod schemas | 0.5 hari |
| 3.6 | Surat routes | `src/routes/surat-jalan.ts` | GET, POST, /:id, /:id/review-gudang, /:id/approve, /:id/reject, /:id/print, /:id/reprint, /:id/mark-sent | 1 hari |
| 3.7 | PDF generation lib | `src/lib/pdf.ts` | Puppeteer atau PDFKit wrapper | 1 hari |
| 3.8 | PDF service (SJ) | `src/services/pdf-sj.service.ts` | Render SJ template to PDF | 1 hari |
| 3.9 | Telegram bot setup | `src/lib/telegram.ts` | grammY bot instance + secret verify | 1 hari |
| 3.10 | Telegram link service | `src/services/telegram-link.service.ts` | Generate code, verify, link/unlink | 1 hari |
| 3.11 | Telegram link routes | `src/routes/telegram.ts` | POST /api/telegram/link, GET messages | 0.5 hari |
| 3.12 | Telegram webhook handler | `src/routes/webhook/telegram.ts` | /api/telegram/webhook endpoint | 0.5 hari |
| 3.13 | Bot command handlers | `src/workers/telegram-bot.handlers.ts` | /start, /link, /status, /unlink, /help | 1 hari |
| 3.14 | Message renderer | `src/services/telegram-message-renderer.ts` | Per-event template | 0.5 hari |
| 3.15 | Notification service | `src/services/notification.service.ts` | enqueueTelegram dengan target resolution | 1 hari |
| 3.16 | Telegram sender worker | `src/workers/telegram-sender.worker.ts` | pg-boss consume + send + retry | 1 hari |
| 3.17 | Notification queue repository | `src/repositories/notification-queue.repo.ts` | Insert + update status + retry | 0.5 hari |
| 3.18 | Telegram messages repository | `src/repositories/telegram-message.repo.ts` | Log sent/failed | 0.25 hari |
| 3.19 | Event: sj_pending_approval | extend order service | Trigger ke Manager | 0.25 hari |
| 3.20 | Event: sj_approved / rejected | extend surat service | Trigger ke Gudang | 0.25 hari |
| 3.21 | Register webhook script | `scripts/register-telegram-webhook.ts` | Setup webhook di Bot API | 0.25 hari |
| 3.22 | Integration test: SJ approval | `tests/integration/surat-jalan.test.ts` | 2-stage approval + telegram (mocked) | 1 hari |

**Total Gate 3 backend**: ~15 hari kerja

---

### Gate 4 — Manager Dashboard + Analytics (Sprint 8-9, ~14 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 4.1 | Dashboard manager service | `src/services/dashboard-manager.service.ts` | KPI aggregation + revenue + best sellers | 2 hari |
| 4.2 | Dashboard routes | `src/routes/dashboard.ts` | GET /api/dashboard/manager, /kasir | 0.5 hari |
| 4.3 | Sales analytics service | `src/services/sales-analytics.service.ts` | Time series + breakdown + best sellers | 1 hari |
| 4.4 | Inventory analytics service | `src/services/inventory-analytics.service.ts` | Fast moving + critical + valuation | 1 hari |
| 4.5 | Finance analytics service | `src/services/finance-analytics.service.ts` | Laba rugi + hutang + sumber + pengeluaran | 1.5 hari |
| 4.6 | Analytics routes | `src/routes/analytics.ts` | GET /api/analytics/{sales,inventory,finance,employees} | 0.5 hari |
| 4.7 | Settings repository | `src/repositories/settings.repo.ts` | outlet, hours, system | 0.5 hari |
| 4.8 | Settings service | `src/services/settings.service.ts` | Get + update | 1 hari |
| 4.9 | Settings routes | `src/routes/settings.ts` | GET/PATCH outlet, hours, system | 0.5 hari |
| 4.10 | Report snapshot service | `src/services/report-snapshot.service.ts` | Compute + cache + invalidate | 1.5 hari |
| 4.11 | Schema migration: expenses | `drizzle/` | Tambah tabel `expenses` untuk keuangan | 0.5 hari |
| 4.12 | Schema migration: debts | `drizzle/` | Tambah tabel `debts` untuk hutang | 0.5 hari |
| 4.13 | Expenses repository | `src/repositories/expense.repo.ts` | CRUD + sum by period | 0.5 hari |
| 4.14 | Debts repository | `src/repositories/debt.repo.ts` | CRUD + jatuh tempo filter | 0.5 hari |
| 4.15 | Telegram messages query route | extend telegram routes | GET messages for notification feed | 0.25 hari |
| 4.16 | Snapshot cron worker | `src/workers/snapshot-cron.worker.ts` | Refresh dashboard cache setiap 5 menit | 0.5 hari |
| 4.17 | Integration test: dashboard | `tests/integration/dashboard.test.ts` | Aggregation correctness | 1 hari |

**Total Gate 4 backend**: ~13 hari kerja

---

### Gate 5 — HR + Laporan + Export (Sprint 10, ~11 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 5.1 | Employee repository | `src/repositories/employee.repo.ts` | CRUD + performance stats | 0.5 hari |
| 5.2 | Employees routes | `src/routes/employees.ts` | GET /employees, /:id, /:id/performance, /summary | 0.75 hari |
| 5.3 | Attendance repository | `src/repositories/attendance.repo.ts` | check-in/out + summary | 0.25 hari |
| 5.4 | Attendance service | `src/services/attendance.service.ts` | Mark + summary today | 0.5 hari |
| 5.5 | Leave request repository | `src/repositories/leave-request.repo.ts` | CRUD + list pending | 0.5 hari |
| 5.6 | Leave service | `src/services/leave.service.ts` | Submit + approve + reject | 0.75 hari |
| 5.7 | Leave routes | `src/routes/leave-requests.ts` | GET, /:id/approve, /:id/reject | 0.5 hari |
| 5.8 | Daily report service | `src/services/daily-report.service.ts` | Aggregate orders/shifts | 1 hari |
| 5.9 | Daily report worker | `src/workers/daily-report.worker.ts` | Cron 00:30 WIB + insert daily_reports | 1 hari |
| 5.10 | PDF export service | `src/services/pdf-export.service.ts` | Generic PDF generation | 1 hari |
| 5.11 | PDF export worker | `src/workers/pdf-export.worker.ts` | Background job + status tracking | 1 hari |
| 5.12 | Reports routes | `src/routes/reports.ts` | /api/reports/{sales,inventory,finance,operational,daily/:date,export,export/:job_id} | 1 hari |
| 5.13 | Operational report service | `src/services/operational-report.service.ts` | KPI outlet + business summary | 1 hari |
| 5.14 | Telegram event: daily_report_ready | extend daily report | Trigger ke Manager | 0.25 hari |
| 5.15 | Integration test: reports | `tests/integration/reports.test.ts` | Aggregation + export flow | 1 hari |

**Total Gate 5 backend**: ~11 hari kerja

---

### Gate 6 — AI Assistant MVP (Sprint 11, ~5 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 6.1 | AI conversation repository | `src/repositories/ai-conversation.repo.ts` | CRUD + find or create | 0.5 hari |
| 6.2 | AI message repository | `src/repositories/ai-message.repo.ts` | insert (append-only) | 0.25 hari |
| 6.3 | AI service (MVP echo) | `src/services/ai.service.ts` | createConvo, sendMessage (echo placeholder), getHistory | 1.5 hari |
| 6.4 | AI activity service | `src/services/ai-activity.service.ts` | Recent prompts + quick insights | 0.5 hari |
| 6.5 | AI routes | `src/routes/ai.ts` | POST /chat, GET /conversations, /:id, /activity, /insights | 0.75 hari |
| 6.6 | AI cleanup worker | `src/workers/ai-cleanup.worker.ts` | Purge old (>90 hari) conversations | 0.5 hari |
| 6.7 | AI integration test | `tests/integration/ai.test.ts` | Echo flow + cleanup | 0.5 hari |

**Total Gate 6 backend**: ~4.5 hari kerja

---

### Gate 7 — Polish & Deploy (Sprint 12-13, ~21 hari kerja)

| # | Task | Detail | Estimasi |
|---|------|--------|----------|
| 7.1 | Integration tests full coverage | Service + DB layer semua modul | 5 hari |
| 7.2 | API endpoint tests | Per-endpoint happy + error path | 3 hari |
| 7.3 | Security audit | OWASP top 10 + custom (rate limit, injection, dll) | 3 hari |
| 7.4 | Performance audit | Query optimization + EXPLAIN ANALYZE + index review | 2 hari |
| 7.5 | Rate limit tuning | Per-endpoint limit + global + DDoS protection | 1 hari |
| 7.6 | Backup strategy | Automated daily pg_dump + retention policy | 1 hari |
| 7.7 | Docker + CI/CD | GitHub Actions: lint, test, build, deploy | 3 hari |
| 7.8 | Monitoring setup | Sentry + health check + log aggregation | 2 hari |
| 7.9 | Swagger docs | Generate OpenAPI dari zod schemas | 1 hari |

**Total Gate 7 backend**: ~21 hari kerja

## 5. Sub-task Tambahan (Ongoing)

| Task | Frequency | Detail |
|------|-----------|--------|
| Drizzle migration review | Setiap schema change | Review SQL + test on dev DB |
| Dependency update | Mingguan | `bun update` + test |
| API contract sync | Setiap endpoint berubah | Update `packages/shared` types |
| Database backup verify | Mingguan | Restore backup ke staging, verify data |
| Performance monitor | Harian | Check slow query log, optimize |
| Bug triage | Harian | Sort by severity |
| Security patch | Segera apply | Critical CVE di dependencies |

## 6. Testing Strategy (Backend)

### 6.1 Unit Tests (Vitest / bun test)
- Service pure functions (tanpa DB)
- Validators (zod schemas)
- Utils (format, date, currency, dll)
- Error classes behavior

### 6.2 Integration Tests (Vitest + test DB)
- Service + Repository dengan real DB (test schema terpisah)
- Transaction rollback test (verifikasi atomicity)
- Migration up/down test
- Seed script test

### 6.3 API Tests (Vitest + supertest-style atau Elysia test client)
- Per-endpoint happy path
- Per-endpoint error path (validation, RBAC, 404, 409)
- Rate limit test
- Webhook test (Telegram)

### 6.4 Critical Integration Tests (wajib ada)
1. **POS Complete Order**: stock decrement atomic + payment + shift counter
2. **Void Order**: stock restore + audit log + correct status transition
3. **PO Verify**: stock increment + movements + telegram event triggered
4. **SJ 2-Stage Approval**: state transition + approvals recorded + telegram
5. **PIN Rate Limit**: 5 attempts/hour limit enforced
6. **Daily Report Cron**: 00:30 WIB trigger + aggregate correct + telegram
7. **Telegram Retry**: API fail → exponential backoff → success / fail after 5
8. **Idempotency Key**: same key + same body → cached response; different body → 409

### 6.5 Test Database Setup

```bash
# Gunakan schema terpisah atau container per test run
DATABASE_URL=postgres://test:***@localhost:5432/hekas_pos_test

# bun test:
1. Run migration to test schema
2. Run each test in transaction → rollback at end
3. Or: setup/teardown per test file (slower)
```

## 7. Performance Targets (Backend)

| Metric                      | Target              |
|-----------------------------|---------------------|
| API response p95            | < 200ms             |
| API response p99            | < 500ms             |
| DB query p95                | < 50ms              |
| DB query p99                | < 200ms             |
| Background job throughput   | 100 jobs/min        |
| Telegram send throughput    | 50 msg/min          |
| Uptime                      | 99.5%               |
| Bundle size (API)           | < 50MB              |
| Memory footprint            | < 500MB steady      |
| CPU usage                   | < 60% steady        |

## 8. Catatan Kolaborasi dengan Jazli

- **API contract sync**: Setiap endpoint berubah, update `packages/shared/types/` agar frontend bisa sync types.
- **API documentation**: Swagger di `/api/docs` selalu up-to-date.
- **Mocking saat frontend ready duluan**: Pakai MSW di frontend (Jazli) dengan zod schema dari `packages/shared`.
- **OpenAPI generation**: Auto-generate TypeScript types untuk frontend dari OpenAPI spec.
- **Daily sync**: Singkat 5 menit untuk align endpoint priority + blockers.

## 9. Database Operations

### 9.1 Migration Commands (cheat sheet)

```bash
# Generate migration setelah schema update
bun drizzle-kit generate

# Apply ke dev
bun drizzle-kit migrate

# Push schema langsung (dev only, tanpa file)
bun drizzle-kit push

# Drop semua (DANGER!)
bun drizzle-kit drop

# Studio (GUI untuk inspect DB)
bun drizzle-kit studio
```

### 9.2 Backup Commands

```bash
# Daily backup (cron)
pg_dump -Fc $DATABASE_URL > /backup/hekas_$(date +%Y%m%d).dump

# Restore
pg_restore -d $DATABASE_URL /backup/hekas_20260619.dump
```

### 9.3 Performance Monitoring Queries

```sql
-- Slow queries (top 10)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Missing indexes (table scan tinggi)
SELECT relname, seq_scan, seq_tup_read, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > 1000
ORDER BY seq_tup_read DESC;
```

## 10. Open Questions

1. **AI LLM Provider**: OpenAI, Anthropic, atau local (Ollama)? Affect Tahap 2 budget.
2. **Image storage**: Local FS (MVP) atau R2/S3 (Tahap 2)? Affect backup strategy.
3. **Webhook server**: Dedicated subdomain (api.hekas.id/webhook) atau path (/api/telegram/webhook)?
4. **Multi-region**: Single region (Asia/Jakarta) atau multi-region? Affect latency target.
5. **Encryption at rest**: Enable untuk tabel sensitif (users, audit_logs)? Affect perf ~5%.

---

**Akhir dokumen TASK_WAFIQ_BACKEND.md**
