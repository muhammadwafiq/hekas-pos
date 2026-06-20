# DATABASE DESIGN — HEKAS POS

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Source of Truth untuk skema database & Drizzle ORM
**Dasar**: PRD v1.0.0 + FEATURE_MATRIX v1.0.0 + USER_FLOW v1.0.0 + UI evidence (Stitch export Kasir + design components)
**Project root**: `/home/jazli/hekas-pos/`
**Engine**: PostgreSQL 15+ (diasumsikan; Assumption)

---

## 1. Ringkasan & Prinsip Desain

Dokumen ini adalah **blueprint** skema database untuk HEKAS POS menggunakan PostgreSQL + Drizzle ORM (Drizzle Kit untuk migration). Skema dirancang untuk:

- **Atomicity transaksi POS**: pengurangan stok + pencatatan order + update shift dalam satu transaksi DB (lihat PRD §8).
- **Auditability**: semua aksi sensitif (void, restock, approve SJ, ubah stok) wajib tercatat di `audit_logs`.
- **Role-based data ownership**: data operasional (POS, gudang) dipisah strict; Manager hanya lihat data agregat/ringkasan, bukan raw operational.
- **Immutability untuk event log**: `stock_movements`, `audit_logs`, `ai_messages` = append-only.
- **Outlet-aware (Assumption)**: meski MVP single outlet, kolom `outlet_id` disertakan agar siap multi-outlet (lihat PRD §7 Non-Goals — saat ini selalu 1 outlet).

## 2. Stack & Tools

| Layer           | Pilihan                              |
|-----------------|--------------------------------------|
| DB Engine       | PostgreSQL 15+                       |
| ORM             | Drizzle ORM + drizzle-kit (migrations) |
| Schema language | TypeScript (Drizzle pgTable)         |
| Migration tool  | `drizzle-kit generate` + `drizzle-kit migrate` |
| Connection pool | `postgres` (postgres.js) atau `pg`    |
| Background jobs | pg-boss (PostgreSQL-backed)          |
| Seeding         | Drizzle seed script (`drizzle-seed` atau custom TS) |
| Soft delete     | `deleted_at TIMESTAMPTZ NULL` (tidak hard delete untuk entitas master) |

## 3. Domain & Entitas (Peta Tingkat Tinggi)

Skema dipecah menjadi 11 domain. Tabel diberi prefix domain untuk clarity.

| Domain              | Tabel                                                              |
|---------------------|--------------------------------------------------------------------|
| Auth & User         | `users`, `user_sessions`, `pin_attempts`                           |
| Master              | `categories`, `products`, `product_images`, `suppliers`, `members` |
| Stock               | `stocks`, `stock_movements`, `stock_adjustments`                   |
| POS                 | `orders`, `order_items`, `payments`, `held_drafts`                 |
| Shift               | `shifts`, `shift_handovers`                                        |
| Incoming Goods (PO) | `incoming_goods`, `incoming_good_items`                            |
| Outgoing Goods      | `outgoing_goods`, `outgoing_good_items`                            |
| Surat Jalan         | `surats`, `surat_items`, `surat_approvals`                         |
| HR & Karyawan       | `employees`, `attendances`, `leave_requests`, `employee_performances` |
| Reports             | `daily_reports`, `report_snapshots` (cached)                       |
| Telegram            | `telegram_links`, `telegram_messages`, `notification_queue`        |
| AI                  | `ai_conversations`, `ai_messages`                                  |
| Audit & System      | `audit_logs`, `outlet_settings`, `system_settings`, `devices`, `printers` |

## 4. Tabel Detail per Domain

> **Catatan**: Tipe `serial` = auto-increment integer. `uuid` = `gen_random_uuid()`. `timestamptz` = UTC. `numeric(p,s)` untuk uang. Semua FK menggunakan `ON DELETE RESTRICT` kecuali disebutkan lain.

### 4.1 Auth & User

#### `users`
Akun login untuk ketiga role. **Asumsi**: role-based; satu user = satu role (tidak multi-role). Login pakai username + password → JWT.

| Column         | Type         | Constraint                       | Keterangan |
|----------------|--------------|----------------------------------|------------|
| id             | uuid         | PK                               | |
| username       | varchar(64)  | UNIQUE NOT NULL                  | |
| password_hash  | text         | NOT NULL                         | bcrypt/argon2 |
| full_name      | varchar(128) | NOT NULL                         | |
| role           | user_role    | NOT NULL                         | enum: `kasir`, `gudang`, `manager` |
| phone          | varchar(32)  | NULL                             | |
| email          | varchar(128) | NULL                             | |
| avatar_url     | text         | NULL                             | |
| is_active      | boolean      | NOT NULL DEFAULT true            | |
| pin_hash       | text         | NULL                             | 4-6 digit PIN kasir (lihat PRD §2) |
| last_login_at  | timestamptz  | NULL                             | |
| created_at     | timestamptz  | NOT NULL DEFAULT now()           | |
| updated_at     | timestamptz  | NOT NULL DEFAULT now()           | |
| deleted_at     | timestamptz  | NULL                             | soft delete |

Indexes: `idx_users_role`, `idx_users_active_role (is_active, role)`.

#### `user_sessions`
JWT session tracking (untuk invalidation & audit).

| Column      | Type         | Constraint                  | Keterangan |
|-------------|--------------|-----------------------------|------------|
| id          | uuid         | PK                          | |
| user_id     | uuid         | FK → users(id) ON DELETE CASCADE | |
| token_hash  | text         | NOT NULL UNIQUE             | hash dari JWT jti |
| ip_address  | inet         | NULL                        | |
| user_agent  | text         | NULL                        | |
| expires_at  | timestamptz  | NOT NULL                    | |
| created_at  | timestamptz  | NOT NULL DEFAULT now()      | |
| revoked_at  | timestamptz  | NULL                        | logout / force-logout |

Indexes: `idx_sessions_user`, `idx_sessions_token`.

#### `pin_attempts`
Rate limit & audit percobaan PIN kasir (void, end shift, dll).

| Column      | Type         | Constraint         | Keterangan |
|-------------|--------------|--------------------|------------|
| id          | serial       | PK                 | |
| user_id     | uuid         | FK → users(id)     | |
| action      | varchar(64)  | NOT NULL           | contoh: `void_order`, `end_shift` |
| success     | boolean      | NOT NULL           | |
| ip_address  | inet         | NULL               | |
| created_at  | timestamptz  | NOT NULL           | |

### 4.2 Master

#### `categories`
Kategori produk (Minuman, Snack, Sembako, Frozen, Rokok, Lainnya — lihat `CashierPOS.tsx` CATEGORIES).

