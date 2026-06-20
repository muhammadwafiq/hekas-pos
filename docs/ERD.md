# ERD — HEKAS POS

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Visualisasi relasi database
**Dasar**: `DATABASE_DESIGN.md` v1.0.0
**Format**: Mermaid `erDiagram`

---

## 1. Cara Baca

- Diagram menggunakan notasi Mermaid `erDiagram`.
- Relasi ditulis `EntityA ||--o{ EntityB : "label"` (Crow's foot).
- Kardinalitas:
  - `||` = exactly one
  - `o|` = zero or one
  - `}o` = zero or many
  - `}|` = one or many
- Karena Mermaid `erDiagram` punya keterbacaan rendah untuk >15 entitas, diagram dipecah per domain. Lihat section 3 untuk **Diagram Gabungan** (ringkasan lintas domain).

## 2. Diagram per Domain

### 2.1 Auth & Master

```mermaid
erDiagram
    users ||--o{ user_sessions : "has"
    users ||--o{ pin_attempts : "tries"
    users ||--o| employees : "is"
    users ||--o{ telegram_links : "links"
    users ||--o{ devices : "owns"

    categories ||--o{ products : "groups"
    products ||--o{ product_images : "has"
    products ||--o{ stocks : "tracked_in"
    products ||--o{ stock_movements : "moved"
    products ||--o{ order_items : "sold_in"
    products ||--o{ incoming_good_items : "received_in"
    products ||--o{ outgoing_good_items : "shipped_in"
    products ||--o{ surat_items : "listed_in"
    products ||--o{ daily_reports : "best_seller"

    suppliers ||--o{ incoming_goods : "supplies"
    members ||--o{ orders : "places"
    outlet_settings ||--o{ stocks : "stores"
    outlet_settings ||--o{ shifts : "operates"
    outlet_settings ||--o{ outgoing_goods : "originates"
    outlet_settings ||--o{ incoming_goods : "receives_at"
    outlet_settings ||--o{ surats : "ships_from"
    outlet_settings ||--o{ printers : "owns"
```

### 2.2 POS & Shift

```mermaid
erDiagram
    users ||--o{ shifts : "works"
    users ||--o{ orders : "creates"
    users ||--o{ held_drafts : "saves"
    users ||--o{ shift_handovers : "from_or_to"

    shifts ||--o{ orders : "groups"
    shifts ||--o{ shift_handovers : "ends_with"
    shifts }o--|| shift_handovers : "from_cashier"
    shifts }o--|| shift_handovers : "to_cashier"

    orders ||--|{ order_items : "contains"
    orders ||--o{ payments : "paid_by"
    orders }o--o| members : "attached"
    orders }o--|| shifts : "during"

    order_items }o--|| products : "references"
```

### 2.3 Inventory Operations (PO, Outgoing, SJ)

```mermaid
erDiagram
    suppliers ||--o{ incoming_goods : "supplies"
    users ||--o{ incoming_goods : "creates"
    users ||--o{ incoming_goods : "verifies"
    outlet_settings ||--o{ incoming_goods : "receives"

    incoming_goods ||--|{ incoming_good_items : "contains"
    incoming_good_items }o--|| products : "is"

    users ||--o{ outgoing_goods : "creates"
    users ||--o{ outgoing_goods : "picks"
    outlet_settings ||--o{ outgoing_goods : "from"

    outgoing_goods ||--|{ outgoing_good_items : "contains"
    outgoing_good_items }o--|| products : "is"
    outgoing_goods ||--|| surats : "documents"

    users ||--o{ surats : "creates"
    users ||--o{ surats : "approves"
    users ||--o{ surats : "rejects"
    users ||--o{ surats : "prints"
    outlet_settings ||--o{ surats : "from"

    surats ||--|{ surat_items : "contains"
    surat_items }o--|| products : "is"
    surats ||--o{ surat_approvals : "decided_in"
```

### 2.4 Stock Ledger

```mermaid
erDiagram
    products ||--o{ stock_movements : "moves"
    outlet_settings ||--o{ stock_movements : "at"
    users ||--o{ stock_movements : "triggered_by"
    products ||--o{ stock_adjustments : "adjusted"
    outlet_settings ||--o{ stock_adjustments : "at"
    users ||--o{ stock_adjustments : "requested"
    users ||--o{ stock_adjustments : "approved"
    products ||--|| stocks : "current"
    outlet_settings ||--|| stocks : "current"
```

### 2.5 HR & Karyawan

```mermaid
erDiagram
    employees ||--|| users : "linked_to"
    employees ||--o{ attendances : "has"
    employees ||--o{ leave_requests : "submits"
    employees ||--o{ employee_performances : "rated"
    users ||--o{ leave_requests : "decides"
```

### 2.6 Telegram & Notification

```mermaid
erDiagram
    users ||--o{ telegram_links : "links"
    telegram_messages }o--o{ notification_queue : "mirrors"
```

### 2.7 AI & Reports

```mermaid
erDiagram
    users ||--o{ ai_conversations : "chats"
    ai_conversations ||--|{ ai_messages : "contains"
    products ||--o{ daily_reports : "best_seller"
    outlet_settings ||--o{ daily_reports : "for"
    outlet_settings ||--o{ report_snapshots : "for"
```

### 2.8 Audit & System

```mermaid
erDiagram
    users ||--o{ audit_logs : "actor"
    users ||--o{ system_settings : "updates"
    outlet_settings ||--o{ printers : "has"
    users ||--o{ devices : "owns"
```

## 3. Diagram Gabungan (Ringkasan Lintas Domain)

Diagram ini menampilkan entity utama lintas domain. **Catatan**: Tabel sangat besar, render mungkin lambat di GitHub. Gunakan section 2 untuk detail per domain.

```mermaid
erDiagram
    users ||--o{ shifts : ""
    users ||--o{ orders : ""
    users ||--o{ held_drafts : ""
    users ||--o{ pin_attempts : ""
    users ||--o{ audit_logs : ""
    users ||--o{ telegram_links : ""
    users ||--o{ ai_conversations : ""
    users ||--o{ devices : ""
    users ||--o{ employees : ""

    shifts ||--o{ orders : ""
    shifts ||--o{ shift_handovers : ""

    orders ||--|{ order_items : ""
    orders ||--o{ payments : ""
    orders }o--o| members : ""

    order_items }o--|| products : ""
    products ||--o{ stocks : ""
    products ||--o{ stock_movements : ""
    products ||--o{ stock_adjustments : ""
    products ||--|| category_id : ""

    categories ||--o{ products : ""

    incoming_goods ||--|{ incoming_good_items : ""
    incoming_good_items }o--|| products : ""
    suppliers ||--o{ incoming_goods : ""

    outgoing_goods ||--|{ outgoing_good_items : ""
    outgoing_goods ||--|| surats : ""
    outgoing_good_items }o--|| products : ""

    surats ||--|{ surat_items : ""
    surats ||--o{ surat_approvals : ""
    surat_items }o--|| products : ""

    employees ||--o{ attendances : ""
    employees ||--o{ leave_requests : ""
    employees ||--o{ employee_performances : ""

    ai_conversations ||--|{ ai_messages : ""

    outlet_settings ||--o{ shifts : ""
    outlet_settings ||--o{ stocks : ""
    outlet_settings ||--o{ incoming_goods : ""
    outlet_settings ||--o{ outgoing_goods : ""
    outlet_settings ||--o{ surats : ""
    outlet_settings ||--o{ printers : ""
    outlet_settings ||--o{ daily_reports : ""
```

## 4. Relasi Kunci (Prose)

### 4.1 POS Lifecycle
```
users (kasir) ──creates──> shifts
shifts ──groups──> orders
orders ──contains──> order_items ──references──> products
orders ──paid_by──> payments
orders ──attached_to──> members (optional)
```

### 4.2 Inventory Lifecycle
```
suppliers ──supplies──> incoming_goods ──contains──> incoming_good_items ──is──> products
   (verifikasi) ──updates──> stocks + stock_movements

outgoing_goods ──contains──> outgoing_good_items ──is──> products
outgoing_goods ──documents──> surats ──contains──> surat_items
surats ──decided_in──> surat_approvals (2-stage)
```

### 4.3 Stock Atomicity
```
Setiap perubahan `stocks.quantity` WAJIB:
  1. `stocks` UPDATE (dengan FOR UPDATE row lock)
  2. `stock_movements` INSERT (immutable ledger)
  3. `audit_logs` INSERT (jika adjustment > threshold, Asumsi)
Semuanya dalam 1 DB transaction (Drizzle `db.transaction`).
```

### 4.4 Auth & Session
```
users ──has──> user_sessions (1:N, JWT token tracking)
users ──tries──> pin_attempts (1:N, audit + rate limit)
```

### 4.5 Telegram Flow
```
Event trigger (SJ pending, stok kritis, dll)
  ──insert──> notification_queue
  ──worker consume──> telegram_sender (pg-boss)
  ──call API──> Telegram Bot
  ──log──> telegram_messages
  ──update──> notification_queue.status = 'DONE'
```

## 5. Catatan Visualisasi

1. **Mermaid render**: Pastikan viewer Mermaid mendukung `erDiagram`. GitHub, GitLab, Notion, VS Code Mermaid extension support.
2. **Color coding (optional)**: Jika ingin color per domain, gunakan `classDef` + `class` directive (tidak dipakai di sini agar diagram tetap simple).
3. **Tabel besar**: Untuk >20 tabel, pertimbangkan generate dari Drizzle schema menggunakan tool seperti `drizzle-erd` atau `mermaid-er-from-sql`. (Asumsi: tidak dipakai di MVP, manual lebih terkontrol)
4. **Sync dengan DATABASE_DESIGN.md**: ERD ini **mewakilkan** relasi dari `DATABASE_DESIGN.md`. Jika ada penambahan tabel, update kedua file.

## 6. Cross-Reference dengan DATABASE_DESIGN.md

| Domain (ERD)              | Section DATABASE_DESIGN.md | Tabel                                                                 |
|---------------------------|----------------------------|------------------------------------------------------------------------|
| Auth & Master             | §4.1, §4.2                 | users, user_sessions, pin_attempts, categories, products, product_images, suppliers, members |
| POS & Shift               | §4.4, §4.5                 | orders, order_items, payments, held_drafts, shifts, shift_handovers    |
| Inventory Operations      | §4.6, §4.7, §4.8           | incoming_goods, incoming_good_items, outgoing_goods, outgoing_good_items, surats, surat_items, surat_approvals |
| Stock Ledger              | §4.3                       | stocks, stock_movements, stock_adjustments                             |
| HR & Karyawan             | §4.9                       | employees, attendances, leave_requests, employee_performances          |
| Telegram & Notification   | §4.11                      | telegram_links, telegram_messages, notification_queue                  |
| AI & Reports              | §4.10, §4.12               | daily_reports, report_snapshots, ai_conversations, ai_messages         |
| Audit & System            | §4.13                      | audit_logs, outlet_settings, system_settings, devices, printers       |

---

**Akhir dokumen ERD.md**
