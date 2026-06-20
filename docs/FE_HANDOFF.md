# HEKAS POS — Frontend Handoff Documentation

**Version**: 2.0.0
**Tanggal**: 2026-06-21
**Status**: Backend stable, ready for FE integration
**Base URL (DEV)**: `http://localhost:3001/api`
**Base URL (PROD)**: TBD (VPS, Jun-Jul 2026)
**Swagger UI (DEV)**: http://localhost:3001/api/docs
**OpenAPI JSON**: http://localhost:3001/api/docs/json

---

## 1. Quick Start

### 1.1 Prerequisite
- Bun ≥ 1.3.14 (https://bun.sh)
- PostgreSQL 16 (via Docker: `docker run -d --name hekas-postgres -p 5432:5432 -e POSTGRES_USER=hekas -e POSTGRES_PASSWORD=hekas_dev_password_change_me -e POSTGRES_DB=hekas_pos postgres:16-alpine`)

### 1.2 Setup
```bash
# Clone repo
git clone https://github.com/jazlihamizan/HEKAS-POS.git
cd HEKAS-POS

# Backend already running by Muhammad Wafiq (BE Lead)
# Just verify: curl http://localhost:3001/api/health
```

### 1.3 CORS Config
Backend allows:
- `http://localhost:5173` (Vite dev)
- `http://localhost:4173` (Vite preview)
- Tambah origin lain di `.env`: `APP_CORS_ORIGINS=http://localhost:5173,http://localhost:3000`

---

## 2. Authentication

### 2.1 Login Flow

**Request:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "manager1",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "34eda592-f148-4ae0-83ba-364e8022899e",
      "username": "manager1",
      "fullName": "Bu Dewi",
      "role": "manager",
      "outletId": "d3d1143e-984f-4185-b182-50b5dd3a3c8c"
    },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
}
```

### 2.2 Token Usage

Setiap request (kecuali login, refresh, health, telegram webhook):
```http
Authorization: Bearer <accessToken>
```

**Token lifetime**:
- `accessToken`: 15 menit (900 detik)
- `refreshToken`: 30 hari (2592000 detik)
- Refresh via: `POST /api/auth/refresh` (TODO: belum ada, pakai login ulang)

### 2.3 Logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

### 2.4 Get Current User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

Returns user info tanpa password hash.

### 2.5 PIN Module

PIN terpisah dari login password. Digunakan untuk konfirmasi order, end shift, dll.

```http
POST /api/auth/pin
Authorization: Bearer <token>
Content-Type: application/json

{ "pin": "1234" }
```

Rate limit: 5 attempts / hour, locked jika exceed.

---

## 3. Default Credentials (DEV ONLY)

| Username | Password | Role | PIN | Outlet |
|----------|----------|------|-----|--------|
| `kasir1` | `password123` | kasir | 1234 | `d3d1143e-984f-4185-b182-50b5dd3a3c8c` |
| `gudang1` | `password123` | admin_gudang | 1234 | (same) |
| `manager1` | `password123` | manager | 1234 | (same) |

⚠️ **JANGAN pakai credentials ini di production**. Hanya untuk dev.

---

## 4. Roles & Permissions

| Role | Bisa |
|------|------|
| **kasir** | POS (orders, products view, shifts), Held drafts |
| **gudang** / **admin_gudang** | Inventory (incoming, outgoing, surat jalan), products view+edit |
| **manager** | Semua akses + Dashboard, Reports, HR, Settings, Audit |

---

## 5. Response Format — PENTING!

### 5.1 Format Bervariasi (TIDAK KONSISTEN)

| Endpoint Type | Response Shape | Contoh |
|---------------|----------------|--------|
| Most CRUD (paginated) | `{ ok: true, data: { items: [...], total: N, limit: N, offset: N } }` | `/api/products/` |
| List (direct array) | `{ ok: true, data: [...] }` | `/api/orders/`, `/api/suppliers/` |
| Detail / single item | `{ ok: true, data: {...} }` | `/api/orders/:id`, `/api/auth/me` |
| **HR endpoints** | `[...]` raw array (no wrapper!) | `/api/hr/employees`, `/api/hr/leave-requests` |
| **Dashboard** | `{...}` raw object (no wrapper!) | `/api/dashboard/manager`, `/api/dashboard/gudang` |
| **Telegram status** | `{ "linked": false }` (custom) | `/api/telegram/status` |
| **Excel download** | Binary file (use `responseType: 'blob'`) | `/api/reports/sales` |
| **PDF download** | Binary file | `/api/surat-jalan/:id/pdf` |
| Error | `{ ok: false, error: { code, message } }` | semua endpoint |

⚠️ **FE harus handle multiple shapes**. Jangan hardcode satu pattern.

### 5.2 Error Format

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "username is required",
    "details": { "field": "username" }
  }
}
```

