# DEVELOPMENT ROADMAP — HEKAS POS

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Roadmap implementasi gate-based
**Dasar**: `PRD.md` v1.0.0 + `FEATURE_MATRIX.md` v1.0.0 + seluruh engineering docs Batch 1 & 2
**Asumsi**: 2 developer full-time (Jazli = frontend lead, Wafiq = backend lead), sprint 2 minggu

---

## 1. Ringkasan

HEKAS POS diimplementasikan dalam **8 gate** (8 sprint × 2 minggu = ~16 minggu / 4 bulan MVP). Setiap gate punya deliverable konkret dan acceptance criteria yang harus pass sebelum lanjut ke gate berikutnya.

### 1.1 Prinsip

1. **Backend-first untuk entitas data**, **Frontend-first untuk UI flow** — keduanya paralel di tiap gate.
2. **Atomic commits** — setiap task selesai + tested + reviewed, baru merge.
3. **Gate review** — setiap akhir gate, demo ke pak bos untuk validasi sebelum lanjut.
4. **No hardcoded values** — semua konfigurasi via env vars + design tokens.
5. **Acceptance criteria driven** — sesuai PRD §8, tidak ada fitur yang "selesai" tanpa AC-nya lulus.

## 2. Gate Overview

| Gate | Nama                          | Sprint | Deliverable Utama                                  | Dependency          |
|------|-------------------------------|--------|----------------------------------------------------|---------------------|
| 0    | Foundation & Setup            | 1-2    | Monorepo, DB schema, auth, base layout              | -                   |
| 1    | Auth + POS (Kasir Core)       | 3-4    | Login flow, POS transaksi end-to-end               | Gate 0              |
| 2    | Admin Gudang                  | 5-6    | Inventaris, PO, barang keluar                      | Gate 1              |
| 3    | Surat Jalan Approval          | 7      | 2-stage approval + Manager view                    | Gate 2              |
| 4    | Manager Dashboard + Analytics | 8-9    | Dashboard, penjualan/inventaris/keuangan analytics | Gate 3              |
| 5    | HR + Laporan + Export         | 10     | Karyawan, laporan, PDF export                      | Gate 4              |
| 6    | AI Assistant (MVP)            | 11     | Chat UI + echo placeholder                         | Gate 5              |
| 7    | Polish & Deploy               | 12-13  | Testing, security audit, performance, deploy       | Gate 6              |

**Estimasi total**: 13 sprint × 2 minggu = **26 minggu** (~6 bulan kalender).

> **Catatan**: Ini estimasi kasar untuk MVP. Kompresi bisa terjadi jika developer overlap atau fitur di-skip ke Tahap 2.

## 3. Detail per Gate

### Gate 0 — Foundation & Setup (Sprint 1-2, ~4 minggu)

**Goal**: Setup monorepo, database schema, auth system, base layout semua role.

#### Backend (Wafiq)

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Setup monorepo | Bun workspaces: `apps/web`, `apps/api`, `packages/shared` | 1 hari | - |
| Setup ElysiaJS project | `apps/api`, struktur folder per BACKEND_ARCHITECTURE §3 | 1 hari | - |
| Drizzle ORM setup | Schema files per domain (auth, master, stock, pos, dll) | 3 hari | - |
| Generate + apply migrations | `drizzle-kit generate` + migrate ke dev DB | 1 hari | Schema |
| Seed script | Initial categories, products sample, 1 outlet, 3 user (satu per role) | 1 hari | Migrate |
| JWT auth module | Login, logout, refresh, `/api/auth/me` | 2 hari | - |
| RBAC middleware | Per-route role check | 1 hari | JWT |
| Error handler global | Custom error classes + global handler | 1 hari | - |
| Logger (Pino) | Structured logging + request ID | 0.5 hari | - |
| Health check endpoint | `/api/health` | 0.5 hari | - |

**Total backend Gate 0**: ~12 hari kerja (~2.5 sprint)

