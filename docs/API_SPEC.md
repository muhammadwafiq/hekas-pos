# API SPEC — HEKAS POS

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Kontrak REST API untuk frontend (SvelteKit) dan integrasi eksternal
**Dasar**: `PRD.md` v1.0.0 + `FEATURE_MATRIX.md` v1.0.0 + `USER_FLOW.md` v1.0.0 + `DATABASE_DESIGN.md` v1.0.0
**Backend**: ElysiaJS (Bun) — *bukan Hono; lihat PRD §2 Tech Stack FINAL*
**Project root**: `/home/jazli/hekas-pos/`

---

## 1. Ringkasan

Dokumen ini mendefinisikan kontrak HTTP API untuk HEKAS POS. Backend menggunakan **ElysiaJS** (Bun runtime), mengembalikan JSON, dan diamankan oleh JWT (header `Authorization: Bearer <token>`). Semua endpoint kecuali `/api/auth/login` memerlukan token yang valid.

### 1.1 Base URL

| Environment | URL                              |
|-------------|----------------------------------|
| Development | `http://localhost:3001/api`      |
| Staging     | `https://api-stg.hekas.id/api`   |
| Production  | `https://api.hekas.id/api`       |

### 1.2 Format Response Standar

**Success (2xx)**:
```json
{
  "ok": true,
  "data": { /* payload */ },
  "meta": { "request_id": "req_abc123", "timestamp": "2026-06-19T08:30:00.000Z" }
}
```

**Error (4xx/5xx)**:
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Stok produk tidak cukup",
    "details": { "product_id": 1, "requested": 5, "available": 2 },
    "request_id": "req_abc123"
  }
}
```

### 1.3 HTTP Status Codes

| Code | Meaning              | Penggunaan                                        |
|------|----------------------|---------------------------------------------------|
| 200  | OK                   | Success dengan payload                            |
| 201  | Created              | Resource baru dibuat                              |
| 204  | No Content           | Success tanpa payload (mis. DELETE)               |
| 400  | Bad Request          | Validation error                                  |
| 401  | Unauthorized         | Token tidak ada / invalid / expired               |
| 403  | Forbidden            | Token valid tapi role tidak punya akses           |
| 404  | Not Found            | Resource tidak ditemukan                          |
| 409  | Conflict             | Stok habis / unique constraint / state invalid    |
| 422  | Unprocessable Entity | Logic error (mis. void order sudah di-void)      |
| 429  | Too Many Requests    | Rate limit (login, PIN attempt, webhook)          |
| 500  | Internal Server Error | Server error; logged ke Sentry (Asumsi)          |
| 503  | Service Unavailable  | Maintenance / DB down                             |

## 2. Konvensi

### 2.1 Naming
- **Endpoint**: plural noun, kebab-case. Contoh: `/api/incoming-goods`, `/api/surat-jalan`.
- **HTTP Method**: GET (read), POST (create/action), PUT (replace), PATCH (partial update), DELETE (remove).
- **Field name**: snake_case di JSON request/response. TypeScript types akan di-generate via Drizzle + zod.
- **ID**: integer (serial) untuk entity bisnis; UUID untuk `users`.

### 2.2 Pagination
Semua list endpoint menerima query `?page=1&limit=20`. Default `limit=20`, max `limit=100`.

**Response paginated**:
```json
{
  "ok": true,
  "data": [ /* items */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "total_pages": 8,
    "request_id": "req_abc123",
    "timestamp": "2026-06-19T08:30:00.000Z"
  }
}
```

### 2.3 Filtering & Sorting
- `?filter[status]=SELESAI` (filter)
- `?sort=-created_at` (descending) atau `?sort=created_at` (ascending)
- `?search=...` (full-text atau LIKE)

### 2.4 Date & Time
- Semua timestamp ISO 8601 UTC (`2026-06-19T08:30:00.000Z`).
- Date-only field (`date`, `report_date`, `hire_date`): format `YYYY-MM-DD`.
- Frontend konversi ke `Asia/Jakarta` untuk display.

### 2.5 Versioning
- Path-based: `/api/v1/...`. Saat ini hanya `v1`.
- Breaking changes → `v2`. Backward compatible → tetap `v1`.

## 3. Middleware Global

Semua request melewati middleware berikut (urutan eksekusi):

| # | Middleware       | Fungsi                                                                              |
|---|------------------|-------------------------------------------------------------------------------------|
| 1 | Request ID       | Generate `X-Request-ID` (jika tidak ada) untuk tracing                              |
| 2 | CORS             | Allow `http://localhost:5173` (dev), `https://app.hekas.id` (prod)                   |
| 3 | Logger           | Log method, path, status, duration, request_id                                      |
| 4 | Body Parser      | Parse JSON (max 10MB), multipart (max 50MB) untuk upload foto                       |
| 5 | Rate Limit       | 100 req/min/IP (default). Login 5 req/min/IP. PIN 5 req/hour/user.                  |
| 6 | Auth (JWT)       | Verify token, populate `ctx.user`                                                   |
| 7 | RBAC             | Periksa role-based access (lihat §4)                                                |
| 8 | Outlet Scope     | Filter data by `ctx.user.outlet_id` (Asumsi: setiap user terikat 1 outlet)          |
| 9 | Validation       | zod schema validation untuk body/query/params                                       |
| 10| Audit Log        | Untuk aksi sensitif (void, approve, restock), insert ke `audit_logs`                |