| Column      | Type         | Constraint                | Keterangan |
|-------------|--------------|---------------------------|------------|
| id          | serial       | PK                        | |
| code        | varchar(32)  | UNIQUE NOT NULL           | contoh: `minuman`, `snack` |
| name        | varchar(64)  | NOT NULL                  | |
| icon        | varchar(16)  | NULL                      | emoji |
| sort_order  | integer      | NOT NULL DEFAULT 0        | |
| is_active   | boolean      | NOT NULL DEFAULT true     | |
| created_at  | timestamptz  | NOT NULL DEFAULT now()    | |
| updated_at  | timestamptz  | NOT NULL DEFAULT now()    | |
| deleted_at  | timestamptz  | NULL                      | |

#### `products`
Master produk. SKU, barcode, harga jual, harga beli, min.stok, status.

| Column         | Type           | Constraint                  | Keterangan |
|----------------|----------------|-----------------------------|------------|
| id             | serial         | PK                          | |
| sku            | varchar(64)    | UNIQUE NOT NULL             | |
| barcode        | varchar(64)    | UNIQUE NOT NULL             | |
| name           | varchar(256)   | NOT NULL                    | |
| category_id    | integer        | FK → categories(id)         | |
| unit           | varchar(16)    | NOT NULL                    | `pcs`, `btl`, `kg`, `ltr`, `bks` |
| price_sell     | numeric(12,2)  | NOT NULL                    | harga jual |
| price_buy      | numeric(12,2)  | NOT NULL                    | harga beli (HPP) |
| min_stock      | integer        | NOT NULL DEFAULT 0          | threshold stok kritis |
| image_url      | text           | NULL                        | foto utama (lihat `product_images` untuk multi) |
| image_emoji    | varchar(16)    | NULL                        | fallback emoji (sesuai UI evidence) |
| is_active      | boolean        | NOT NULL DEFAULT true       | |
| created_at     | timestamptz    | NOT NULL DEFAULT now()      | |
| updated_at     | timestamptz    | NOT NULL DEFAULT now()      | |
| deleted_at     | timestamptz    | NULL                        | soft delete |

Indexes: `idx_products_category`, `idx_products_active (is_active) WHERE deleted_at IS NULL`, `idx_products_barcode`, `idx_products_sku`.

#### `product_images`
Multi-foto per produk.

| Column      | Type         | Constraint              | Keterangan |
|-------------|--------------|-------------------------|------------|
| id          | serial       | PK                      | |
| product_id  | integer      | FK → products(id) ON DELETE CASCADE | |
| url         | text         | NOT NULL                | |
| sort_order  | integer      | NOT NULL DEFAULT 0      | |
| created_at  | timestamptz  | NOT NULL DEFAULT now()  | |

#### `suppliers`
Master supplier barang masuk (PO).

| Column      | Type         | Constraint                | Keterangan |
|-------------|--------------|---------------------------|------------|
| id          | serial       | PK                        | |
| code        | varchar(32)  | UNIQUE NOT NULL           | |
| name        | varchar(128) | NOT NULL                  | |
| contact     | varchar(128) | NULL                      | nama CP |
| phone       | varchar(32)  | NULL                      | |
| address     | text         | NULL                      | |
| is_active   | boolean      | NOT NULL DEFAULT true     | |
| created_at  | timestamptz  | NOT NULL DEFAULT now()    | |
| updated_at  | timestamptz  | NOT NULL DEFAULT now()    | |
| deleted_at  | timestamptz  | NULL                      | |

#### `members`
Member / pelanggan loyalitas (Gold/Silver/Platinum tier statis per PRD §7).

| Column            | Type         | Constraint                       | Keterangan |
|-------------------|--------------|----------------------------------|------------|
| id                | serial       | PK                               | |
| code              | varchar(32)  | UNIQUE NOT NULL                  | format: `MBR-XXX` (UI evidence) |
| name              | varchar(128) | NOT NULL                         | |
| phone             | varchar(32)  | NOT NULL                         | |
| email             | varchar(128) | NULL                             | |
| tier              | member_tier  | NOT NULL DEFAULT 'Silver'        | enum: `Silver`, `Gold`, `Platinum` |
| points            | integer      | NOT NULL DEFAULT 0               | |
| total_spent       | numeric(14,2)| NOT NULL DEFAULT 0               | lifetime |
| is_active         | boolean      | NOT NULL DEFAULT true            | |
| joined_at         | timestamptz  | NOT NULL DEFAULT now()           | |
| last_activity_at  | timestamptz  | NULL                             | |
| created_at        | timestamptz  | NOT NULL DEFAULT now()           | |
| updated_at        | timestamptz  | NOT NULL DEFAULT now()           | |
| deleted_at        | timestamptz  | NULL                             | |

Indexes: `idx_members_phone`, `idx_members_tier`.

### 4.3 Stock

#### `stocks`
Stok **per produk per outlet**. Saat ini 1 outlet (MVP), tapi struktur multi-outlet-ready.

| Column       | Type         | Constraint                                       | Keterangan |
|--------------|--------------|--------------------------------------------------|------------|
| product_id   | integer      | FK → products(id), PK (composite)                | |
| outlet_id    | integer      | FK → outlet_settings(id), PK (composite)         | |
| quantity     | integer      | NOT NULL DEFAULT 0                               | |
| reserved     | integer      | NOT NULL DEFAULT 0                               | (Asumsi) reserved untuk draft order (future) |
| updated_at   | timestamptz  | NOT NULL DEFAULT now()                           | |

#### `stock_movements`
**Immutable ledger** — append-only. Setiap perubahan stok (masuk/keluar/adjust) tercatat.

| Column         | Type           | Constraint                                       | Keterangan |
|----------------|----------------|--------------------------------------------------|------------|
| id             | serial         | PK                                                | |
| product_id     | integer        | FK → products(id)                                 | |
| outlet_id      | integer        | FK → outlet_settings(id)                          | |
| movement_type  | stock_movement_type | NOT NULL                                    | enum: `in_purchase`, `in_adjustment`, `in_return`, `out_sale`, `out_transfer`, `out_void_restore`, `out_adjustment` |
| quantity_delta | integer        | NOT NULL                                         | + masuk, - keluar |
| quantity_after | integer        | NOT NULL                                         | snapshot stok setelah movement |
| reference_type | varchar(32)    | NULL                                             | `order`, `incoming_good`, `outgoing_good`, `adjustment` |
| reference_id   | integer        | NULL                                             | ID dari tabel referensi |
| notes          | text           | NULL                                             | |
| created_by     | uuid           | FK → users(id)                                    | siapa yang trigger |
| created_at     | timestamptz    | NOT NULL DEFAULT now()                            | |