#### Frontend (Jazli)

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Setup SvelteKit 5 project | `apps/web`, struktur per FRONTEND_ARCHITECTURE §3 | 1 hari | - |
| Setup Tailwind 4 + design tokens | Config + CSS variables + Inter font | 1 hari | - |
| Install shadcn-svelte | Init + add 10 base components (Button, Card, Input, Table, dll) | 1 hari | - |
| Setup route groups | `(kasir)`, `(gudang)`, `(manager)` dengan layout masing-masing | 2 hari | - |
| Login page (1 endpoint) | `/login` form + auto-detect role redirect | 2 hari | - |
| Layout guards (RBAC) | Per-group `+layout.ts` enforce role | 1 hari | - |
| API client base | Fetch wrapper dengan auth + error handling | 1 hari | - |
| Shared components | Sidebar, TopBar, Breadcrumb, EmptyState, LoadingSpinner | 3 hari | - |
| Toast notification system | `notifications.svelte.ts` + UI | 1 hari | - |

**Total frontend Gate 0**: ~13 hari kerja (~2.5 sprint)

#### Gate 0 Acceptance

- [ ] User bisa login sebagai kasir/gudang/manager dengan seed credentials
- [ ] Redirect sesuai role (kasir → `/kasir/pos`, dll)
- [ ] Kasir coba akses `/manager/beranda` → redirect ke `/kasir/pos`
- [ ] DB schema ter-migrate + seed data masuk
- [ ] API `/api/health` return 200
- [ ] Frontend + backend bisa run simultan di dev (Bun)
- [ ] Design tokens applied di seluruh UI

---

### Gate 1 — Auth + POS (Kasir Core) (Sprint 3-4, ~4 minggu)

**Goal**: Kasir bisa transaksi dari login sampai cetak struk. Void order dengan PIN.

#### Backend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Products API | CRUD (admin), list (all), search, filter | 2 hari | Gate 0 |
| Members API | List, detail, search | 1 hari | Gate 0 |
| Categories API | List | 0.5 hari | Gate 0 |
| Orders API | Create (DRAFT), get, list, complete, void, hold | 4 hari | Products, Members |
| Orders atomic transaction | Stock decrement + payment insert + shift update dalam 1 DB tx | 3 hari | Orders API |
| Payments API | Create + read | 1 hari | Orders |
| Shifts API | Start, end (dengan PIN), get active, list, summary | 3 hari | Auth, PIN |
| PIN verify module | Hash + verify + rate limit | 1 hari | Auth |
| Held drafts API | Save, list, resume, delete | 1 hari | Orders |

**Total backend Gate 1**: ~16.5 hari kerja

#### Frontend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Cart store (runes) | Cart state dengan `$state` + `$derived` | 1 hari | - |
| POS screen | Product grid + categories + search + cart + payment modal | 5 hari | Cart store, Products API |
| Barcode scanner | Input mode (no hardware, just keyboard input) | 1 hari | POS |
| Payment modal | Pilih metode (Tunai/QRIS/Debit) + numpad untuk tunai | 2 hari | Orders API |
| Member search modal | Search + attach ke cart | 1 hari | Members API |
| Held drafts UI | Counter + modal list + resume | 2 hari | Held drafts API |
| Order screen | List dengan filter + detail panel + void action | 3 hari | Orders API |
| PIN dialog component | Reusable untuk void + end shift | 1 hari | - |
| Shift screen | List + start/end modal + active badge | 3 hari | Shifts API |
| Produk (read) screen | Catalog view + detail + search | 2 hari | Products API |
| Pelanggan screen | List + detail + tier badge | 2 hari | Members API |
| Laporan kasir screen | Ringkasan shift + metode bayar chart + best sellers | 2 hari | Reports API |
| Kasir setting screen | Profil + printer (deferred) + devices | 1 hari | - |
| TopBar shift aktif | Badge "Shift Aktif #N" + jam real-time | 0.5 hari | Shifts API |

**Total frontend Gate 1**: ~25.5 hari kerja