> **Catatan**: Middleware 6-10 di-skip untuk endpoint publik (login, health, webhook Telegram).

## 4. Role-Based Access Control (RBAC)

| Role         | Akses Endpoint                                                                  |
|--------------|---------------------------------------------------------------------------------|
| `kasir`      | POS, Order, Produk (read), Member (read), Shift, Laporan (own shift), Setting   |
| `gudang`     | Inventaris, Barang Masuk, Barang Keluar, Surat Jalan (gudang stage), Setting    |
| `manager`    | SEMUA endpoint (full read + write), termasuk approval, reports, AI, settings    |

**Enforcement**: Setiap endpoint di section 5 ditandai dengan `[K]`, `[G]`, `[M]`, atau kombinasi. Backend reject 403 jika role tidak sesuai.

## 5. Endpoint per Domain

> **Notasi role**: `[K]` = kasir only, `[G]` = gudang only, `[M]` = manager only, `[KG]` = kasir+gudang, `[KGM]` = semua, dll.

### 5.1 Auth & Session

#### `POST /api/auth/login` `[public]`
Login username + password. Auto-detect role (sesuai memory HEKAS POS: SATU login page).

**Request**:
```json
{ "username": "kasir01", "password": "***" }
```

**Response 200**:
```json
{
  "ok": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": "uuid",
      "username": "kasir01",
      "full_name": "Andi Nugraha",
      "role": "kasir",
      "outlet_id": 1
    },
    "expires_at": "2026-06-19T20:30:00.000Z"
  }
}
```

**Error**: 401 INVALID_CREDENTIALS, 429 RATE_LIMIT.

#### `POST /api/auth/logout` `[KGM]`
Invalidate current session.

#### `GET /api/auth/me` `[KGM]`
Current user info.

#### `POST /api/auth/refresh` `[KGM]`
Refresh JWT (extend 12h).

#### `POST /api/auth/pin/verify` `[K]`
Verify kasir PIN (untuk void, end shift).

**Request**:
```json
{ "pin": "123456", "action": "void_order" }
```

**Response 200**: `{ "ok": true, "data": { "verified": true } }`
**Error**: 401 INVALID_PIN, 429 TOO_MANY_ATTEMPTS.

### 5.2 Product & Category

#### `GET /api/products` `[KGM]`
List produk (read-only untuk kasir, full untuk gudang/manager).

**Query**: `?search=...&category_id=1&is_active=true&sort=name&page=1&limit=20`
**Response**: `Product[]` dengan `category`, `stock_quantity` (current outlet).

#### `GET /api/products/:id` `[KGM]`
Detail produk.

#### `POST /api/products` `[G]`
Tambah produk baru.

**Request**:
```json
{
  "sku": "MNM099",
  "barcode": "8999000111",
  "name": "Produk Baru",
  "category_id": 1,
  "unit": "pcs",
  "price_sell": 5000,
  "price_buy": 3500,
  "min_stock": 10
}
```

