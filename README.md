# HEKAS POS — Monorepo

> **Point of Sale** system untuk minimarket (use case: Duamart). 3 role: **Kasir**, **Admin Gudang**, **Manager**.

## 📁 Struktur

```
hekas-pos/
├── apps/
│   └── api/                  # ElysiaJS + Drizzle + Bun (Backend Lead: Wafiq)
├── hekas-app/                # SvelteKit + Svelte 5 + Tailwind (Frontend Lead: Jazli)
├── packages/
│   └── shared/               # Zod schemas + TS types (FE & BE contract)
├── docs/                     # PRD, ERD, API Spec, TASK breakdown
├── design/                   # design assets
├── stitch_hekas_pos_*/       # HTML mockup exports (Stitch by Google)
├── .docker/                  # Docker Compose untuk local dev (PostgreSQL)
└── package.json              # Bun workspaces root
```

## 🚀 Quick Start

```bash
# 1. Install Bun
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# 2. Install dependencies
bun install

# 3. Start PostgreSQL (Docker)
bun docker:up

# 4. Setup API env
cp apps/api/.env.example apps/api/.env

# 5. Run migrations + seed
bun db:migrate
bun db:seed

# 6. Start API
bun dev:api
# → http://localhost:3001/api/health
```

## 📋 Available Scripts

| Script | Description |
|---|---|
| `bun dev:api` | Start API with hot reload |
| `bun build:api` | Build API for production |
| `bun test:api` | Run all API tests |
| `bun db:migrate` | Apply database migrations |
| `bun db:seed` | Run seed script |
| `bun db:studio` | Open Drizzle Studio (DB GUI) |
| `bun docker:up` | Start PostgreSQL container |
| `bun docker:down` | Stop PostgreSQL container |
| `bun typecheck` | TypeScript check semua workspace |

## 🛠️ Stack

| Layer | Tech |
|---|---|
| Backend | ElysiaJS + Bun + TypeScript |
| Frontend | SvelteKit 5 + Svelte 5 + Tailwind 4 |
| Database | PostgreSQL 16 + Drizzle ORM |
| Background jobs | pg-boss |
| Auth | JWT + PIN kasir (4-6 digit) |
| Notifikasi | Telegram Bot API |
| Monorepo | Bun workspaces |
| Container | Docker (PostgreSQL only) |

## 📚 Docs

Lihat folder `docs/`:
- `PRD.md` — Product Requirements
- `DATABASE_DESIGN.md` — 13 schema domains
- `ERD.md` — Entity Relationship Diagram (Mermaid)
- `API_SPEC.md` — REST API contract
- `TASK_WAFIQ_BACKEND.md` — Backend Lead task breakdown (151 tasks, 8 Gates)
- `TASK_JAZLI_FRONTEND.md` — Frontend Lead task breakdown
- `BACKEND_ARCHITECTURE.md` — Backend architecture
- `FRONTEND_ARCHITECTURE.md` — Frontend architecture
- `TELEGRAM_INTEGRATION.md` — Telegram bot integration
- `USER_FLOW.md` — User flows per role
- `SCREEN_MAP.md` — Screen mapping per role
- `FEATURE_MATRIX.md` — Feature matrix

## 🎯 Roles

| Role | Layar | Tanggung Jawab |
|---|---|---|
| **Kasir** | 7 screens | Transaksi harian, shift, produk, pelanggan |
| **Admin Gudang** | 5 screens | Barang masuk/keluar, inventaris, surat jalan |
| **Manager** | 9 screens | Analytics, approval, SDM, konfigurasi |

## 📊 Progress

Lihat `TASK_WAFIQ_BACKEND.md` untuk status per Gate.

Current phase: **Phase 0 — Pre-flight (environment setup)** ✅

Next: **Phase 1 — Gate 0 Foundation** (ElysiaJS + Drizzle + 13 schema domains + auth)

## 🤝 Tim

- **Backend Lead**: Wafiq
- **Frontend Lead**: Jazli
- **Product/Architect**: Solution Architect team
- **Stakeholder**: Duamart + Partai Ummat

## 📜 License

Internal use only.