#### Gate 1 Acceptance (PRD §8 partial)

- [ ] Kasir login → POS default
- [ ] Scan barcode (input keyboard) → produk masuk cart
- [ ] Klik produk dari grid → masuk cart
- [ ] Search produk → filter
- [ ] Filter kategori → tampil hanya kategori itu
- [ ] Attach member → cart
- [ ] Pilih Tunai/QRIS/Debit → payment modal
- [ ] Konfirmasi bayar → transaksi SELESAI + stok berkurang (atomic)
- [ ] Cetak struk placeholder (print modal, no hardware)
- [ ] Reset POS untuk transaksi berikutnya
- [ ] Save as draft → counter "Draft Order" naik di header
- [ ] Resume draft dari Order screen
- [ ] Void order dengan PIN → status VOID + stok kembali + audit log
- [ ] Start shift dengan modal awal → status AKTIF
- [ ] End shift dengan PIN + modal akhir + handover opsional
- [ ] Laporan shift: total transaksi, metode bayar, best sellers

---

### Gate 2 — Admin Gudang (Sprint 5-6, ~4 minggu)

**Goal**: Admin Gudang bisa kelola inventaris, barang masuk, barang keluar.

#### Backend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Products full CRUD | Tambah, edit, soft delete + image upload | 2 hari | Gate 1 |
| Suppliers API | CRUD | 1 hari | Gate 0 |
| Stocks API | Get summary + stock movements log | 1 hari | Gate 0 |
| Restock API | Single + bulk | 1 hari | Products, Suppliers |
| Incoming Goods API | Create PO, list, detail, verify (atomic stock update) | 3 hari | Products, Suppliers |
| Outgoing Goods API | Create, list, detail, picking update | 3 hari | Products |
| File upload handler | Image upload (multipart) ke local FS | 1 hari | - |
| Stock adjustment API | Create adjustment dengan reason | 1 hari | Stocks |
| Inventory summary API | Dashboard aggregation | 1 hari | - |

**Total backend Gate 2**: ~14 hari kerja

#### Frontend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Gudang Beranda | Dashboard summary + tasks + low stock alert + recent activity | 3 hari | Inventory summary API |
| Inventaris screen | Product table + filter + sort + image | 4 hari | Products API, Upload |
| Tambah/Edit Produk modal | Form dengan image upload | 2 hari | Products API |
| Restock dialog (single) | Input qty + supplier | 1 hari | Restock API |
| Restock massal dialog | Multi-select + bulk input | 2 hari | Bulk restock API |
| Stock movement log | Riwayat pergerakan per produk | 1 hari | Stocks API |
| Barang Masuk screen | List PO + filter + status badge | 2 hari | Incoming API |
| PO input form | Manual entry barang masuk | 2 hari | Incoming API |
| PO verification modal | Input qty aktual per item | 2 hari | Incoming API |
| Barang Keluar screen | List + filter + status | 2 hari | Outgoing API |
| Picking process modal | Checklist per item | 2 hari | Outgoing API |
| Gudang setting screen | Profil + ringkasan sistem (read-only) | 1 hari | - |

**Total frontend Gate 2**: ~22 hari kerja

#### Gate 2 Acceptance

- [ ] Admin Gudang login → Beranda default
- [ ] Beranda tampilkan ringkasan akurat (total SKU, stok value, low stock)
- [ ] Tambah produk baru dengan foto
- [ ] Edit produk existing
- [ ] Restock single produk (stok naik + movement tercatat)
- [ ] Restock massal multi produk
- [ ] Input PO baru manual
- [ ] Verifikasi PO → stok naik otomatis + movement tercatat
- [ ] Buat barang keluar + proses picking
- [ ] Lihat stock movement log per produk

---

### Gate 3 — Surat Jalan Approval (Sprint 7, ~2 minggu)

**Goal**: End-to-end flow Surat Jalan dari Admin Gudang sampai Manager approve.