#### `PATCH /api/products/:id` `[G]`
Update produk.

#### `DELETE /api/products/:id` `[G]`
Soft delete (`deleted_at = now()`).

#### `GET /api/products/:id/stock-movements` `[KG]`
Riwayat pergerakan stok.

#### `POST /api/products/:id/restock` `[G]`
Restock single.

**Request**:
```json
{ "quantity": 50, "supplier_id": 1, "notes": "Restock mingguan" }
```

#### `POST /api/products/restock-bulk` `[G]`
Restock massal (multi-select).

**Request**:
```json
{
  "items": [
    { "product_id": 1, "quantity": 50 },
    { "product_id": 2, "quantity": 30 }
  ],
  "supplier_id": 1,
  "notes": "Restock gabungan"
}
```

#### `POST /api/products/:id/image` `[G]`
Upload foto produk (multipart).

#### `GET /api/categories` `[KGM]`
List kategori aktif.

#### `POST /api/products/:id/stock-adjustment` `[G]`
Stock adjustment (perlu approval manager jika delta besar, Asumsi: >min_stock×3).

### 5.3 Member

#### `GET /api/members` `[KM]`
List member.

#### `GET /api/members/:id` `[KM]`
Detail member + purchase history.

#### `POST /api/members` `[M]`
Tambah member baru.

#### `PATCH /api/members/:id` `[M]`
Update member (nama, phone, tier manual).

#### `GET /api/members/:id/purchase-history` `[KM]`
Riwayat pembelian member.

### 5.4 POS — Order

#### `POST /api/orders` `[K]`
Buat order baru (DRAFT). Status awal DRAFT, belum komit stok.

**Request**:
```json
{
  "member_id": null,
  "items": [
    { "product_id": 1, "qty": 2, "discount": 0 },
    { "product_id": 5, "qty": 1, "discount": 500 }
  ],
  "global_discount": 0
}
```

**Response 201**: `Order` dengan `id`, `total`, `status: 'DRAFT'`.

#### `GET /api/orders` `[KGM]`
List order dengan filter.

**Query**: `?status=SELESAI&cashier_id=...&member_id=...&date_from=2026-06-01&date_to=2026-06-19&search=TRX-...&page=1&limit=20`
- `[K]` hanya order miliknya (own cashier_id).
- `[M]` semua order.
- `[G]` semua order (read-only).

#### `GET /api/orders/:id` `[KGM]`
Detail order + items + payment.

#### `PATCH /api/orders/:id` `[K]`
Update draft order (sebelum SELESAI).

#### `POST /api/orders/:id/complete` `[K]`
Komit order → SELESAI. **Atomic transaction**: update stock + create payment + update shift counter. Trigger Telegram jika member gold/platinum (Asumsi).

**Request**:
```json
{
  "payment": {
    "method": "TUNAI",
    "amount": 50000,
    "received": 50000
  }
}
```

**Response 201**: Order SELESAI + receipt.
**Error**: 409 INSUFFICIENT_STOCK, 409 INVALID_STATE (bukan DRAFT).

#### `POST /api/orders/:id/void` `[K]`
Void order. **Wajib** PIN kasir (lihat 5.1).

**Request**:
```json
{ "pin": "123456", "reason": "Salah input produk" }
```

**Side effect**: `stocks` restored (per item) + `stock_movements` insert (`out_void_restore`) + `audit_logs` insert.

#### `POST /api/orders/:id/hold` `[K]`
Simpan sebagai draft hold (counter "Draft Order" naik).

#### `GET /api/orders/held-drafts` `[K]`
List draft hold kasir ini sendiri.

#### `POST /api/orders/held-drafts/:id/resume` `[K]`
Resume draft hold → convert ke DRAFT order.

### 5.5 POS — Held Draft (cart persistence)

> Lihat 5.4 — endpoint utama di `/orders/hold` dan `/orders/held-drafts`.

### 5.6 Shift

#### `POST /api/shifts/start` `[K]`
Mulai shift baru.