Indexes: `idx_movements_product`, `idx_movements_created_at`, `idx_movements_reference (reference_type, reference_id)`.

#### `stock_adjustments`
Reason & approval terpisah dari ledger (untuk audit). Setiap adjustment buat 1 row di sini + 1 row di `stock_movements`.

| Column        | Type         | Constraint                  | Keterangan |
|---------------|--------------|-----------------------------|------------|
| id            | serial       | PK                          | |
| product_id    | integer      | FK → products(id)           | |
| outlet_id     | integer      | FK → outlet_settings(id)    | |
| quantity_delta| integer      | NOT NULL                    | + atau - |
| reason        | text         | NOT NULL                    | |
| approved_by   | uuid         | FK → users(id) NULL         | manager (untuk adjustment besar) |
| created_by    | uuid         | FK → users(id)              | |
| created_at    | timestamptz  | NOT NULL DEFAULT now()      | |

### 4.4 POS

#### `orders`
Transaksi kasir. **Status state machine**: `DRAFT` → `SELESAI` → `VOID` (lihat USER_FLOW §6.1).

| Column         | Type           | Constraint                  | Keterangan |
|----------------|----------------|-----------------------------|------------|
| id             | serial         | PK                          | |
| order_no       | varchar(32)    | UNIQUE NOT NULL             | format: `TRX-YYYYMMDD-XXXX` (Asumsi) |
| shift_id       | integer        | FK → shifts(id) NULL        | diisi saat SELESAI |
| cashier_id     | uuid           | FK → users(id)              | yang buat |
| member_id      | integer        | FK → members(id) NULL       | opsional |
| status         | order_status   | NOT NULL DEFAULT 'DRAFT'    | enum: `DRAFT`, `SELESAI`, `VOID` |
| subtotal       | numeric(12,2)  | NOT NULL DEFAULT 0          | |
| discount       | numeric(12,2)  | NOT NULL DEFAULT 0          | global disc |
| total          | numeric(12,2)  | NOT NULL DEFAULT 0          | grand total |
| notes          | text           | NULL                        | |
| voided_by      | uuid           | FK → users(id) NULL         | |
| void_reason    | text           | NULL                        | |
| voided_at      | timestamptz    | NULL                        | |
| completed_at   | timestamptz    | NULL                        | saat SELESAI |
| created_at     | timestamptz    | NOT NULL DEFAULT now()      | |
| updated_at     | timestamptz    | NOT NULL DEFAULT now()      | |

Indexes: `idx_orders_cashier_created`, `idx_orders_status`, `idx_orders_member`, `idx_orders_shift`.

#### `order_items`
Item per order. Snapshot harga jual saat transaksi (penting untuk historical accuracy).

| Column       | Type           | Constraint                  | Keterangan |
|--------------|----------------|-----------------------------|------------|
| id           | serial         | PK                          | |
| order_id     | integer        | FK → orders(id) ON DELETE CASCADE | |
| product_id   | integer        | FK → products(id)           | |
| product_name_snapshot | varchar(256) | NOT NULL              | snapshot nama |
| sku_snapshot | varchar(64)    | NOT NULL                    | snapshot SKU |
| price_sell   | numeric(12,2)  | NOT NULL                    | snapshot harga jual |
| qty          | integer        | NOT NULL                    | |
| discount     | numeric(12,2)  | NOT NULL DEFAULT 0          | per-item disc |
| subtotal     | numeric(12,2)  | NOT NULL                    | (price_sell × qty) - discount |
| notes        | text           | NULL                        | |

Indexes: `idx_order_items_order`, `idx_order_items_product`.

#### `payments`
Pembayaran per order. Satu order bisa multi-payment (Asumsi: split tender)? Untuk MVP, 1 order = 1 payment. Multi-payment disupport struktur.

| Column         | Type           | Constraint                  | Keterangan |
|----------------|----------------|-----------------------------|------------|
| id             | serial         | PK                          | |
| order_id       | integer        | FK → orders(id)             | |
| method         | payment_method | NOT NULL                    | enum: `TUNAI`, `QRIS`, `DEBIT` (lihat PRD §2) |
| amount         | numeric(12,2)  | NOT NULL                    | |
| reference      | varchar(128)   | NULL                        | QRIS ref / debit approval code |
| received       | numeric(12,2)  | NULL                        | tunai yang diterima (untuk hitung kembalian) |
| change_amount  | numeric(12,2)  | NULL                        | kembalian |
| created_at     | timestamptz    | NOT NULL DEFAULT now()      | |

Indexes: `idx_payments_order`, `idx_payments_method_created`.

#### `held_drafts`
Draft order yang disimpan kasir (counter "Draft Order" di header POS).

| Column       | Type           | Constraint                  | Keterangan |
|--------------|----------------|-----------------------------|------------|
| id           | serial         | PK                          | |
| cashier_id   | uuid           | FK → users(id)              | hanya kasir sendiri yang bisa resume |
| cart_data    | jsonb          | NOT NULL                    | serialized cart state |
| member_id    | integer        | FK → members(id) NULL       | |
| total        | numeric(12,2)  | NOT NULL DEFAULT 0          | |
| label        | varchar(64)    | NULL                        | catatan kasir |
| created_at   | timestamptz    | NOT NULL DEFAULT now()      | |
| updated_at   | timestamptz    | NOT NULL DEFAULT now()      | |

Indexes: `idx_held_drafts_cashier`, `idx_held_drafts_cashier_created (cashier_id, created_at DESC)`.

### 4.5 Shift

#### `shifts`
Shift kasir. State: `UPCOMING`, `AKTIF`, `SELESAI` (USER_FLOW §6.2).

| Column            | Type         | Constraint                       | Keterangan |
|-------------------|--------------|----------------------------------|------------|
| id                | serial       | PK                                | |
| shift_no          | varchar(32)  | UNIQUE NOT NULL                   | format: `SHF-XXX` (UI evidence) |
| cashier_id        | uuid         | FK → users(id)                    | |
| outlet_id         | integer      | FK → outlet_settings(id)          | |
| status            | shift_status | NOT NULL DEFAULT 'UPCOMING'       | enum: `UPCOMING`, `AKTIF`, `SELESAI` |
| started_at        | timestamptz  | NULL                              | saat Mulai Shift |
| ended_at          | timestamptz  | NULL                              | saat Akhiri Shift |
| modal_awal        | numeric(12,2)| NOT NULL DEFAULT 0                | modal awal (dari UI flow §2.5) |
| modal_akhir       | numeric(12,2)| NULL                              | modal akhir |
| total_transactions| integer      | NOT NULL DEFAULT 0                | counter |
| total_sales       | numeric(14,2)| NOT NULL DEFAULT 0                | total penjualan |
| total_cash        | numeric(14,2)| NOT NULL DEFAULT 0                | breakdown tunai |
| total_qris        | numeric(14,2)| NOT NULL DEFAULT 0                | breakdown QRIS |
| total_debit       | numeric(14,2)| NOT NULL DEFAULT 0                | breakdown debit |
| created_at        | timestamptz  | NOT NULL DEFAULT now()            | |
| updated_at        | timestamptz  | NOT NULL DEFAULT now()            | |