#### Backend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Surat Jalan API | Create, list, detail | 2 hari | Outgoing |
| 2-stage approval API | Gudang review + Manager final | 2 hari | Surat |
| Print SJ endpoint | Generate PDF (simple template) | 2 hari | Surat |
| Telegram integration | Setup bot + link flow + webhook | 3 hari | - |
| Notification queue worker | Send telegram + retry logic | 2 hari | Telegram |
| Event: sj_pending_approval | Trigger ke Manager | 0.5 hari | Telegram |
| Event: sj_approved / rejected | Trigger ke Gudang | 0.5 hari | Telegram |

**Total backend Gate 3**: ~12 hari kerja

#### Frontend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Buat SJ dari barang keluar | Form + reference ke outgoing goods | 2 hari | Surat API |
| Surat Jalan list (Gudang) | List + filter + status badge | 2 hari | Surat API |
| Surat Jalan detail | Items + approval history + actions | 2 hari | Surat API |
| Gudang review action | Approve internal + notes | 1 hari | Surat API |
| Cetak SJ (PDF) | Trigger + download | 1 hari | Print endpoint |
| Surat Jalan list (Manager) | Filter MENUNGGU_APPROVAL | 1 hari | Surat API |
| Manager review + approve/reject | Action + reason input | 2 hari | Surat API |
| Telegram link UI | Generate code + display bot URL | 1 hari | Telegram API |
| Settings: Telegram (Asumsi) | Sub-section di Manager Pengaturan | 1 hari | Telegram API |

**Total frontend Gate 3**: ~13 hari kerja

#### Gate 3 Acceptance (PRD §8 AC #2, #5)

- [ ] Admin Gudang buat SJ dari barang keluar
- [ ] SJ masuk status MENUNGGU_APPROVAL
- [ ] Telegram notifikasi terkirim ke Manager
- [ ] Manager review di Surat Jalan screen
- [ ] Manager approve → status DISETUJUI + Telegram ke Gudang
- [ ] Manager reject → status DITOLAK + reason + Telegram ke Gudang
- [ ] Gudang cetak SJ (PDF download)
- [ ] Mark sent → status TERKIRIM
- [ ] SJ tidak bisa di-cetak sebelum approve (button disabled)

---

### Gate 4 — Manager Dashboard + Analytics (Sprint 8-9, ~4 minggu)

**Goal**: Manager punya dashboard operasional + analytics 3 modul (Penjualan, Inventaris, Keuangan).

#### Backend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Dashboard summary API | KPI aggregation + best sellers + revenue chart | 3 hari | Orders, Shifts |
| Analytics: Penjualan | Time series + breakdown metode + best sellers | 2 hari | Orders |
| Analytics: Inventaris | Fast moving + stok kritis + nilai persediaan | 2 hari | Stocks, Movements |
| Analytics: Keuangan | Laba rugi + hutang + sumber pendapatan + pengeluaran | 3 hari | (Asumsi: hutang & expense belum ada tabel, mungkin Tambah tabel `expenses` dan `debts`) |
| Report snapshots (cache) | Pre-aggregate untuk dashboard load cepat | 2 hari | Dashboard |
| Settings API (outlet, jam, system) | Get + update | 2 hari | Settings |

**Total backend Gate 4**: ~14 hari kerja

> **Catatan**: Keuangan butuh tabel `expenses` dan `debts` yang belum ada di DATABASE_DESIGN. Tambahkan di migration Gate 4.

#### Frontend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Manager Beranda | KPI strip + revenue chart + best sellers + inventory summary + approval queue + notification feed | 4 hari | Dashboard API |
| Penjualan analytics | Time series chart + breakdown + best sellers + insight | 3 hari | Analytics API |
| Inventaris analytics | Fast moving + kritis + nilai + insight | 3 hari | Analytics API |
| Keuangan analytics | Laba rugi + hutang + sumber + pengeluaran + insight | 3 hari | Analytics API |
| Notification feed component | Recent telegram messages | 1 hari | Telegram log API |
| Insight cards | Auto-generated text per analytics | 1 hari | - |
| Chart components (LayerChart) | Line, Bar, Pie reusable | 2 hari | - |