**Request**:
```json
{ "modal_awal": 200000 }
```

**Side effect**: Create shift dengan `status='AKTIF'`. Reject jika kasir masih punya shift AKTIF (409 SHIFT_ALREADY_ACTIVE).

#### `POST /api/shifts/:id/end` `[K]`
Akhiri shift. Wajib PIN.

**Request**:
```json
{
  "pin": "123456",
  "modal_akhir": 250000,
  "handover_to_user_id": null,
  "notes": "Shift sore"
}
```

**Side effect**: Update shift `status='SELESAI'` + hitung selisih modal + audit log + trigger Telegram ke Manager (Asumsi).

#### `GET /api/shifts` `[KM]`
List shift.

- `[K]`: only own.
- `[M]`: all.

**Query**: `?status=AKTIF&cashier_id=...&date_from=...&date_to=...&page=1&limit=20`

#### `GET /api/shifts/active` `[K]`
Shift aktif kasir saat ini (atau 404 jika tidak ada).

#### `GET /api/shifts/:id` `[KM]`
Detail shift + handover info + summary.

#### `GET /api/shifts/:id/summary` `[KM]`
Rekap shift: total transaksi, total sales, breakdown metode bayar, top 5 produk.

### 5.7 Inventory — Barang Masuk (PO)

#### `GET /api/incoming-goods` `[GM]`
List PO.

**Query**: `?status=MENUNGGU_VERIFIKASI&supplier_id=...&date_from=...&date_to=...&page=1&limit=20`

#### `GET /api/incoming-goods/:id` `[GM]`
Detail PO + items.

#### `POST /api/incoming-goods` `[G]`
Buat PO baru (input barang masuk manual).

**Request**:
```json
{
  "supplier_id": 1,
  "items": [
    { "product_id": 1, "qty_expected": 100 },
    { "product_id": 5, "qty_expected": 50 }
  ],
  "notes": "PO mingguan"
}
```

#### `POST /api/incoming-goods/:id/verify` `[G]`
Verifikasi PO → update stock.

**Request**:
```json
{
  "items": [
    { "id": 1, "qty_actual": 98 },
    { "id": 2, "qty_actual": 50 }
  ],
  "notes": "Item 1 kurang 2 pcs (rusak)"
}
```

**Side effect**: 
- `incoming_goods.status = 'TERVERIFIKASI'`
- `stocks.quantity += qty_actual` per item
- `stock_movements` insert (`in_purchase`)
- Trigger Telegram "barang masuk berhasil diverifikasi" ke Manager + Gudang

#### `POST /api/incoming-goods/:id/reject` `[G]`
Tolak PO (stok unchanged, alasan dicatat).

### 5.8 Inventory — Barang Keluar & Surat Jalan

#### `GET /api/outgoing-goods` `[GM]`
List barang keluar.

#### `POST /api/outgoing-goods` `[G]`
Buat barang keluar (antar-cabang / retur).

**Request**:
```json
{
  "destination": "Cabang Bandung",
  "items": [
    { "product_id": 1, "qty": 20 },
    { "product_id": 2, "qty": 10 }
  ]
}
```

#### `POST /api/outgoing-goods/:id/pick` `[G]`
Proses picking (tandai per item selesai di-pick).

#### `GET /api/surat-jalan` `[GM]`
List surat jalan.

**Query**: `?status=MENUNGGU_APPROVAL&date_from=...&date_to=...&page=1&limit=20`

#### `GET /api/surat-jalan/:id` `[GM]`
Detail SJ + items + approvals history.

#### `POST /api/surat-jalan` `[G]`
Buat SJ dari outgoing_goods.

**Request**:
```json
{
  "outgoing_good_id": 1,
  "destination": "Cabang Bandung",
  "items": [
    { "product_id": 1, "qty": 20 },
    { "product_id": 2, "qty": 10 }
  ],
  "notes": "Restock cabang"
}
```

**Side effect**: 
- `surats.status = 'MENUNGGU_APPROVAL'`
- Trigger Telegram "surat jalan perlu approval" ke Manager

#### `POST /api/surat-jalan/:id/review-gudang` `[G]`
2-stage approval: gudang internal review (sebelum ke Manager).