Error codes:
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_ERROR` (500)

---

## 6. Critical Data Type Gotchas

### 6.1 Money Fields are STRINGS

Drizzle returns PostgreSQL `numeric` as **STRING**, not number:

```json
{
  "sellingPrice": "4000.00",  // ← string, bukan 4000
  "subtotal": "4000.00",
  "total": "5000.00",
  "paid": "5000.00",
  "change": "0.00"
}
```

**FE**: parse dengan `parseFloat()` atau pakai library decimal (decimal.js, dinero.js).

### 6.2 Dates are UTC ISO 8601

```json
{
  "createdAt": "2026-06-20T07:47:16.858Z",
  "completedAt": "2026-06-20T08:24:49.848Z"
}
```

Wajib di-parse ke local timezone (Asia/Jakarta = UTC+7).

### 6.3 IDs are UUIDs

```json
{
  "id": "d1ebc59f-3279-468e-b20a-3793a1724924",
  "productId": "54744b47-7a34-46ef-a0ea-004b8b90a08a"
}
```

### 6.4 Outlet Scoping

Setiap user terikat ke 1 outlet (`user.outletId`). Backend auto-filter berdasarkan JWT. **FE ga perlu kirim `outletId` di query param** — kecuali endpoint yang explicitly butuh (lihat section per-endpoint).

---

## 7. Pagination

```http
GET /api/products/?limit=50&offset=0
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "items": [...],
    "total": 20,
    "limit": 50,
    "offset": 0
}
```

Max limit: 200 (server-clamped).

---

## 8. Date Range Filters

```http
GET /api/reports/sales?from=2026-06-01&to=2026-06-30
```

Format: ISO date (`YYYY-MM-DD`) atau ISO datetime.

Available di: `/api/reports/sales`, `/api/reports/transactions`, `/api/reports/inventory`.

---

## 9. Complete Endpoint Reference (93 ops, 77 paths)

### 9.1 Health & Version (2)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check (DB status, uptime) |
| GET | `/api/version` | API version + build info |

### 9.2 Auth (3 + 1 PIN)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Login (returns user + tokens) |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Revoke session |
| POST | `/api/auth/pin` | Verify PIN |

### 9.3 Products (10)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/products/` | List products (paginated, filterable) |
| POST | `/api/products/` | Create product |
| GET | `/api/products/barcode/:barcode` | Lookup by barcode |
| GET | `/api/products/:id` | Get detail (includes `images[]`) |
| PATCH | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Soft delete |
| GET | `/api/products/:id/stock-movements` | Stock history |
| POST | `/api/products/:id/image` | Upload image (multipart) |
| DELETE | `/api/products/:id/image/:imageId` | Delete image |
| POST | `/api/products/:id/image/:imageId/primary` | Set as primary |
| POST | `/api/products/:id/restock` | Restock single |
| POST | `/api/products/restock-bulk` | Restock bulk |

**Filter params**: `?categoryId=&status=&search=`

**Product shape**:
```ts
{
  id: string;
  sku: string;
  barcode: string;
  name: string;
  description: string | null;
  categoryId: string;
  supplierId: string;
  outletId: string;
  purchasePrice: string;  // ← STRING
  sellingPrice: string;   // ← STRING
  stockMin: number;
  stockMax: number;
  unit: string;           // "pcs" | "kg" | "liter" | etc
  status: 'aktif' | 'nonaktif';
  imageUrl: string | null;
  metadata: object | null;
  createdAt: string;      // ISO UTC
  updatedAt: string;
  images?: Array<{        // only on detail
    id: string;
    imageUrl: string;
    isPrimary: boolean;   // ← NEW (Phase 7.1)
    sortOrder: number;
  }>;
}
```