**Total frontend Gate 4**: ~17 hari kerja

#### Gate 4 Acceptance

- [ ] Manager login → Beranda default
- [ ] Dashboard tampilkan 5 KPI akurat (revenue, transaksi, staff, approval, avg)
- [ ] Revenue chart 7 hari tampil dengan data benar
- [ ] 3 best sellers tampil di Beranda
- [ ] Klik KPI card → navigate ke analytics terkait
- [ ] Penjualan analytics lengkap dengan filter periode
- [ ] Inventaris analytics: fast moving + kritis + nilai
- [ ] Keuangan analytics: laba rugi + hutang + sumber + pengeluaran
- [ ] Notification feed menampilkan 10 pesan telegram terakhir

---

### Gate 5 — HR + Laporan + Export (Sprint 10, ~2 minggu)

**Goal**: Manager bisa manage karyawan + generate laporan + export PDF.

#### Backend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Employees API | CRUD + performance stats | 2 hari | Gate 0 |
| Attendances API | Daily check-in/out + summary | 1 hari | Employees |
| Leave requests API | Submit + list + approve/reject | 2 hari | Employees |
| Daily report generator | Cron job (00:30 WIB) + telegram notif | 2 hari | Orders |
| PDF export worker | Background job untuk generate PDF report | 2 hari | Reports |
| Operational reports API | Outlet KPI + business summary | 2 hari | All aggregations |

**Total backend Gate 5**: ~11 hari kerja

#### Frontend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Karyawan screen | List + detail + performa | 3 hari | Employees API |
| Kehadiran summary | Today attendance | 1 hari | Attendances API |
| Cuti & izin list + actions | Approve/reject dengan catatan | 2 hari | Leave API |
| Laporan Manager screen | Business analytics + KPI outlet + insight | 3 hari | Reports API |
| Export PDF button + flow | Trigger job + poll status + download | 2 hari | PDF API |
| Export PDF (semua role) | Kasir laporan + Gudang stock report | 1 hari | - |

**Total frontend Gate 5**: ~12 hari kerja

#### Gate 5 Acceptance (PRD §8 AC #7)

- [ ] Manager lihat daftar karyawan dengan performa
- [ ] Approve/reject cuti dengan catatan
- [ ] Laporan screen menampilkan top produk + kategori + KPI outlet
- [ ] Export PDF laporan kasir per shift → file ter-download
- [ ] Export PDF laporan gudang stock → file ter-download
- [ ] Export PDF laporan manager → file ter-download
- [ ] Background job handle long-running generation
- [ ] Daily report cron jalan setiap 00:30 WIB → Manager terima Telegram

---

### Gate 6 — AI Assistant MVP (Sprint 11, ~2 minggu)

**Goal**: AI Assistant accessible Manager dengan echo MVP placeholder.

#### Backend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| AI conversations API | Create/find + list + get detail | 1 hari | Gate 0 |
| AI messages API | Send prompt → create user message + assistant echo | 2 hari | AI convo |
| AI history retention | Cleanup cron (>90 hari) | 1 hari | pg-boss |
| AI activity + insights API | Recent prompts + quick chips | 1 hari | AI convo |

**Total backend Gate 6**: ~5 hari kerja

#### Frontend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| AI Chat UI | Textarea + submit + response display | 2 hari | AI API |
| Conversation history sidebar | List + click to load | 1 hari | AI API |
| Activity + Insights chips | Display below chat | 1 hari | AI API |
| AI Control Center section | Settings + status | 1 hari | AI API |

**Total frontend Gate 6**: ~5 hari kerja

#### Gate 6 Acceptance (PRD §8 AC #6)

- [ ] Manager akses AI Assistant screen
- [ ] Chat input prompt → submit
- [ ] Response "AI belum tersedia (MVP placeholder)" tampil
- [ ] Conversation tersimpan di history
- [ ] Bisa load conversation lama
- [ ] Activity feed menampilkan recent prompts
- [ ] Quick insight chips bisa diklik (pre-defined prompts)