**Request**: `{ "decision": "APPROVE" | "REJECT", "reason": "..." }`

#### `POST /api/surat-jalan/:id/approve` `[M]`
Manager final approve → `status = 'DISETUJUI'`. Trigger Telegram ke Gudang.

#### `POST /api/surat-jalan/:id/reject` `[M]`
Manager reject → `status = 'DITOLAK'` + reason. Trigger Telegram ke Gudang.

#### `POST /api/surat-jalan/:id/print` `[GM]`
Cetak SJ (PDF). `status = 'SUDAH_DICETAK'`.

#### `POST /api/surat-jalan/:id/reprint` `[G]`
Cetak ulang.

#### `POST /api/surat-jalan/:id/mark-sent` `[G]`
Tandai sudah dikirim → `status = 'TERKIRIM'`.

### 5.9 Inventory — Master

#### `GET /api/suppliers` `[GM]`
List supplier.

#### `POST /api/suppliers` `[G]`
Tambah supplier.

#### `PATCH /api/suppliers/:id` `[G]`
Update supplier.

#### `GET /api/inventory/summary` `[GM]`
Ringkasan inventaris (untuk dashboard):
```json
{
  "total_products": 142,
  "total_stock_value": 45230000,
  "low_stock_count": 12,
  "critical_stock_count": 3,
  "needs_restock_count": 15
}
```

#### `GET /api/inventory/export` `[GM]`
Download laporan stok (PDF/Excel). Return binary file atau signed URL (Asumsi).

### 5.10 Approval — Cuti/Izin

#### `GET /api/leave-requests` `[M]`
List pengajuan cuti/izin.

**Query**: `?status=MENUNGGU&employee_id=...&date_from=...&date_to=...&page=1&limit=20`

#### `POST /api/leave-requests/:id/approve` `[M]`
Setujui cuti/izin.

#### `POST /api/leave-requests/:id/reject` `[M]`
Tolak + reason.

### 5.11 Karyawan

#### `GET /api/employees` `[M]`
List karyawan.

#### `GET /api/employees/:id` `[M]`
Detail karyawan.

#### `GET /api/employees/:id/performance` `[M]`
Statistik performa per periode.

#### `GET /api/employees/summary` `[M]`
Ringkasan SDM untuk dashboard.

### 5.12 Reports

#### `GET /api/reports/sales` `[KM]`
Laporan penjualan dengan filter periode.

**Query**: `?period=today|week|month|custom&date_from=...&date_to=...`

**Response**:
```json
{
  "data": {
    "total_transactions": 142,
    "total_items_sold": 487,
    "total_revenue": 12450000,
    "by_payment_method": {
      "TUNAI": { "count": 95, "amount": 8400000 },
      "QRIS": { "count": 35, "amount": 3200000 },
      "DEBIT": { "count": 12, "amount": 850000 }
    },
    "best_sellers": [ /* top 5 */ ],
    "category_breakdown": [ /* ... */ ]
  }
}
```

#### `GET /api/reports/inventory` `[M]`
Laporan inventaris (fast moving, stok kritis, nilai persediaan, insight).

#### `GET /api/reports/finance` `[M]`
Laporan keuangan (laba rugi, hutang jatuh tempo, sumber pendapatan, pengeluaran, insight).

#### `GET /api/reports/operational` `[M]`
Laporan operasional outlet.

#### `GET /api/reports/daily/:date` `[M]`
Laporan harian (snapshot).

#### `POST /api/reports/export` `[KGM]`
Generate PDF report (background job). Return `job_id`.

#### `GET /api/reports/export/:job_id` `[KGM]`
Check export job status + download URL.

### 5.13 Manager Dashboard

#### `GET /api/dashboard/manager` `[M]`
KPI cards untuk dashboard manager.

**Response**:
```json
{
  "data": {
    "kpi": {
      "pendapatan_hari_ini": 12450000,
      "total_transaksi": 142,
      "staff_aktif": 4,
      "perlu_persetujuan": 5,
      "avg_per_transaksi": 87700
    },
    "revenue_chart": [ /* 7 hari */ ],
    "best_sellers": [ /* top 3 */ ],
    "category_breakdown": [ /* ... */ ],
    "shift_karyawan": [ /* ... */ ],
    "approvals_pending": [ /* top 5 */ ],
    "notifications": [ /* recent telegram */ ]
  }
}
```