### 9.4 Stock (4)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/stocks/product/:productId` | Current stock |
| GET | `/api/stocks/product/:productId/movements` | Movement history |
| GET | `/api/stocks/movements` | All movements (paginated) |
| GET | `/api/stocks/low-stock` | Low stock list |

### 9.5 Orders (5)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/orders/draft` | Create draft order |
| POST | `/api/orders/complete` | Complete order (atomic) |
| POST | `/api/orders/:id/void` | Void order (manager only) |
| GET | `/api/orders/:id` | Detail + items[] |
| GET | `/api/orders/` | List (filterable) |

**Order shape**:
```ts
{
  id: string;
  orderNumber: string;    // "ORD-XXX-YYYY"
  outletId: string;
  shiftId: string;
  cashierId: string;
  memberId: string | null;
  status: 'pending' | 'paid' | 'voided' | 'refunded' | 'partial_refunded';
  subtotal: string;       // ← STRING
  discount: string;
  tax: string;
  total: string;
  paid: string;
  change: string;
  notes: string | null;
  idempotencyKey: string;
  createdAt: string;
  completedAt: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  items?: OrderItem[];    // only on detail
}

interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  discount: string;
  notes: string | null;
}
```

**Complete order payload**:
```json
{
  "items": [
    { "productId": "...", "quantity": 2, "unitPrice": "4000.00" }
  ],
  "payments": [
    { "method": "TUNAI", "amount": "10000.00" }
  ],
  "discount": "0",
  "notes": "Pelanggan VIP",
  "idempotencyKey": "client-generated-uuid"
}
```

### 9.6 Shifts (5)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/shifts/start` | Start shift (cashier) |
| POST | `/api/shifts/:id/end` | End shift (with cash count) |
| GET | `/api/shifts/current` | Get current active shift |
| GET | `/api/shifts/:id` | Detail |
| GET | `/api/shifts/` | List |

### 9.7 Held Drafts (4)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/held-drafts/` | Park unpaid order |
| GET | `/api/held-drafts/` | List drafts |
| GET | `/api/held-drafts/:id` | Get draft |
| DELETE | `/api/held-drafts/:id` | Discard |

### 9.8 Suppliers (5)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/suppliers/` | List |
| POST | `/api/suppliers/` | Create |
| GET | `/api/suppliers/:id` | Detail |
| PATCH | `/api/suppliers/:id` | Update |
| DELETE | `/api/suppliers/:id` | Delete |

### 9.9 Inventory (5)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/inventory/summary` | Total products + value |
| POST | `/api/inventory/restock` | Restock (single) |
| POST | `/api/inventory/restock-bulk` | Restock (bulk) |
| POST | `/api/inventory/adjust` | Stock adjustment (admin) |
| GET | `/api/inventory/low-stock` | Low stock list |

### 9.10 Product Images (4)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/products/:id/images/` | List images |
| POST | `/api/products/:id/images/` | Upload image |
| DELETE | `/api/products/:id/images/:imageId` | Delete |
| PUT | `/api/products/:id/images/:imageId/primary` | Set primary |

### 9.11 Incoming Goods (5)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/incoming-goods/` | List PO |
| POST | `/api/incoming-goods/` | Create PO (gudang) |
| GET | `/api/incoming-goods/:id` | Detail |
| POST | `/api/incoming-goods/:id/verify` | Manager verify |
| POST | `/api/incoming-goods/:id/reject` | Manager reject |

### 9.12 Outgoing Goods (6)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/outgoing-goods/?outletId=...` | List |
| POST | `/api/outgoing-goods/` | Create |
| GET | `/api/outgoing-goods/:id` | Detail |
| POST | `/api/outgoing-goods/:id/pick` | Pick items |
| POST | `/api/outgoing-goods/:id/mark-sent` | Mark sent |
| POST | `/api/outgoing-goods/:id/cancel` | Cancel |

