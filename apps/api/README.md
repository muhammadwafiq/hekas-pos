# HEKAS POS — Backend (API)

**Stack**: ElysiaJS + Drizzle ORM + PostgreSQL + Bun runtime + TypeScript

**Role**: Backend API (Backend Lead: Wafiq). Frontend (SvelteKit) handled by Jazli.

**Project root**: `/home/jazli/hekas-pos/apps/api/` (mirror at `~/HEKAS-POS/apps/api/`)

---

## 📋 Task Reference

Lihat: `docs/TASK_WAFIQ_BACKEND.md` (151 tasks, 8 Gates, ~106 hari kerja estimasi).

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Bun >= 1.1.0
- Docker + docker-compose (untuk PostgreSQL)
- Node >= 20 (backup)

### Setup
```bash
# 1. Install Bun (jika belum)
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# 2. Install dependencies (monorepo workspaces)
cd ~/HEKAS-POS
bun install

# 3. Start PostgreSQL (Docker)
bun docker:up

# 4. Copy env & configure
cp apps/api/.env.example apps/api/.env
# Edit .env — minimal: JWT_SECRET harus >=32 char random

# 5. Run migrations + seed (Phase 1)
bun db:migrate
bun db:seed

# 6. Start dev server
bun dev:api
# → http://localhost:3001/api/health
```

---

## 📁 Project Structure

```
apps/api/
├── src/
│   ├── config/        # env, database, logger
│   ├── db/
│   │   ├── schema/    # 13 schema domains (Drizzle)
│   │   ├── enums.ts
│   │   ├── migrate.ts
│   │   └── seed.ts
│   ├── lib/           # jwt, password, errors, helpers
│   ├── middleware/    # auth, rbac, error-handler, logger
│   ├── repositories/  # data access layer
│   ├── services/      # business logic
│   ├── routes/        # HTTP endpoints
│   ├── validators/    # zod schemas (request/response)
│   ├── workers/       # pg-boss jobs
│   ├── types/         # local TS types
│   └── index.ts       # entry point
├── drizzle/           # migrations
├── tests/
│   ├── unit/
│   └── integration/
├── scripts/           # CLI utilities
├── static/            # uploaded files, PDFs
├── .env
├── .env.example
├── package.json
└── tsconfig.json

packages/shared/        # Zod schemas + TS types (FE & BE contract)
└── src/schemas/

docker-compose.yml     # local dev: PostgreSQL container
```

---

## 🛠️ Available Scripts

```bash
# Development
bun dev:api            # hot-reload API server
bun docker:up          # start PostgreSQL container
bun docker:down        # stop PostgreSQL
bun docker:logs        # tail logs

# Database
bun db:generate        # generate migration from schema changes
bun db:migrate         # apply migrations
bun db:push            # push schema (dev only, no migration file)
bun db:studio          # Drizzle Studio GUI
bun db:seed            # run seed script
bun db:reset           # drop + migrate + seed
bun db:drop            # ⚠️ DROP ALL TABLES (danger!)

# Testing
bun test:api           # all tests
bun test:unit          # unit tests only
bun test:integration   # integration tests only

# Build & Production
bun build:api          # build for production
bun start:api          # start production server

# Code quality
bun typecheck          # tsc --noEmit
bun lint               # (placeholder, add eslint later)
```

---

## 📡 API Endpoints (Phase 0 placeholder)

| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/api/health` | ✅ | Health check |
| GET | `/api/version` | ✅ | Version info |
| GET | `/api/*` | 🔜 Phase 1+ | All endpoints (Gate 0-7) |

---

## 🧪 Testing

- **Unit tests**: `tests/unit/` — pure functions, validators, utils
- **Integration tests**: `tests/integration/` — service + DB + API flow
- **Critical flows tested** (Gate 7): POS complete/void, PO verify, SJ approval, PIN rate limit, daily report cron, telegram retry, idempotency

```bash
# Run all tests
bun test

# Watch mode
bun test --watch
```

---

## 🔐 Environment Variables

Lihat `apps/api/.env.example` untuk full reference.

**Wajib diisi**:
- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — minimal 32 char random (`openssl rand -base64 48`)
- `PIN_*` — PIN settings
- `TELEGRAM_BOT_TOKEN` — saat setup bot (Phase 4)

Generate JWT secret:
```bash
openssl rand -base64 48
```

---

## 🐳 Docker

Local PostgreSQL pakai container. Konfigurasi di `.docker/docker-compose.yml`:

```bash
bun docker:up     # start
bun docker:down   # stop
bun docker:logs   # logs
```

Data persisted di `.docker/postgres-data/`.

---

## 📦 Deployment (Phase 8)

Production deployment target:
- VPS (recommended): Ubuntu 24.04 + Docker + Caddy/Nginx
- Managed: Railway / Fly.io / Render
- Self-hosted: full control

Coming in **Phase 8 (Gate 7 Polish + Deploy)**:
- Dockerfile + docker-compose.prod.yml
- GitHub Actions CI/CD
- Health checks + monitoring (Sentry)
- Backup strategy (pg_dump cron)
- Security audit (OWASP top 10)

---

## 📞 Collaboration

- **Frontend partner**: Jazli (`@hekas/shared` = contract)
- **API contract**: All shared types di `packages/shared/src/schemas/`
- **Daily sync**: 5 menit (async OK)
- **Branch**: `feat/*`, `fix/*`, `chore/*` — squash merge ke main
- **PR**: 1 approval required, conventional commits

---

## 📜 License

Internal use only — Partai Ummat + Duamart partnership.