Indexes: `idx_shifts_cashier`, `idx_shifts_status_started (status, started_at)`, `idx_shifts_cashier_active (cashier_id) WHERE status = 'AKTIF'` (partial, untuk enforce 1 shift aktif per kasir).

#### `shift_handovers`
Serah terima shift antar kasir.

| Column          | Type         | Constraint                       | Keterangan |
|-----------------|--------------|----------------------------------|------------|
| id              | serial       | PK                                | |
| shift_id        | integer      | FK → shifts(id)                   | shift yang berakhir |
| from_cashier_id | uuid         | FK → users(id)                    | |
| to_cashier_id   | uuid         | FK → users(id) NULL               | bisa NULL (tutup toko) |
| modal_handover  | numeric(12,2)| NOT NULL                          | nominal serah terima |
| notes           | text         | NULL                              | |
| created_at      | timestamptz  | NOT NULL DEFAULT now()            | |

### 4.6 Incoming Goods (PO)

#### `incoming_goods`
Penerimaan barang dari supplier. State: `MENUNGGU_VERIFIKASI`, `TERVERIFIKASI`, `DITOLAK`.

| Column        | Type         | Constraint                       | Keterangan |
|---------------|--------------|----------------------------------|------------|
| id            | serial       | PK                                | |
| po_no         | varchar(32)  | UNIQUE NOT NULL                   | format: `PO-XXX` atau `SJ-XXX` (UI evidence) |
| supplier_id   | integer      | FK → suppliers(id)                | |
| outlet_id     | integer      | FK → outlet_settings(id)          | |
| status        | incoming_status | NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI' | enum: `MENUNGGU_VERIFIKASI`, `TERVERIFIKASI`, `DITOLAK` |
| received_at   | timestamptz  | NULL                              | tanggal barang tiba |
| verified_at   | timestamptz  | NULL                              | saat verifikasi selesai |
| verified_by   | uuid         | FK → users(id) NULL               | |
| total_items   | integer      | NOT NULL DEFAULT 0                | |
| notes         | text         | NULL                              | |
| created_by    | uuid         | FK → users(id)                    | admin gudang |
| created_at    | timestamptz  | NOT NULL DEFAULT now()            | |
| updated_at    | timestamptz  | NOT NULL DEFAULT now()            | |

#### `incoming_good_items`
Item per PO.

| Column             | Type           | Constraint                  | Keterangan |
|--------------------|----------------|-----------------------------|------------|
| id                 | serial         | PK                          | |
| incoming_good_id   | integer        | FK → incoming_goods(id) ON DELETE CASCADE | |
| product_id         | integer        | FK → products(id)           | |
| qty_expected       | integer        | NOT NULL                    | jumlah dari PO |
| qty_actual         | integer        | NULL                        | jumlah fisik saat verifikasi |
| unit               | varchar(16)    | NOT NULL                    | snapshot unit |
| price_buy_snapshot | numeric(12,2)  | NULL                        | (Asumsi) |
| notes              | text           | NULL                        | |

### 4.7 Outgoing Goods

#### `outgoing_goods`
Barang keluar (antar-cabang / retur). State: `MENUNGGU_PICKING`, `SIAP_DIKIRIM`, `TERKIRIM`.

| Column         | Type         | Constraint                       | Keterangan |
|----------------|--------------|----------------------------------|------------|
| id             | serial       | PK                                | |
| outgoing_no    | varchar(32)  | UNIQUE NOT NULL                   | format: `ORD-XXX` (UI evidence) |
| destination    | varchar(128) | NOT NULL                          | tujuan (cabang / customer) |
| outlet_id      | integer      | FK → outlet_settings(id)          | gudang asal |
| status         | outgoing_status | NOT NULL DEFAULT 'MENUNGGU_PICKING' | enum: `MENUNGGU_PICKING`, `SIAP_DIKIRIM`, `TERKIRIM` |
| reason_pending | text         | NULL                              | alasan tertunda (jika ada) |
| picked_at      | timestamptz  | NULL                              | |
| picked_by      | uuid         | FK → users(id) NULL               | |
| sent_at        | timestamptz  | NULL                              | |
| created_by     | uuid         | FK → users(id)                    | admin gudang |
| created_at     | timestamptz  | NOT NULL DEFAULT now()            | |
| updated_at     | timestamptz  | NOT NULL DEFAULT now()            | |

#### `outgoing_good_items`

| Column           | Type         | Constraint                  | Keterangan |
|------------------|--------------|-----------------------------|------------|
| id               | serial       | PK                          | |
| outgoing_good_id | integer      | FK → outgoing_goods(id) ON DELETE CASCADE | |
| product_id       | integer      | FK → products(id)           | |
| qty              | integer      | NOT NULL                    | |
| is_picked        | boolean      | NOT NULL DEFAULT false      | per-item picking status |

### 4.8 Surat Jalan

#### `surats`
Surat jalan untuk outgoing goods. State machine lengkap: `MENUNGGU_PICKING` → `MENUNGGU_APPROVAL` → `DISETUJUI` → `SUDAH_DICETAK` → `TERKIRIM`, atau `DITOLAK`, atau `TERTUNDA` (USER_FLOW §6.3).

| Column           | Type         | Constraint                       | Keterangan |
|------------------|--------------|----------------------------------|------------|
| id               | serial       | PK                                | |
| sj_no            | varchar(32)  | UNIQUE NOT NULL                   | format: `SJ-XXX` |
| outgoing_good_id | integer      | FK → outgoing_goods(id)           | referensi |
| order_reference  | varchar(64)  | NULL                              | referensi ORD/TRX (UI evidence) |
| destination      | varchar(128) | NOT NULL                          | |
| outlet_id        | integer      | FK → outlet_settings(id)          | |
| status           | surat_status | NOT NULL DEFAULT 'MENUNGGU_APPROVAL' | enum: `MENUNGGU_PICKING`, `MENUNGGU_APPROVAL`, `DISETUJUI`, `DITOLAK`, `SUDAH_DICETAK`, `TERKIRIM`, `TERTUNDA` |
| total_items      | integer      | NOT NULL DEFAULT 0                | |
| notes            | text         | NULL                              | |
| approved_by      | uuid         | FK → users(id) NULL               | manager |
| approved_at      | timestamptz  | NULL                              | |
| rejected_by      | uuid         | FK → users(id) NULL               | |
| rejected_at      | timestamptz  | NULL                              | |
| rejection_reason | text         | NULL                              | |
| printed_at       | timestamptz  | NULL                              | |
| printed_by       | uuid         | FK → users(id) NULL               | |
| sent_at          | timestamptz  | NULL                              | |
| created_by       | uuid         | FK → users(id)                    | admin gudang |
| created_at       | timestamptz  | NOT NULL DEFAULT now()            | |
| updated_at       | timestamptz  | NOT NULL DEFAULT now()            | |