---

### Gate 7 — Polish & Deploy (Sprint 12-13, ~4 minggu)

**Goal**: Production-ready: testing lengkap, security audit, performance, deploy.

#### Backend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| Integration tests | Service + DB layer full coverage | 5 hari | Gate 6 |
| API tests | Per-endpoint happy + error path | 3 hari | All |
| Security audit | OWASP top 10 + custom checklist | 3 hari | - |
| Performance audit | Query optimization + index review | 2 hari | - |
| Rate limit tuning | Per-endpoint limit + DDoS protection | 1 hari | - |
| Backup strategy | Automated daily backup (pg_dump) | 1 hari | - |
| Docker image + CI/CD | GitHub Actions: build + test + deploy | 3 hari | - |
| Monitoring setup | Sentry + health check + log aggregation | 2 hari | - |
| API docs (Swagger) | Generate OpenAPI dari zod | 1 hari | - |

**Total backend Gate 7**: ~21 hari kerja

#### Frontend

| Task | Detail | Estimasi | Dependency |
|------|--------|----------|------------|
| E2E tests (Playwright) | Per-role critical flow | 5 hari | Gate 6 |
| Accessibility audit | WCAG AA check | 2 hari | - |
| Performance audit | Lighthouse + bundle size | 2 hari | - |
| Cross-browser testing | Chrome, Edge, Safari, Firefox | 2 hari | - |
| Responsive refinement | Tablet 10" optimization | 2 hari | - |
| Error boundary + offline UI | Network error handling | 2 hari | - |
| Loading skeletons | Per-screen skeleton | 2 hari | - |
| Production build + deploy | Vercel/Netlify + env config | 2 hari | - |

**Total frontend Gate 7**: ~19 hari kerja

#### Gate 7 Acceptance (semua PRD §8 AC)

- [ ] **AC #1**: Role-based access enforced (verified via E2E test)
- [ ] **AC #2**: Transaksi POS atomic (verified via integration test + manual)
- [ ] **AC #3**: Draft order tersimpan + bisa di-resume (E2E)
- [ ] **AC #4**: Void order oleh kasir yang buat ATAU manager (E2E + RBAC)
- [ ] **AC #5**: SJ tidak bisa dicetak sebelum approve (E2E)
- [ ] **AC #6**: AI Assistant receive prompt + show response (E2E)
- [ ] **AC #7**: Export PDF laporan kasir per shift (E2E + manual verify)
- [ ] **AC #8**: Telegram notifikasi 3 jenis event (integration test + manual)
- [ ] **AC #9**: Semua warna/typography pakai design tokens (lint + manual)
- [ ] **AC #10**: Offline-tolerant: Telegram down → buffered → retry saat up (integration test)

## 4. Dependencies & Parallelization

### 4.1 Backend ↔ Frontend Sync Points

| Gate | Backend deliverables                | Frontend deliverables                | Sync point                  |
|------|-------------------------------------|--------------------------------------|-----------------------------|
| 0    | Auth API + RBAC                     | Login page + layout guards            | End of Gate 0: login works  |
| 1    | Orders API + Shifts API             | POS + Order + Shift screens          | End of Gate 1: full POS E2E |
| 2    | Products full + Incoming + Outgoing | Inventaris + Barang Masuk/Keluar     | End of Gate 2: gudang E2E   |
| 3    | Surat API + Telegram                | SJ screens + Telegram link            | End of Gate 3: SJ approval E2E |
| 4    | Dashboard + Analytics 3 modul       | Beranda + 3 analytics screens        | End of Gate 4: dashboard load |
| 5    | Employees + Leave + Reports         | Karyawan + Laporan + Export           | End of Gate 5: full reporting |
| 6    | AI API                              | AI Assistant screen                   | End of Gate 6: AI MVP works  |
| 7    | Polish + Deploy backend             | Polish + Deploy frontend              | Production launch           |