⚠️ **Requires `outletId` query param** (different from JWT auto-scope).

### 9.13 Surat Jalan (7)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/surat-jalan/` | List |
| POST | `/api/surat-jalan/` | Create |
| GET | `/api/surat-jalan/:id` | Detail |
| POST | `/api/surat-jalan/:id/review-gudang` | Gudang review |
| POST | `/api/surat-jalan/:id/approve` | Manager approve |
| POST | `/api/surat-jalan/:id/reject` | Reject |
| POST | `/api/surat-jalan/:id/mark-sent` | Mark sent |
| GET | `/api/surat-jalan/:id/pdf` | **Download PDF** (binary) |

### 9.14 Reports (3)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/reports/sales` | **Excel download** (binary) |
| GET | `/api/reports/inventory` | Inventory report |
| GET | `/api/reports/transactions` | Transactions report |

⚠️ **Returns Excel file** — use `responseType: 'blob'` di FE.

### 9.15 Dashboard (2)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/dashboard/manager` | Manager KPIs |
| GET | `/api/dashboard/gudang` | Gudang KPIs |

⚠️ **Returns raw object** (no `ok/data` wrapper).

### 9.16 HR (13)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/hr/employees` | List employees |
| POST | `/api/hr/employees` | Create |
| GET | `/api/hr/employees/:id` | Detail |
| PATCH | `/api/hr/employees/:id` | Update |
| GET | `/api/hr/attendance` | Attendance list |
| GET | `/api/hr/attendance/today` | Today's attendance |
| GET | `/api/hr/attendance/today-summary` | Today's summary |
| POST | `/api/hr/attendance/clock-in` | Clock in |
| POST | `/api/hr/attendance/clock-out` | Clock out |
| GET | `/api/hr/leave-requests` | Leave requests |
| POST | `/api/hr/leave-requests` | Submit leave |
| PATCH | `/api/hr/leave-requests/:id/approve` | Approve (manager) |
| PATCH | `/api/hr/leave-requests/:id/reject` | Reject (manager) |

⚠️ **Returns raw arrays** (no `ok/data` wrapper). Example: `[{...}, {...}]` directly.

### 9.17 Telegram (5 + 1 webhook)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/telegram/link` | Generate link code |
| DELETE | `/api/telegram/link` | Unlink |
| GET | `/api/telegram/status` | Link status (`{"linked": false}`) |
| GET | `/api/telegram/messages` | Message history |
| GET | `/api/telegram/queue/stats` | Queue stats |
| GET | `/api/telegram/queue` | Queue list |
| POST | `/api/telegram/webhook/` | Webhook (for bot updates) |

---

## 10. Telegram Bot Integration

1. Manager generates link code di FE
2. Manager buka bot Telegram (e.g., `@HEKAS_POS_BOT`)
3. Kirim `/link <code>`
4. Bot verify code, simpan `chatId` ke DB
5. Manager sekarang terima notifications (daily report, low stock alerts)

**Link flow FE**:
```typescript
// Step 1: Generate code
const res = await fetch('/api/telegram/link', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
const { code, expiresAt } = res.data;

// Step 2: Show QR / code to user, instruct them to:
// "Buka Telegram, kirim /link <code> ke @HEKAS_POS_BOT"

// Step 3: Poll status every 3s
const status = await fetch('/api/telegram/status', {
  headers: { Authorization: `Bearer ${token}` }
});
// { linked: true/false }
```

---

## 11. Shared Types Package

Backend publishes types di `packages/shared/`. FE bisa import:

```typescript
// In FE package.json
"dependencies": {
  "@hekas/shared": "file:../packages/shared"
}
```

```typescript
import {
  Role,
  OrderStatus,
  ShiftStatus,
  PaymentMethod,
  Product,
  Order,
  OrderItem,
  Shift,
  HeldDraft,
  Employee,
  Attendance,
  LeaveRequest,
  TelegramLink,
  ApiResponse,
  PaginatedResponse,
} from '@hekas/shared';
```