Indexes: `idx_surats_status`, `idx_surats_outgoing`, `idx_surats_created (created_at DESC)`.

#### `surat_items`
Snapshot item per SJ (immutable setelah approve; revisi buat SJ baru).

| Column     | Type           | Constraint                  | Keterangan |
|------------|----------------|-----------------------------|------------|
| id         | serial         | PK                          | |
| surat_id   | integer        | FK → surats(id) ON DELETE CASCADE | |
| product_id | integer        | FK → products(id)           | |
| product_name_snapshot | varchar(256) | NOT NULL              | snapshot nama |
| sku_snapshot| varchar(64)    | NOT NULL                    | |
| qty        | integer        | NOT NULL                    | |
| unit       | varchar(16)    | NOT NULL                    | |

#### `surat_approvals`
2-stage approval (admin gudang review internal + manager final). Lihat USER_FLOW §3.3 catatan.

| Column      | Type         | Constraint                  | Keterangan |
|-------------|--------------|-----------------------------|------------|
| id          | serial       | PK                          | |
| surat_id    | integer      | FK → surats(id)             | |
| stage       | approval_stage | NOT NULL                  | enum: `GUDANG_REVIEW`, `MANAGER_FINAL` |
| decision    | approval_decision | NOT NULL                | enum: `APPROVE`, `REJECT` |
| decided_by  | uuid         | FK → users(id)              | |
| reason      | text         | NULL                        | |
| decided_at  | timestamptz  | NOT NULL DEFAULT now()      | |

### 4.9 HR & Karyawan

> **Asumsi**: tabel HR ini minimal yang dibutuhkan untuk UI "Karyawan" Manager. Tidak ada payroll/PPh21 (sesuai PRD §7 Non-Goals).

#### `employees`
Master data karyawan (semua role). Tabel terpisah dari `users` karena `users` = akun login; `employees` = data personal/HR.

| Column        | Type         | Constraint                       | Keterangan |
|---------------|--------------|----------------------------------|------------|
| id            | serial       | PK                                | |
| user_id       | uuid         | FK → users(id) UNIQUE NULL       | link ke akun login (nullable untuk non-user) |
| employee_no   | varchar(32)  | UNIQUE NOT NULL                   | |
| full_name     | varchar(128) | NOT NULL                          | |
| role          | user_role    | NOT NULL                          | enum sama dengan users.role |
| phone         | varchar(32)  | NULL                              | |
| hire_date     | date         | NOT NULL                          | |
| is_active     | boolean      | NOT NULL DEFAULT true             | |
| created_at    | timestamptz  | NOT NULL DEFAULT now()            | |
| updated_at    | timestamptz  | NOT NULL DEFAULT now()            | |

#### `attendances`
Kehadiran harian.

| Column      | Type         | Constraint                  | Keterangan |
|-------------|--------------|-----------------------------|------------|
| id          | serial       | PK                          | |
| employee_id | integer      | FK → employees(id)          | |
| date        | date         | NOT NULL                    | |
| check_in    | timestamptz  | NULL                        | |
| check_out   | timestamptz  | NULL                        | |
| status      | attendance_status | NOT NULL              | enum: `HADIR`, `IZIN`, `CUTI`, `ALPHA` |
| UNIQUE      |              | (employee_id, date)         | satu row per employee per hari |

#### `leave_requests`
Pengajuan cuti & izin (aksi Manager: setujui/tolak).

| Column        | Type         | Constraint                       | Keterangan |
|---------------|--------------|----------------------------------|------------|
| id            | serial       | PK                                | |
| employee_id   | integer      | FK → employees(id)                | |
| type          | leave_type   | NOT NULL                          | enum: `CUTI`, `IZIN`, `SAKIT` |
| start_date    | date         | NOT NULL                          | |
| end_date      | date         | NOT NULL                          | |
| reason        | text         | NULL                              | |
| status        | leave_status | NOT NULL DEFAULT 'MENUNGGU'       | enum: `MENUNGGU`, `DISETUJUI`, `DITOLAK` |
| decided_by    | uuid         | FK → users(id) NULL               | manager |
| decided_at    | timestamptz  | NULL                              | |
| decision_note | text         | NULL                              | |
| created_at    | timestamptz  | NOT NULL DEFAULT now()            | |

#### `employee_performances`
Statistik performa (counter: transaksi, revenue, rating).

| Column         | Type           | Constraint                  | Keterangan |
|----------------|----------------|-----------------------------|------------|
| id             | serial         | PK                          | |
| employee_id    | integer        | FK → employees(id)          | |
| period         | varchar(16)    | NOT NULL                    | `YYYY-MM` |
| total_transactions | integer    | NOT NULL DEFAULT 0          | |
| total_revenue  | numeric(14,2)  | NOT NULL DEFAULT 0          | |
| rating         | numeric(3,2)   | NULL                        | 0.00-5.00 |
| notes          | text           | NULL                        | |
| UNIQUE         |                | (employee_id, period)       | |

### 4.10 Reports

#### `daily_reports`
Snapshot laporan harian (di-generate oleh worker pg-boss, lihat PRD §6 notifikasi Telegram "laporan harian tersedia").

| Column           | Type           | Constraint                  | Keterangan |
|------------------|----------------|-----------------------------|------------|
| id               | serial         | PK                          | |
| report_date      | date           | UNIQUE NOT NULL             | satu row per hari |
| total_transactions | integer      | NOT NULL DEFAULT 0          | |
| total_items_sold | integer        | NOT NULL DEFAULT 0          | |
| total_revenue    | numeric(14,2)  | NOT NULL DEFAULT 0          | |
| total_cash       | numeric(14,2)  | NOT NULL DEFAULT 0          | |
| total_qris       | numeric(14,2)  | NOT NULL DEFAULT 0          | |
| total_debit      | numeric(14,2)  | NOT NULL DEFAULT 0          | |
| best_seller_product_id | integer | NULL                        | FK → products(id) |
| generated_at     | timestamptz    | NOT NULL DEFAULT now()      | |