#### `GET /api/dashboard/kasir` `[K]`
Dashboard ringkas untuk kasir (shift aktif, total transaksi hari ini).

### 5.14 Analytics & Insight

#### `GET /api/analytics/sales` `[M]`
Analisis penjualan detail + insight.

#### `GET /api/analytics/inventory` `[M]`
Analisis inventaris + insight.

#### `GET /api/analytics/finance` `[M]`
Analisis keuangan + insight.

#### `GET /api/analytics/employees` `[M]`
Analisis SDM + insight.

### 5.15 AI Assistant (Manager Only)

#### `POST /api/ai/chat` `[M]`
Kirim prompt ke AI (MVP: echo).

**Request**:
```json
{ "prompt": "Bagaimana penjualan minggu ini?", "conversation_id": null }
```

**Response**:
```json
{
  "data": {
    "conversation_id": 12,
    "message": {
      "id": 24,
      "role": "assistant",
      "content": "AI belum tersedia (MVP placeholder). Prompt Anda: ...",
      "created_at": "2026-06-19T08:30:00.000Z"
    }
  }
}
```

#### `GET /api/ai/conversations` `[M]`
List conversation history.

#### `GET /api/ai/conversations/:id` `[M]`
Detail conversation + messages.

#### `GET /api/ai/activity` `[M]`
Aktivitas AI terbaru (recent prompts).

#### `GET /api/ai/insights` `[M]`
Quick insight chips.

### 5.16 Settings & Configuration

#### `GET /api/settings/outlet` `[M]`
Profil outlet.

#### `PATCH /api/settings/outlet` `[M]`
Update profil outlet.

#### `GET /api/settings/operational-hours` `[M]`
Jam operasional.

#### `PATCH /api/settings/operational-hours` `[M]`
Update jam operasional.

#### `GET /api/settings/system` `[M]`
System settings (server, database, notifikasi).

#### `GET /api/settings/system/:key` `[M]`
Get specific setting.

#### `PATCH /api/settings/system/:key` `[M]`
Update specific setting.

#### `GET /api/devices` `[KGM]`
List perangkat (own user).

#### `POST /api/devices` `[K]`
Daftarkan perangkat baru.

#### `DELETE /api/devices/:id` `[K]`
Hapus perangkat.

#### `GET /api/printers` `[K]`
List printer (untuk kasir setting).

#### `POST /api/printers` `[K]`
Tambah printer.

#### `PATCH /api/printers/:id` `[K]`
Update konfigurasi printer.

#### `POST /api/printers/:id/test` `[K]`
Test print.

### 5.17 Telegram

#### `POST /api/telegram/link` `[KGM]`
Generate link code untuk connect Telegram.

**Response**:
```json
{ "data": { "code": "HEKAS-AB12CD", "bot_url": "https://t.me/hekas_bot?start=AB12CD", "expires_at": "..." } }
```

#### `POST /api/telegram/webhook` `[public - Telegram]`
Webhook dari Telegram Bot. Verify secret token di header.

> **Asumsi**: Telegram webhook handled oleh backend (ElysiaJS), bukan worker terpisah, agar lebih sederhana. Worker pg-boss hanya kirim pesan.

#### `GET /api/telegram/messages` `[M]`
Log pesan terkirim.

### 5.18 System & Health

#### `GET /api/health` `[public]`
Health check.

**Response**:
```json
{ "ok": true, "data": { "status": "ok", "db": "ok", "telegram": "ok", "version": "1.0.0" } }
```

#### `GET /api/version` `[public]`
App version.

## 6. Catatan & Konvensi Tambahan

### 6.1 Idempotency
Untuk aksi create yang sensitif (`POST /orders`, `POST /orders/:id/complete`, `POST /shifts/start`), dukung `Idempotency-Key` header (UUID dari client). Same key + same body = return cached response (24h). Same key + different body = 409 IDEMPOTENCY_CONFLICT.