### 4.2 Parallelization Opportunities

Beberapa task bisa paralel antara backend dan frontend:
- Backend schema migration → Frontend mock API dulu (jika perlu).
- Backend Telegram setup → Frontend Telegram link UI paralel.
- Backend PDF worker → Frontend export button UI paralel.

Tapi **strict**: setiap gate TIDAK dimulai sebelum gate sebelumnya lulus acceptance.

## 5. Risk & Mitigation

| Risk                                          | Probability | Impact | Mitigation                                  |
|-----------------------------------------------|-------------|--------|---------------------------------------------|
| Schema design miss edge case                  | Medium      | High   | Gate 0 review mendalam + test data realistis |
| Telegram API rate limit                       | Low         | Medium | Exponential backoff + retry queue           |
| ElysiaJS + Bun compatibility issue            | Low         | Medium | Test di Gate 0, fallback ke Node.js jika perlu |
| Performance bottleneck di dashboard           | Medium      | High   | Pre-aggregate + cache snapshot              |
| Acceptance criteria miss interpretasi         | Medium      | High   | Demo per gate ke pak bos sebelum lanjut     |
| Real-time notification delay                  | Low         | Low    | SSE (Server-Sent Events) sebagai enhancement|
| PDF generation timeout                        | Medium      | Low    | Background job + polling + link download    |

## 6. Tahap 2 (Post-MVP)

Setelah Gate 7 selesai dan MVP launched, fitur-fitur Tahap 2 (PRD §9 + §7):

| Fitur                             | Estimasi | Catatan                              |
|-----------------------------------|----------|--------------------------------------|
| LLM real integration (AI)         | 2 sprint | OpenAI/Anthropic + RAG over DB       |
| Payment gateway online (Midtrans) | 3 sprint | Webhook + reconciliation             |
| Multi-outlet                      | 4 sprint | Schema ready, UI perlu rework        |
| Customer-facing online shop       | 6 sprint | Separate frontend app                |
| Predictive analytics              | 4 sprint | ML forecasting                       |
| E-Faktur integration              | 3 sprint | Government API                       |
| HRIS lengkap (payroll, PPh 21)    | 6 sprint | Separate module                      |
| Dark mode                         | 1 sprint | Design system update                 |
| Mobile native app                 | 8 sprint | React Native atau Flutter            |
| Telegram inline button            | 1 sprint | Approve SJ langsung dari Telegram    |
| WhatsApp gateway                  | 2 sprint | Alternative notification channel      |

## 7. Communication Cadence

| Event               | Frequency             | Peserta                       |
|---------------------|----------------------|-------------------------------|
| Daily standup       | Setiap hari (15 min) | Jazli, Wafiq                  |
| Sprint planning     | Setiap awal sprint   | Jazli, Wafiq + pak bos        |
| Sprint review/demo  | Setiap akhir sprint  | Jazli, Wafiq + pak bos        |
| Retrospective       | Setiap akhir sprint  | Jazli, Wafiq                   |
| Gate review         | Setiap akhir gate    | Jazli, Wafiq + pak bos + stakeholder |

## 8. Open Questions

1. **Resource scaling**: Apakah ada developer tambahan (frontend / backend / fullstack)? Affect sprint duration.
2. **Pilot user**: Apakah ada 1 outlet untuk pilot test sebelum full rollout? Affect Gate 7 acceptance.
3. **Data migration**: Apakah ada data dari sistem lama (mis. Excel / LunaPOS) yang perlu di-import? Affect Gate 0 scope.
4. **Production infrastructure**: VPS sendiri, Railway, Fly.io, Vercel? Affect Gate 7 deploy effort.
5. **Domain & SSL**: Sudah ada domain hekas.id + SSL? Atau perlu setup?
6. **Backup retention**: Berapa lama backup disimpan? (Asumsi: 30 hari rolling)

---

**Akhir dokumen DEVELOPMENT_ROADMAP.md**