#### `report_snapshots`
Cache query berat untuk dashboard Manager (pre-aggregated).

| Column        | Type         | Constraint                  | Keterangan |
|---------------|--------------|-----------------------------|------------|
| id            | serial       | PK                          | |
| snapshot_key  | varchar(64)  | NOT NULL                    | contoh: `manager_dashboard_kpi_2026_06_19` |
| data          | jsonb        | NOT NULL                    | |
| computed_at   | timestamptz  | NOT NULL DEFAULT now()      | |
| expires_at    | timestamptz  | NULL                        | |
| UNIQUE        |              | (snapshot_key)              | |

### 4.11 Telegram

#### `telegram_links`
Link user (manager/gudang) ke Telegram chat_id untuk notifikasi.

| Column      | Type         | Constraint                  | Keterangan |
|-------------|--------------|-----------------------------|------------|
| id          | serial       | PK                          | |
| user_id     | uuid         | FK → users(id) UNIQUE       | satu link per user |
| chat_id     | varchar(64)  | NOT NULL                    | Telegram chat ID |
| is_verified | boolean      | NOT NULL DEFAULT false      | via code verification |
| verify_code | varchar(16)  | NULL                        | one-time code |
| verify_expires_at | timestamptz | NULL                     | |
| created_at  | timestamptz  | NOT NULL DEFAULT now()      | |

#### `telegram_messages`
Log semua pesan Telegram yang dikirim (audit).

| Column      | Type         | Constraint                  | Keterangan |
|-------------|--------------|-----------------------------|------------|
| id          | serial       | PK                          | |
| chat_id     | varchar(64)  | NOT NULL                    | |
| event_type  | varchar(64)  | NOT NULL                    | `sj_pending_approval`, `stok_kritis`, dll |
| payload     | jsonb        | NOT NULL                    | data yang dikirim |
| status      | telegram_msg_status | NOT NULL DEFAULT 'PENDING' | enum: `PENDING`, `SENT`, `FAILED` |
| attempts    | integer      | NOT NULL DEFAULT 0          | |
| last_error  | text         | NULL                        | |
| sent_at     | timestamptz  | NULL                        | |
| created_at  | timestamptz  | NOT NULL DEFAULT now()      | |

Indexes: `idx_tg_msg_status (status, created_at)`, `idx_tg_msg_event`.

#### `notification_queue`
Buffer untuk retry Telegram saat API down (lihat USER_FLOW §7 error path).

| Column        | Type         | Constraint                  | Keterangan |
|---------------|--------------|-----------------------------|------------|
| id            | serial       | PK                          | |
| channel       | varchar(32)  | NOT NULL                    | `telegram` |
| target        | varchar(64)  | NOT NULL                    | chat_id |
| payload       | jsonb        | NOT NULL                    | |
| status        | queue_status | NOT NULL DEFAULT 'PENDING'  | enum: `PENDING`, `PROCESSING`, `DONE`, `FAILED` |
| attempts      | integer      | NOT NULL DEFAULT 0          | max 5x retry |
| next_retry_at | timestamptz  | NOT NULL                    | exponential backoff |
| last_error    | text         | NULL                        | |
| created_at    | timestamptz  | NOT NULL DEFAULT now()      | |
| updated_at    | timestamptz  | NOT NULL DEFAULT now()      | |

Indexes: `idx_nq_status_retry (status, next_retry_at) WHERE status IN ('PENDING','FAILED')`.

### 4.12 AI

> **MVP**: AI Assistant adalah echo/placeholder (lihat PRD §2 + USER_FLOW §4.8). Struktur tabel ini cukup untuk simpan history chat.

#### `ai_conversations`
Satu conversation = satu session chat Manager dengan AI.

| Column      | Type         | Constraint                  | Keterangan |
|-------------|--------------|-----------------------------|------------|
| id          | serial       | PK                          | |
| user_id     | uuid         | FK → users(id)              | manager |
| title       | varchar(256) | NULL                        | auto-generate dari prompt pertama |
| created_at  | timestamptz  | NOT NULL DEFAULT now()      | |
| updated_at  | timestamptz  | NOT NULL DEFAULT now()      | |

#### `ai_messages`
Message per conversation. Append-only.

| Column          | Type         | Constraint                  | Keterangan |
|-----------------|--------------|-----------------------------|------------|
| id              | serial       | PK                          | |
| conversation_id | integer      | FK → ai_conversations(id)   | |
| role            | ai_role      | NOT NULL                    | enum: `user`, `assistant`, `system` |
| content         | text         | NOT NULL                    | |
| created_at      | timestamptz  | NOT NULL DEFAULT now()      | |

### 4.13 Audit & System

#### `audit_logs`
**Immutable** audit trail untuk aksi sensitif.

| Column      | Type         | Constraint                  | Keterangan |
|-------------|--------------|-----------------------------|------------|
| id          | serial       | PK                          | |
| actor_id    | uuid         | FK → users(id) NULL         | NULL = system |
| action      | varchar(64)  | NOT NULL                    | `void_order`, `restock`, `approve_sj`, dll |
| entity_type | varchar(64)  | NOT NULL                    | `order`, `stock`, `surat` |
| entity_id   | varchar(64)  | NOT NULL                    | polymorphic (string untuk fleksibilitas) |
| payload     | jsonb        | NULL                        | before/after snapshot |
| ip_address  | inet         | NULL                        | |
| created_at  | timestamptz  | NOT NULL DEFAULT now()      | |

Indexes: `idx_audit_entity (entity_type, entity_id)`, `idx_audit_actor_created (actor_id, created_at DESC)`, `idx_audit_action_created (action, created_at)`.

> **No UPDATE / DELETE pada `audit_logs`** — enforced via DB role/trigger (Asumsi: implement trigger di migration).

#### `outlet_settings`
Profil outlet + jam operasional (single outlet MVP, lihat PRD §7 Non-Goals).

| Column           | Type         | Constraint                  | Keterangan |
|------------------|--------------|-----------------------------|------------|
| id               | serial       | PK                          | |
| name             | varchar(128) | NOT NULL                    | |
| code             | varchar(32)  | UNIQUE NOT NULL             | |
| address          | text         | NULL                        | |
| phone            | varchar(32)  | NULL                        | |
| operational_hours| jsonb        | NULL                        | struktur per hari `{ "monday": { "open": "08:00", "close": "22:00" } }` |
| is_active        | boolean      | NOT NULL DEFAULT true       | |
| created_at       | timestamptz  | NOT NULL DEFAULT now()      | |
| updated_at       | timestamptz  | NOT NULL DEFAULT now()      | |