### 6.2 Long-Running Operations
- PDF export (5.12), report generation → return `job_id` di 202 Accepted, client poll endpoint sampai `status: 'done'` + `download_url`.
- Telegram retry → handled di `notification_queue` (lihat DATABASE_DESIGN §4.11).

### 6.3 Rate Limiting Detail
| Endpoint                       | Limit                |
|--------------------------------|----------------------|
| `POST /auth/login`             | 5 / menit / IP       |
| `POST /auth/pin/verify`        | 5 / jam / user       |
| Global                         | 100 / menit / IP     |
| `POST /telegram/webhook`       | Unlimited (verified) |
| `POST /orders/:id/complete`    | 30 / menit / user    |

Response 429:
```json
{
  "ok": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Terlalu banyak permintaan, coba lagi nanti",
    "details": { "retry_after": 60 }
  }
}
```

### 6.4 Error Codes (Domain-Specific)

| Code                       | HTTP | Keterangan                                           |
|----------------------------|------|------------------------------------------------------|
| `INVALID_CREDENTIALS`      | 401  | Login gagal                                          |
| `INVALID_PIN`              | 401  | PIN kasir salah                                      |
| `INSUFFICIENT_STOCK`       | 409  | Stok produk kurang saat komit order                  |
| `INVALID_STATE`            | 409  | Transisi state tidak valid (mis. void order SELESAI→SELESAI) |
| `SHIFT_ALREADY_ACTIVE`     | 409  | Kasir sudah punya shift AKTIF                        |
| `PRODUCT_NOT_ACTIVE`       | 400  | Produk non-aktif / soft-deleted                      |
| `MEMBER_TIER_LOCKED`       | 403  | (Asumsi) Tier member tidak bisa diubah sembarangan   |
| `SJ_NOT_APPROVED`          | 409  | Surat jalan belum disetujui, tidak bisa dicetak      |
| `TELEGRAM_DOWN`            | 503  | Telegram API error, message buffered                |
| `AI_NOT_AVAILABLE`         | 503  | (Asumsi) Real LLM belum terintegrasi (Tahap 2)      |

### 6.5 Webhook Security
Telegram webhook: verify `X-Telegram-Bot-Api-Secret-Token` header sama dengan env `TELEGRAM_WEBHOOK_SECRET`. Tolak jika tidak match.

### 6.6 CORS
- Dev: `http://localhost:5173` (Vite dev server)
- Prod: `https://app.hekas.id` (SvelteKit)
- Allow methods: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- Allow headers: `Content-Type, Authorization, X-Request-ID, Idempotency-Key`
- Credentials: `true` (untuk cookie auth future)

### 6.7 Timezone
- Server: UTC.
- Frontend display: Asia/Jakarta (atau sesuai outlet config).
- Filter `date_from`/`date_to`: gunakan ISO date `YYYY-MM-DD` (server convert ke UTC range 00:00 Asia/Jakarta → 23:59 Asia/Jakarta).

### 6.8 Bahasa
- Response message dalam Bahasa Indonesia.
- Error code: English uppercase (untuk client-side handling).
- Field name: snake_case.

## 7. Open Questions

1. **Auth refresh strategy**: Sliding window vs refresh token? (Asumsi: sliding window dengan JWT 12h)
2. **Real-time push (WebSocket)**: Untuk notifikasi dashboard Manager (stok kritis real-time, approval masuk) perlu WebSocket atau cukup polling? (Asumsi: SSE untuk MVP, WebSocket Tahap 2)
3. **Image upload storage**: Local filesystem, S3-compatible, atau Cloudflare R2? (Asumsi: local filesystem untuk MVP, R2 Tahap 2)
4. **PDF generation library**: Puppeteer, PDFKit, atau wkhtmltopdf? (Asumsi: Puppeteer untuk MVP)
5. **Multi-outlet API scoping**: Sekarang 1 outlet. Saat multi-outlet, perlu `?outlet_id=...` query atau header? (Asumsi: header `X-Outlet-Id` untuk explicit switching)

---

**Akhir dokumen API_SPEC.md**
