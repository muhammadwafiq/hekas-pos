# IMPLEMENTATION CHECKLIST — HEKAS POS

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Checklist verifikasi implementasi per acceptance criteria & per gate
**Dasar**: `PRD.md` v1.0.0 + `FEATURE_MATRIX.md` v1.0.0 + `DEVELOPMENT_ROADMAP.md` v1.0.0
**Tujuan**: Verifikasi bahwa implementasi sudah memenuhi semua kriteria sebelum dianggap "selesai"

---

## 1. Cara Pakai

Checklist ini digunakan:
- **Per gate**: Sebelum demo ke pak bos, cek semua item di gate tersebut harus pass.
- **Pre-production**: Sebelum launch, SEMUA item harus pass.
- **Regression**: Setiap ada perubahan, re-check item terkait.

Format:
- `[ ]` = belum dicek / belum pass
- `[x]` = sudah pass
- `[~]` = partial / perlu follow-up

## 2. PRD Acceptance Criteria (Wajib 100% Pass)

Sumber: `PRD.md` §8. Setiap AC punya verifikasi konkret.

### AC #1: Role-Based Access Control (RBAC)

> "Setiap role hanya dapat mengakses layar sesuai divisinya (enforced via RBAC)"

- [ ] **Backend**: Test API call `GET /api/manager/dashboard` dengan token kasir → response 403 Forbidden
- [ ] **Backend**: Test API call `POST /api/products` (create) dengan token kasir → response 403
- [ ] **Backend**: Test API call `POST /api/surat-jalan/:id/approve` dengan token gudang → response 403
- [ ] **Backend**: Test API call `POST /api/orders/:id/void` dengan token kasir BUKAN pembuat order → response 403 (Asumsi sesuai PRD §8 #4)
- [ ] **Frontend**: User kasir coba akses URL `/manager/beranda` di browser → redirect ke `/kasir/pos`
- [ ] **Frontend**: User kasir coba akses URL `/gudang/inventaris` di browser → redirect ke `/kasir/pos`
- [ ] **Frontend**: User gudang coba akses `/manager/beranda` → redirect ke `/gudang/beranda`
- [ ] **Frontend**: Logout → cookie cleared → akses `/manager/beranda` → redirect ke `/login`
- [ ] **Frontend**: Sidebar hanya menampilkan menu sesuai role (tidak ada menu role lain visible)
- [ ] **E2E test**: Kasir login → try navigate to manager URL via dev tools → redirected

### AC #2: Transaksi POS Atomic

> "Transaksi POS atomic: stok berkurang + transaksi tercatat + shift ter-update dalam 1 transaksi DB"

- [ ] **DB**: Setup 1 produk dengan stok 100
- [ ] **Integration test**: Call `POST /api/orders/:id/complete` dengan qty 5 → assert `stocks.quantity = 95`
- [ ] **Integration test**: Assert `orders.status = 'SELESAI'`
- [ ] **Integration test**: Assert `orders.completed_at IS NOT NULL`
- [ ] **Integration test**: Assert `payments` row created dengan amount sesuai
- [ ] **Integration test**: Assert `stock_movements` row created dengan `movement_type = 'out_sale'`, `quantity_delta = -5`
- [ ] **Integration test**: Assert `shifts.total_transactions += 1` dan `total_sales` sesuai
- [ ] **Negative test**: Jika stok < qty → response 409 INSUFFICIENT_STOCK, NOTHING ter-update
- [ ] **Negative test**: Jika order bukan DRAFT → response 409 INVALID_STATE, NOTHING ter-update
- [ ] **Negative test**: Jika DB error mid-transaction → rollback, NOTHING ter-update (verify stocks.quantity unchanged)
- [ ] **Concurrency test**: 2 request complete order bersamaan untuk produk sama → hanya 1 sukses atau keduanya sukses tapi stok cukup (no negative stock)

### AC #3: Draft Order Persistence

> "Draft order tersimpan dan dapat di-resume oleh kasir yang sama"

- [ ] **Backend**: Kasir A buat draft → `held_drafts` row created dengan `cashier_id = A.id`
- [ ] **Backend**: Kasir B coba resume draft punya A → response 403 atau 404 (tidak bisa cross-kasir)
- [ ] **Backend**: Kasir A resume draft → draft converted to DRAFT order
- [ ] **Frontend**: Header POS menampilkan counter "Draft Order" dengan jumlah draft punya kasir tsb
- [ ] **Frontend**: Counter update real-time saat save/hold/resume draft
- [ ] **Frontend**: Modal held drafts list hanya menampilkan draft punya kasir yang login
- [ ] **E2E**: Login kasir A → save 2 drafts → logout → login kasir A lagi → counter masih 2 → resume 1 draft

### AC #4: Void Order Permission

> "Void order hanya oleh kasir yang membuat ATAU manager"

- [ ] **Backend**: Kasir A buat order → void oleh kasir A → success
- [ ] **Backend**: Kasir A buat order → void oleh kasir B (different cashier) → response 403
- [ ] **Backend**: Manager void order kasir apapun → success
- [ ] **Backend**: Void hanya bisa untuk order `status = 'SELESAI'` (bukan DRAFT/VOID)
- [ ] **Backend**: Void wajib PIN kasir (PIN valid → success, invalid → 401)
- [ ] **Backend**: Void rate limit (5/jam/user) → 6th attempt → 429
- [ ] **Integration test**: Void order → `stocks.quantity` restored, `stock_movements` insert dengan `out_void_restore`, `audit_logs` insert dengan action `void_order`
- [ ] **Frontend**: Button Void disabled untuk order selain SELESAI
- [ ] **Frontend**: Konfirmasi dialog dengan PIN input + reason textarea
- [ ] **E2E**: Kasir buat order → void dengan PIN → cek stok kembali + status VOID

### AC #5: Surat Jalan Approval Gate

> "Surat jalan tidak bisa di-cetak sebelum di-approve manager"

- [ ] **Backend**: SJ dengan `status = 'MENUNGGU_APPROVAL'` → POST /:id/print → response 409 SJ_NOT_APPROVED
- [ ] **Backend**: SJ dengan `status = 'DISETUJUI'` → POST /:id/print → success, status → SUDAH_DICETAK
- [ ] **Backend**: SJ dengan `status = 'DITOLAK'` → POST /:id/print → response 409
- [ ] **Backend**: Manager approve SJ → status → DISETUJUI → telegram terkirim ke gudang
- [ ] **Backend**: Manager reject SJ → status → DITOLAK + rejection_reason → telegram ke gudang dengan alasan
- [ ] **Backend**: 2-stage approval: Gudang review (internal) → submit ke Manager → Manager final approve/reject
- [ ] **Backend**: surat_approvals table mencatat kedua stage (GUDANG_REVIEW + MANAGER_FINAL)
- [ ] **Frontend**: Button Cetak disabled saat status ≠ DISETUJUI
- [ ] **Frontend**: Button Setujui/Tolak hanya visible untuk Manager
- [ ] **E2E**: Gudang buat SJ → submit → Manager approve → cetak sukses → verifikasi PDF download

### AC #6: Telegram Notifications

> "Telegram notifikasi terkirim untuk: (a) surat jalan perlu approval, (b) stok kritis, (c) laporan harian"

- [ ] **Setup**: Bot Telegram dibuat + webhook registered + secret token valid
- [ ] **Linking**: Manager link akun ke Telegram via /start <code> → is_verified = true
- [ ] **Linking**: Code kadaluarsa setelah 15 menit
- [ ] **Event A**: Gudang buat SJ → telegram terkirim ke Manager dengan content sj_no + tujuan + items
- [ ] **Event B**: Stok produk <= min_stock (after sale/restock/adjustment) → telegram ke Manager + Gudang
- [ ] **Event C**: Cron daily report jalan 00:30 WIB → daily_report_ready telegram ke Manager
- [ ] **Offline test**: Telegram API down → notification_queue buffer → API up → retry → terkirim
- [ ] **Retry test**: 5x retry max → after 5 → status FAILED + alert system_error ke Manager
- [ ] **Webhook security**: Request tanpa X-Telegram-Bot-Api-Secret-Token → 401
- [ ] **Webhook security**: Token mismatch → 401
- [ ] **E2E**: Trigger 3 event di atas → cek `telegram_messages` table 3 row dengan status SENT

### AC #7: AI Assistant MVP

> "AI Assistant menerima prompt dan menampilkan response (LANGKAH 2; MVP tanpa LLM real cukup echo 'AI belum tersedia')"

- [ ] **Frontend**: Manager akses `/manager/ai` → chat UI tampil
- [ ] **Frontend**: Input prompt + submit → response tampil dalam chat
- [ ] **Backend**: POST /api/ai/chat → simpan user message + assistant echo message
- [ ] **Backend**: Response content mengandung "AI belum tersedia" atau echo prompt
- [ ] **Frontend**: Conversation tersimpan, bisa di-load dari history list
- [ ] **Frontend**: Activity feed menampilkan recent prompts
- [ ] **Frontend**: Quick insight chips clickable, populate prompt input
- [ ] **Akses kontrol**: Kasir coba akses /manager/ai → 403 / redirect ke /kasir/pos
- [ ] **E2E**: Manager login → submit prompt → response muncul + tersimpan di history

### AC #8: Export PDF Laporan

> "Export PDF laporan kasir per shift tersedia"

- [ ] **Backend**: POST /api/reports/export dengan type=shift_summary → return job_id
- [ ] **Backend**: Worker pg-boss generate PDF dengan template (logo, header, table, footer)
- [ ] **Backend**: GET /api/reports/export/:job_id → status + download_url saat done
- [ ] **Frontend**: Button Export di Laporan Kasir → trigger + loading state
- [ ] **Frontend**: Poll job status → file otomatis download saat ready
- [ ] **PDF content**: Logo, nama kasir, shift_no, tanggal, total transaksi, total sales, breakdown metode, best sellers, signature line
- [ ] **Multi-role**: Export PDF juga tersedia untuk Gudang (stock report) dan Manager (business report)
- [ ] **Timeout handling**: Jika PDF generation > 30s → return partial atau error
- [ ] **E2E**: Login kasir → buka Laporan → klik Export → verify PDF ter-download + open correct content

### AC #9: Design Tokens Compliance

> "Semua warna/typography mengikuti design tokens (tidak ada hardcode)"

- [ ] **Lint setup**: ESLint rule untuk detect hardcoded hex color (`#[0-9a-f]{3,6}` di file .svelte)
- [ ] **Lint setup**: ESLint rule untuk detect hardcoded font-family (kecuali `'Inter', 'system-ui'`)
- [ ] **Lint run**: `bun run lint` → zero error hardcoded
- [ ] **Manual audit**: grep semua file .svelte untuk `#00288e` dll → tidak ada (semua via `var(--primary)` atau Tailwind class)
- [ ] **Manual audit**: grep semua file .svelte untuk `font-family:` → hanya di root CSS, tidak di component
- [ ] **Visual check**: Buka semua screen → warna konsisten, typography konsisten
- [ ] **Style guide**: `default_shadcn_theme.css` adalah single source of truth

### AC #10: Offline-Tolerant Telegram

> "Sistem offline-tolerant: jika Telegram down, event di-buffer dan di-retry saat online"

- [ ] **Setup**: Disable network ke Telegram API (mock atau firewall block)
- [ ] **Trigger**: Trigger 3 event berbeda (sj_pending, stok_kritis, daily_report)
- [ ] **Verify**: `notification_queue` 3 row dengan status PENDING + attempts incremented
- [ ] **Re-enable network**
- [ ] **Verify**: Worker retry → 3 row status SENT dalam beberapa menit
- [ ] **Verify**: `telegram_messages` log 3 row dengan status SENT
- [ ] **Verify**: Exponential backoff: attempt 1 → 2min, attempt 2 → 4min, attempt 3 → 8min
- [ ] **Verify**: Setelah 5 attempts → status FAILED + system_error alert ke Manager

## 3. Non-Functional Requirements (PRD)

### Performance

- [ ] API response p95 < 200ms (load test 100 concurrent users, 1 menit)
- [ ] API response p99 < 500ms
- [ ] Frontend Lighthouse Performance > 90
- [ ] Bundle size initial < 200KB gzipped
- [ ] First Contentful Paint < 1.5s

### Security

- [ ] All password di-hash dengan argon2 (verify di DB, tidak ada plaintext)
- [ ] JWT token disimpan di HTTP-only cookie, bukan localStorage
- [ ] SQL injection prevented (Drizzle ORM parameterized queries)
- [ ] CORS configured properly (whitelist domain prod)
- [ ] Rate limit active untuk login (5/min) dan PIN (5/jam)
- [ ] Webhook secret verified di Telegram endpoint
- [ ] OWASP top 10 audit pass

### Scalability

- [ ] Backend stateless (bisa di-scale horizontal)
- [ ] Background workers independent (bisa di-scale per queue)
- [ ] DB schema siap multi-outlet (kolom outlet_id ada)
- [ ] Indexes optimal (verify via EXPLAIN ANALYZE untuk query lambat)
- [ ] Connection pool configured (max 10 connection per instance)

### Reliability

- [ ] DB backup harian (cron + verify restore)
- [ ] Health check endpoint return 200 saat healthy
- [ ] Error tracking (Sentry) active
- [ ] Log aggregation configured
- [ ] Graceful shutdown (close DB connection, finish in-flight request)

### Maintainability

- [ ] TypeScript zero `any` di production code
- [ ] ESLint zero warning
- [ ] Test coverage > 70% untuk service + repository layer
- [ ] E2E tests cover 7 critical flows
- [ ] API documentation (Swagger) up-to-date
- [ ] Architecture docs (Batch 1+2+3 docs) up-to-date

### Accessibility

- [ ] Lighthouse Accessibility > 90
- [ ] Keyboard navigation full (Tab, Enter, Escape, Arrow)
- [ ] ARIA labels untuk icon-only buttons
- [ ] Color contrast AA minimum
- [ ] Focus visible (ring outline)

### Compatibility

- [ ] Chrome latest (desktop)
- [ ] Edge latest (desktop)
- [ ] Safari latest (desktop)
- [ ] Firefox latest (desktop)
- [ ] Tablet iPad 10" (POS primary device)
- [ ] Tidak support mobile < 640px (sesuai PRD §7)

## 4. Per-Gate Verification Checklist

### Gate 0 — Foundation ✓

- [ ] `bun install` sukses di semua workspaces
- [ ] Migration apply bersih tanpa error
- [ ] Seed data masuk (1 outlet, 6 kategori, 20 produk, 3 user, 4 member)
- [ ] Login sebagai `kasir01` → redirect `/kasir/pos`
- [ ] Login sebagai `gudang01` → redirect `/gudang/beranda`
- [ ] Login sebagai `manager01` → redirect `/manager/beranda`
- [ ] API `/api/health` return `{status: "ok"}`
- [ ] Design tokens applied di komponen dasar (Button, Card)

### Gate 1 — Auth + POS ✓

- [ ] **POS Happy Path**: Login kasir → scan (keyboard input barcode valid) → product added → attach member → pay Tunai → struk
- [ ] **POS Save Draft**: Tambah 3 produk → Save Draft → counter naik → Logout → Login → Counter masih 3 → Resume → POS ready
- [ ] **POS Void**: Order SELESAI → Void dengan PIN → status VOID + stok kembali
- [ ] **Shift Lifecycle**: Start shift (modal 200k) → 2 order selesai → End shift (modal akhir 250k, selisih matched) → status SELESAI
- [ ] **Laporan**: Buka Laporan → tampil ringkasan hari ini + chart metode bayar + best sellers
- [ ] **Setting Kasir**: Profil + ubah PIN + lihat devices

### Gate 2 — Admin Gudang ✓

- [ ] **Beranda**: Dashboard tampil ringkasan akurat (total SKU = 20, total value, low stock count)
- [ ] **Tambah Produk**: Form lengkap → foto upload → sukses, produk baru di list
- [ ] **Restock Single**: Pilih produk → Restock 50 → cek `stocks.quantity` + movement tercatat
- [ ] **Restock Massal**: Pilih 5 produk → input qty masing-masing → submit → 5 movement tercatat
- [ ] **PO Manual**: Tambah PO baru (supplier + 3 items) → status MENUNGGU_VERIFIKASI
- [ ] **PO Verify**: Verifikasi dengan qty aktual (beberapa beda dari expected) → stok update sesuai qty_actual + movement tercatat
- [ ] **Barang Keluar**: Buat outgoing + picking checklist → 100% picked → ready for SJ

### Gate 3 — Surat Jalan Approval ✓

- [ ] **Telegram Setup**: Bot created + webhook registered + Manager link via /start
- [ ] **Buat SJ**: Dari outgoing goods → form → submit → status MENUNGGU_APPROVAL + Telegram ke Manager
- [ ] **Gudang Review**: Review di SJ detail → setujui internal → status masih MENUNGGU_APPROVAL (siap Manager)
- [ ] **Manager Approve**: Login Manager → lihat queue approval → review → setujui → status DISETUJUI + Telegram ke Gudang
- [ ] **Manager Reject**: Tolak dengan alasan → status DITOLAK + reason + Telegram ke Gudang
- [ ] **Cetak SJ**: Setelah approve → cetak → PDF download → status SUDAH_DICETAK
- [ ] **Block Pre-Approve**: SJ belum approve → button cetak disabled + tooltip "Belum disetujui Manager"

### Gate 4 — Manager Dashboard ✓

- [ ] **Beranda KPI**: 5 KPI cards akurat (revenue, transactions, staff, approval count, avg)
- [ ] **Revenue Chart**: 7 hari line chart tampil dengan data benar
- [ ] **Best Sellers**: 3 produk terlaris tampil di beranda + full list di Penjualan analytics
- [ ] **Penjualan**: Filter periode (today/week/month) → data update + best sellers update
- [ ] **Inventaris Analytics**: Fast moving (top 5) + stok kritis + nilai persediaan
- [ ] **Keuangan Analytics**: Laba rugi (revenue - HPP) + hutang jatuh tempo + sumber pendapatan + pengeluaran
- [ ] **Notification Feed**: 5-10 recent telegram messages tampil

### Gate 5 — HR + Laporan + Export ✓

- [ ] **Karyawan**: List 5+ sample karyawan + detail + performa chart
- [ ] **Cuti/Izin**: Approve cuti dengan catatan → status update + notif ke karyawan (Asumsi)
- [ ] **Laporan Manager**: Buka → tampil top produk + kategori + KPI outlet
- [ ] **Export PDF Kasir**: Laporan → Export → PDF download (shift summary)
- [ ] **Export PDF Gudang**: Stock report → Export → PDF download
- [ ] **Export PDF Manager**: Business report → Export → PDF download
- [ ] **Daily Report Cron**: Wait sampai 00:30 WIB (atau trigger manual) → daily_reports row + Telegram ke Manager

### Gate 6 — AI Assistant ✓

- [ ] **Chat UI**: Manager akses `/manager/ai` → textarea + submit button visible
- [ ] **Submit Prompt**: Type prompt → submit → response "AI belum tersedia (MVP placeholder)" + prompt echo
- [ ] **History**: Conversation saved, refresh page → history list masih ada → click old conversation → load messages
- [ ] **Quick Chips**: 3-5 chips visible → click → populate input
- [ ] **Activity Feed**: Recent prompts list visible
- [ ] **RBAC**: Kasir coba akses /manager/ai → redirect ke /kasir/pos

### Gate 7 — Polish & Deploy ✓

- [ ] **E2E Tests**: 7 critical flow pass di CI
- [ ] **Accessibility**: Lighthouse Accessibility > 90 di semua screen utama
- [ ] **Performance**: Lighthouse Performance > 90 di semua screen utama
- [ ] **Cross-browser**: Chrome + Edge + Safari + Firefox test manual pass
- [ ] **Responsive**: Tablet 10" (iPad) POS test pass
- [ ] **Error Handling**: Network down → graceful error UI + retry option
- [ ] **Loading Skeleton**: Per-screen skeleton (no flash of empty content)
- [ ] **Production Deploy**: HTTPS aktif + custom domain + env production + monitoring aktif
- [ ] **Backup**: Daily backup cron aktif + verify restore procedure

## 5. Final Launch Checklist (Pre-Production)

Semua harus pass sebelum production launch:

### Technical
- [ ] Semua Gate 0-7 acceptance pass
- [ ] Semua PRD §8 AC pass (10 AC)
- [ ] Semua Non-Functional Requirements pass (Performance, Security, dll)
- [ ] Zero critical bugs open
- [ ] Zero security vulnerabilities (high/critical CVE)
- [ ] Test coverage > 70% backend, > 60% frontend
- [ ] All migrations applied to production DB
- [ ] Production env vars configured
- [ ] SSL certificate valid + auto-renew
- [ ] DNS configured (custom domain)
- [ ] Backup strategy active + tested
- [ ] Monitoring active (Sentry + health check)

### Business
- [ ] User training untuk 3 role selesai
- [ ] Dokumentasi end-user tersedia (bisa dari PRD + USER_FLOW yang sudah ada)
- [ ] Support channel siap (Telegram group / WhatsApp)
- [ ] Rollback plan documented (jika production issue)
- [ ] Pilot user identified (1 outlet untuk soft launch dulu)
- [ ] Pak bos approval final

### Post-Launch
- [ ] Monitor first 24 hours (error rate, response time, user feedback)
- [ ] Daily standup untuk bug triage
- [ ] Weekly review dengan user untuk gather feedback
- [ ] Tahap 2 planning (fitur mana yang prioritas)

## 6. Open Questions

1. **Pilot duration**: Berapa lama pilot sebelum full rollout? (Asumsi: 1-2 minggu)
2. **Rollback trigger**: Apa metric threshold untuk rollback? (Asumsi: error rate > 5% atau response time > 1s)
3. **Post-launch SLA**: Target uptime dan response time untuk production? (Asumsi: 99.5% uptime, response time sama dengan development target)
4. **Data migration**: Apakah ada data historis dari sistem lama yang perlu import? (Asumsi: tidak, fresh start)
5. **Disaster recovery**: RTO/RPO target? (Asumsi: RTO 4 jam, RPO 24 jam)

---

**Akhir dokumen IMPLEMENTATION_CHECKLIST.md**