#### `system_settings`
Konfigurasi global (server, database, notifikasi, dst — lihat PRD §16 Manager Pengaturan).

| Column      | Type         | Constraint                  | Keterangan |
|-------------|--------------|-----------------------------|------------|
| id          | serial       | PK                          | |
| key         | varchar(128) | UNIQUE NOT NULL             | |
| value       | jsonb        | NOT NULL                    | |
| description | text         | NULL                        | |
| updated_by  | uuid         | FK → users(id) NULL         | |
| updated_at  | timestamptz  | NOT NULL DEFAULT now()      | |

#### `devices`
Perangkat terhubung ke akun (untuk Kasir Setting, lihat FEATURE_MATRIX §16).

| Column      | Type         | Constraint                  | Keterangan |
|-------------|--------------|-----------------------------|------------|
| id          | serial       | PK                          | |
| user_id     | uuid         | FK → users(id)              | owner |
| name        | varchar(128) | NOT NULL                    | |
| type        | device_type  | NOT NULL                    | enum: `POS_TERMINAL`, `PRINTER`, `SCANNER`, `TABLET` |
| identifier  | varchar(256) | NOT NULL                    | MAC / serial / device id |
| last_seen_at| timestamptz  | NULL                        | |
| is_active   | boolean      | NOT NULL DEFAULT true       | |
| created_at  | timestamptz  | NOT NULL DEFAULT now()      | |

#### `printers`
Konfigurasi printer struk (Kasir Setting).

| Column      | Type         | Constraint                  | Keterangan |
|-------------|--------------|-----------------------------|------------|
| id          | serial       | PK                          | |
| outlet_id   | integer      | FK → outlet_settings(id)    | |
| name        | varchar(128) | NOT NULL                    | |
| type        | varchar(32)  | NOT NULL                    | `thermal`, `inkjet` |
| connection  | varchar(32)  | NOT NULL                    | `usb`, `bluetooth`, `network` |
| identifier  | varchar(256) | NOT NULL                    | address/path |
| paper_size  | varchar(16)  | NOT NULL DEFAULT '58mm'     | `58mm`, `80mm` |
| is_default  | boolean      | NOT NULL DEFAULT false      | |
| is_active   | boolean      | NOT NULL DEFAULT true       | |
| created_at  | timestamptz  | NOT NULL DEFAULT now()      | |

## 5. Enum & Tipe

Definisi enum PostgreSQL + Drizzle `pgEnum`.

| Enum Name (TS)         | Values                                                                                  |
|------------------------|-----------------------------------------------------------------------------------------|
| `user_role`            | `kasir`, `gudang`, `manager`                                                            |
| `member_tier`          | `Silver`, `Gold`, `Platinum`                                                            |
| `stock_movement_type`  | `in_purchase`, `in_adjustment`, `in_return`, `out_sale`, `out_transfer`, `out_void_restore`, `out_adjustment` |
| `order_status`         | `DRAFT`, `SELESAI`, `VOID`                                                              |
| `payment_method`       | `TUNAI`, `QRIS`, `DEBIT`                                                                |
| `shift_status`         | `UPCOMING`, `AKTIF`, `SELESAI`                                                          |
| `incoming_status`      | `MENUNGGU_VERIFIKASI`, `TERVERIFIKASI`, `DITOLAK`                                       |
| `outgoing_status`      | `MENUNGGU_PICKING`, `SIAP_DIKIRIM`, `TERKIRIM`                                          |
| `surat_status`         | `MENUNGGU_PICKING`, `MENUNGGU_APPROVAL`, `DISETUJUI`, `DITOLAK`, `SUDAH_DICETAK`, `TERKIRIM`, `TERTUNDA` |
| `approval_stage`       | `GUDANG_REVIEW`, `MANAGER_FINAL`                                                        |
| `approval_decision`    | `APPROVE`, `REJECT`                                                                     |
| `attendance_status`    | `HADIR`, `IZIN`, `CUTI`, `ALPHA`                                                        |
| `leave_type`           | `CUTI`, `IZIN`, `SAKIT`                                                                 |
| `leave_status`         | `MENUNGGU`, `DISETUJUI`, `DITOLAK`                                                      |
| `telegram_msg_status`  | `PENDING`, `SENT`, `FAILED`                                                             |
| `queue_status`         | `PENDING`, `PROCESSING`, `DONE`, `FAILED`                                               |
| `ai_role`              | `user`, `assistant`, `system`                                                           |
| `device_type`          | `POS_TERMINAL`, `PRINTER`, `SCANNER`, `TABLET`                                          |

## 6. Relasi Tingkat Tinggi (Prose)

**POS flow (Kasir)**:
`users` (kasir) → `shifts` (1:N saat kasir punya shift) → `orders` (1:N per shift) → `order_items` → `products` (FK snapshot) → `stocks` (update quantity). `orders` → `payments` (1:1 atau 1:N jika split). `held_drafts` adalah draft yang belum jadi `orders` (linked ke `users`).

**Inventory flow (Admin Gudang)**:
`suppliers` → `incoming_goods` (1:N) → `incoming_good_items` → `products`. Verifikasi PO update `stocks` + insert `stock_movements`. `outgoing_goods` → `outgoing_good_items` → `products` (kurangi stok). `outgoing_goods` → `surats` (1:1 saat buat SJ) → `surat_approvals` (2-stage). `surats.status` triggered oleh `surat_approvals` (final decision by manager).

**Stock consistency**:
Setiap perubahan `stocks.quantity` WAJIB insert 1 row `stock_movements` + (jika adjustment) 1 row `stock_adjustments`. Ini enforced di **application layer** (Drizzle transaction). Pattern: `db.transaction(async (tx) => { update stocks + insert movements + insert audit })`.

**Approval (Manager)**:
Manager dapat `surat_approvals` dengan `stage = 'MANAGER_FINAL'`. Approve → update `surats.status = 'DISETUJUI'`, kirim Telegram. Reject → update `surats.status = 'DITOLAK'` + `rejection_reason`. `leave_requests` Manager approve/reject langsung tanpa 2-stage.

**Auth flow**:
Login → verify `users.username + password_hash` → generate JWT (jti disimpan di `user_sessions.token_hash`) → set `users.last_login_at`. Logout → set `user_sessions.revoked_at`. PIN attempt untuk void/end-shift → `pin_attempts` log + rate limit (5x/hour, Asumsi).

**Telegram flow**:
Event trigger (stok kritis, SJ pending, dll) → insert ke `notification_queue` → pg-boss worker `telegram_sender` consume → call Telegram Bot API → insert `telegram_messages` log. Retry exponential backoff max 5x (USER_FLOW §7).