⚠️ **Note**: package belum fully populated. Backend types masih di `apps/api/src/types/`. **Untuk sekarang, FE define types manual based on shapes di section 9.**

---

## 12. Example Flows

### 12.1 Login → List Products → Create Order → Complete Order

```typescript
// 1. Login
const login = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'manager1', password: 'password123' })
});
const { data: { accessToken, user } } = await login.json();
const headers = { Authorization: `Bearer ${accessToken}` };

// 2. List products
const productsRes = await fetch('/api/products/?limit=20', { headers });
const { data: { items } } = await productsRes.json();

// 3. Create order (draft)
const product = items[0];
const orderRes = await fetch('/api/orders/draft', {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ productId: product.id, quantity: 2, unitPrice: product.sellingPrice }]
  })
});

// 4. Complete order
const { data: draft } = await orderRes.json();
const completeRes = await fetch('/api/orders/complete', {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: draft.id,
    payments: [{ method: 'TUNAI', amount: '10000.00' }],
    idempotencyKey: crypto.randomUUID()
  })
});
```

### 12.2 Upload Product Image

```typescript
const form = new FormData();
form.append('file', imageFile);
form.append('isPrimary', 'true');
form.append('sortOrder', '0');

const res = await fetch(`/api/products/${productId}/image`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },  // NO Content-Type, browser sets multipart
  body: form
});
```

### 12.3 Download Sales Report (Excel)

```typescript
const res = await fetch(`/api/reports/sales?from=2026-06-01&to=2026-06-30`, {
  headers: { Authorization: `Bearer ${token}` }
});
const blob = await res.blob();
const url = URL.createObjectURL(blob);
// Trigger download
const a = document.createElement('a');
a.href = url;
a.download = `sales-${from}-${to}.xlsx`;
a.click();
```

---

## 13. CORS

Backend allow:
- `http://localhost:5173` (Vite)
- `http://localhost:4173` (Vite preview)

Tambah di `.env`: `APP_CORS_ORIGINS=http://localhost:5173,http://localhost:3000`

---

## 14. Tech Stack Rekomendasi untuk FE

Tidak ada constraint keras dari BE. Tapi yang konsisten dengan stack BE:

| Layer | Rekomendasi |
|-------|-------------|
| Framework | React + Vite (atau Svelte/SvelteKit) |
| HTTP Client | `fetch` native / `axios` / `ky` |
| State | Zustand / TanStack Query |
| Form | React Hook Form + Zod |
| UI | shadcn/ui / TailwindCSS |
| Money parsing | `decimal.js` atau `dinero.js` |
| Date parsing | `date-fns` atau `dayjs` |

⚠️ **WAJIB**: Handle multiple response shapes (lihat section 5.1). Pakai TypeScript discriminator atau runtime check.

---

## 15. Testing dengan BE yang Running

```bash
# Verify BE up
curl http://localhost:3001/api/health

# Login
TOKEN=$(curl -sS -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"manager1","password":"password123"}' | \
  grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# Fetch products
curl -sS http://localhost:3001/api/products/ \
  -H "Authorization: Bearer $TOKEN" | head -c 500
```

---

## 16. Known Issues / TODO

1. **Refresh token endpoint** belum ada (`POST /api/auth/refresh`). Untuk sekarang, kalau access token expired, login ulang.
2. **Categories & Members** belum ada CRUD endpoint. Backend cuma simpan `categoryId`, `memberId` sebagai FK reference. Untuk UI, mungkin perlu minta BE tambah atau hardcode dulu.
3. **Inconsistent response wrappers** — sudah di section 5.1. FE harus handle.
4. **Excel download** returns binary, FE harus handle blob download.

---

## 17. Contact

- **BE Lead**: Muhammad Wafiq (project owner) — kalau ada bug API atau butuh endpoint baru
- **Partner**: Jazli (original arch, collaborator)
- **Swagger UI**: http://localhost:3001/api/docs (auto-generated, always up-to-date)

---

**Backend siap diintegrasikan. Happy coding!** 🚀