**AI flow** (Manager only):
Manager chat → `ai_conversations` (create/find) → `ai_messages` (user) → MVP: echo "AI belum tersedia" → `ai_messages` (assistant). Real LLM di Tahap 2.

**Reports flow**:
pg-boss cron `daily_report_generator` (00:30 WIB) → aggregate dari `orders`, `order_items`, `shifts` → insert `daily_reports` → trigger Telegram "laporan harian tersedia" ke Manager.

## 7. Index Penting (Ringkasan)

| Index                                          | Tujuan                                            |
|------------------------------------------------|---------------------------------------------------|
| `idx_orders_status_created (status, created_at DESC)` | Dashboard Manager "transaksi terbaru"      |
| `idx_orders_cashier_created (cashier_id, created_at DESC)` | Kasir Order history                  |
| `idx_orders_member_created (member_id, created_at DESC)` | Member activity                     |
| `idx_shifts_cashier_active (cashier_id) WHERE status='AKTIF'` | Enforce 1 shift aktif/kasir (partial) |
| `idx_stocks_product_outlet (product_id, outlet_id)` PK composite | Lookup cepat                   |
| `idx_movements_product_created (product_id, created_at DESC)` | Riwayat pergerakan stok         |
| `idx_surats_status_created (status, created_at DESC)` | Manager "menunggu persetujuan"  |
| `idx_audit_entity (entity_type, entity_id)`    | Audit trail lookup                                |
| `idx_nq_status_retry (status, next_retry_at) WHERE status IN ('PENDING','FAILED')` | Worker queue poll |
| `idx_products_active (id) WHERE deleted_at IS NULL AND is_active` | Katalog kasir                  |
| `idx_daily_reports_date (report_date DESC)`    | Trend laporan                                     |
| `idx_report_snapshots_key (snapshot_key)`      | Cache lookup                                      |

## 8. Catatan & Invariants

1. **`stocks.quantity` consistency**: Selalu gunakan `FOR UPDATE` row lock dalam transaksi saat update stok (lihat PRD §8 atomicity).
2. **`stock_movements` immutable**: Trigger DB reject UPDATE/DELETE (Asumsi: implement di migration).
3. **`audit_logs` immutable**: Sama seperti #2.
4. **Money columns**: Selalu `numeric(12,2)` atau `numeric(14,2)`. TIDAK BOLEH `float`/`double`.
5. **Timezone**: Semua `timestamptz` simpan UTC. Display konversi ke Asia/Jakarta di frontend.
6. **Soft delete**: Tabel master (`products`, `categories`, `suppliers`, `members`, `employees`) pakai `deleted_at`. Tabel transaksi (`orders`, `incoming_goods`, dll) hard delete jika diperlukan (tapi biasanya tidak, dipakai audit).
7. **Outlet id**: Selalu isi `outlet_id` meski MVP 1 outlet. Foreground-ready untuk multi-outlet (sesuai PRD §7 Non-Goals, struktur tetap disiapkan).
8. **Shift 1 active/cashier**: Partial unique index `(cashier_id) WHERE status='AKTIF'`. Kasir tidak boleh mulai shift baru tanpa end shift sebelumnya.
9. **Snapshot columns**: `order_items.price_sell`, `product_name_snapshot`, `sku_snapshot` — historical accuracy. Jangan lookup harga live.
10. **Surat jalan immutable after approve**: Setelah `surats.status = 'DISETUJUI'`, hanya boleh transition ke `SUDAH_DICETAK` → `TERKIRIM`. Revisi = buat SJ baru.
11. **PIN rate limit**: 5x attempt/hour/user, di-enforce di `pin_attempts` count (Asumsi threshold).
12. **AI history retention**: (Asumsi) retention 90 hari, cleanup via pg-boss cron.
13. **Notification retry max 5x**: Setelah 5x gagal, `notification_queue.status = 'FAILED'` dan `telegram_messages.status = 'FAILED'`. Alert ke Manager via internal log (bukan Telegram).

## 9. Migration Strategy

| Step | Perintah                                     | Tujuan                                  |
|------|----------------------------------------------|-----------------------------------------|
| 1    | Define schema di `src/lib/server/db/schema/` | TypeScript files per domain              |
| 2    | `drizzle-kit generate`                       | Generate SQL migration file             |
| 3    | Review SQL di `drizzle/` folder              | Sanity check                            |
| 4    | `drizzle-kit migrate`                        | Apply ke dev DB                         |
| 5    | `drizzle-kit migrate` (staging)              | Apply ke staging                        |
| 6    | `drizzle-kit migrate` (prod)                 | Apply ke prod dengan backup             |
| 7    | Seed: `bun run db:seed`                      | Initial categories, products sample, outlet |

> **Catatan**: Migration file di-commit ke git. Tidak ada auto-migrate di app start (explicit migrate via CLI).

## 10. Open Questions

1. **Multi-outlet scope**: PRD §7 Non-Goals sebut multi-outlet di luar MVP. Tapi kolom `outlet_id` sudah disiapkan. Kapan transisi ke multi-outlet? (Asumsi: Tahap 2)
2. **Stock reserved field**: `stocks.reserved` ada untuk draft order future. MVP belum pakai — perlu atau hapus?
3. **Payment split tender**: Apakah MVP support 1 order bayar dengan 2 metode (Tunai + QRIS)? `payments` table struktur support, tapi UI belum. (Asumsi: belum, 1 metode per order)
4. **Member tier auto-upgrade**: Tier statis di MVP (sesuai PRD §7). Logic auto-upgrade berdasarkan `total_spent` belum ada. (Asumsi: Tahap 2)
5. **Surat Jalan 2-stage approval necessity**: USER_FLOW §3.3 sebut ada 2-stage (gudang review internal + manager final). Apakah benar-benar 2 user action atau 1 (gudang langsung submit ke manager, manager final decide)? (Asumsi: 2-stage sesuai flow)
6. **AI real LLM**: Placeholder MVP. Provider (OpenAI, Anthropic, local) belum dipilih. (Asumsi: Tahap 2)
7. **Outlet jam operasional format**: `jsonb` cukup fleksibel. Apakah perlu tabel terpisah `outlet_hours` untuk query per-hari? (Asumsi: jsonb cukup untuk MVP)
8. **Printer driver integration**: `printers` table simpan config. Real printing (ESC/POS, USB, Bluetooth) butuh driver/service terpisah. (Asumsi: Tahap 2 atau gunakan library seperti `escpos` di backend)

---

**Akhir dokumen DATABASE_DESIGN.md**
