# FRONTEND ARCHITECTURE — HEKAS POS

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Arsitektur frontend SvelteKit 5 + TypeScript + Tailwind
**Dasar**: `PRD.md` v1.0.0 + `FEATURE_MATRIX.md` v1.0.0 + `USER_FLOW.md` v1.0.0 + `API_SPEC.md` v1.0.0
**Project root**: `/home/jazli/hekas-pos/hekas-app/`
**Runtime**: Bun

---

## 1. Ringkasan

Frontend HEKAS POS menggunakan **SvelteKit 5** (runes mode) + **TypeScript** + **Tailwind CSS 4**. Dirancang untuk 3 role terpisah (Kasir, Admin Gudang, Manager) dengan **SATU halaman login** yang auto-detect role (lihat memory HEKAS POS + PRD §3).

### 1.1 Prinsip Utama

1. **Role-based layout terpisah** — tidak ada cross-role UI override.
2. **Server-first data** — gunakan SvelteKit `load` function untuk data fetching, hindari client-only fetch kecuali untuk aksi interaktif.
3. **Type safety end-to-end** — Drizzle types → API contracts → SvelteKit `load` → component props. Zero `any` di production code.
4. **Offline-tolerant UX** (Asumsi) — untuk POS kasir, tampilkan state terakhir jika network error (lihat PRD §8 acceptance criteria).
5. **Design tokens strict** — warna/typography dari `default_shadcn_theme.css` + PRD §5. Tidak ada hardcode.

## 2. Tech Stack

| Layer              | Pilihan                                                  |
|--------------------|----------------------------------------------------------|
| Framework          | SvelteKit 5 (runes: `$state`, `$derived`, `$effect`)     |
| Bahasa             | TypeScript 6+ (strict mode)                              |
| Styling            | Tailwind CSS 4 + design tokens                           |
| Komponen library   | shadcn-svelte (port dari shadcn-ui React)               |
| Icon               | lucide-svelte                                            |
| Chart              | LayerChart (Svelte port dari Recharts)                   |
| Form               | sveltekit-superforms + zod                              |
| Date handling      | date-fns                                                 |
| HTTP client        | Native `fetch` + SvelteKit `load`                        |
| State management   | Svelte stores + SvelteKit context                        |
| PWA (optional)     | @vite-pwa/sveltekit                                       |
| Testing            | Vitest + @testing-library/svelte + Playwright            |
| Lint/Format        | ESLint + Prettier                                        |
| Package manager    | Bun                                                      |

## 3. Struktur Folder

```
hekas-app/
├── src/
│   ├── app.css                          # Global styles + design tokens
│   ├── app.d.ts                         # TypeScript ambient declarations
│   ├── app.html                         # HTML template (SvelteKit)
│   ├── lib/
│   │   ├── assets/                      # Static assets (favicon, logo)
│   │   ├── auth/
│   │   │   ├── roles.ts                 # Role enum + type guards
│   │   │   ├── session.ts               # Session management (client + server)
│   │   │   ├── guard.ts                 # Route guard (role-based redirect)
│   │   │   └── pin.ts                   # PIN verification helpers
│   │   ├── api/
│   │   │   ├── client.ts                # Base fetch wrapper (auth, error handling)
│   │   │   ├── auth.ts                  # Auth API methods
│   │   │   ├── products.ts              # Product API methods
│   │   │   ├── orders.ts                # Order/POS API methods
│   │   │   ├── shifts.ts                # Shift API methods
│   │   │   ├── inventory.ts             # Inventory/PO API methods
│   │   │   ├── surat-jalan.ts           # SJ API methods
│   │   │   ├── employees.ts             # Employee/HR API methods
│   │   │   ├── reports.ts               # Reports API methods
│   │   │   ├── dashboard.ts             # Dashboard aggregation
│   │   │   ├── ai.ts                    # AI Assistant API
│   │   │   ├── telegram.ts              # Telegram link/management
│   │   │   └── settings.ts              # Settings API
│   │   ├── components/
│   │   │   ├── ui/                      # shadcn-svelte components (Button, Card, dll)
│   │   │   │   ├── button.svelte
│   │   │   │   ├── card.svelte
│   │   │   │   ├── input.svelte
│   │   │   │   ├── dialog.svelte
│   │   │   │   ├── table.svelte
│   │   │   │   ├── badge.svelte
│   │   │   │   ├── select.svelte
│   │   │   │   └── ... (40+ components)
│   │   │   ├── shared/                  # Cross-role shared components
│   │   │   │   ├── Sidebar.svelte
│   │   │   │   ├── TopBar.svelte
│   │   │   │   ├── Breadcrumb.svelte
│   │   │   │   ├── EmptyState.svelte
│   │   │   │   ├── ErrorBoundary.svelte
│   │   │   │   ├── LoadingSpinner.svelte
│   │   │   │   ├── ConfirmDialog.svelte
│   │   │   │   ├── PinDialog.svelte
│   │   │   │   └── Pagination.svelte
│   │   │   ├── kasir/                   # Kasir-specific
│   │   │   │   ├── POS/
│   │   │   │   │   ├── ProductGrid.svelte
│   │   │   │   │   ├── CategoryTabs.svelte
│   │   │   │   │   ├── ProductCard.svelte
│   │   │   │   │   ├── BarcodeScanner.svelte
│   │   │   │   │   ├── SearchBar.svelte
│   │   │   │   │   ├── Cart.svelte
│   │   │   │   │   ├── CartItem.svelte
│   │   │   │   │   ├── OrderSummary.svelte
│   │   │   │   │   ├── PaymentModal.svelte
│   │   │   │   │   ├── MemberSearch.svelte
│   │   │   │   │   ├── DiscountModal.svelte
│   │   │   │   │   ├── Numpad.svelte
│   │   │   │   │   └── HeldDrafts.svelte
│   │   │   │   ├── Order/
│   │   │   │   │   ├── OrderList.svelte
│   │   │   │   │   ├── OrderDetail.svelte
│   │   │   │   │   ├── OrderSearch.svelte
│   │   │   │   │   └── VoidConfirmDialog.svelte
│   │   │   │   ├── Produk/
│   │   │   │   │   └── ProductCatalog.svelte
│   │   │   │   ├── Pelanggan/
│   │   │   │   │   ├── MemberList.svelte
│   │   │   │   │   ├── MemberDetail.svelte
│   │   │   │   │   └── MemberTierBadge.svelte
│   │   │   │   ├── Shift/
│   │   │   │   │   ├── ShiftList.svelte
│   │   │   │   │   ├── ShiftDetail.svelte
│   │   │   │   │   ├── StartShiftDialog.svelte
│   │   │   │   │   └── EndShiftDialog.svelte
│   │   │   │   ├── Laporan/
│   │   │   │   │   ├── ShiftSummary.svelte
│   │   │   │   │   ├── PaymentMethodChart.svelte
│   │   │   │   │   ├── BestSellers.svelte
│   │   │   │   │   └── ExportButton.svelte
│   │   │   │   └── Setting/
│   │   │   │       ├── ProfileSection.svelte
│   │   │   │       ├── PinChangeDialog.svelte
│   │   │   │       ├── PrinterConfig.svelte
│   │   │   │       └── ConnectedDevices.svelte
│   │   │   ├── gudang/                  # Gudang-specific
│   │   │   │   ├── Beranda/
│   │   │   │   │   ├── DashboardSummary.svelte
│   │   │   │   │   ├── TodayTasks.svelte
│   │   │   │   │   ├── LowStockAlert.svelte
│   │   │   │   │   └── RecentActivity.svelte
│   │   │   │   ├── Inventaris/
│   │   │   │   │   ├── ProductTable.svelte
│   │   │   │   │   ├── StockMovementLog.svelte
│   │   │   │   │   ├── RestockDialog.svelte
│   │   │   │   │   ├── BulkRestockDialog.svelte
│   │   │   │   │   ├── ProductForm.svelte
│   │   │   │   │   └── ExportStockReport.svelte
│   │   │   │   ├── BarangMasuk/
│   │   │   │   │   ├── POList.svelte
│   │   │   │   │   ├── PODetail.svelte
│   │   │   │   │   ├── POInputForm.svelte
│   │   │   │   │   └── POVerification.svelte
│   │   │   │   ├── BarangKeluar/
│   │   │   │   │   ├── OutgoingList.svelte
│   │   │   │   │   ├── OutgoingDetail.svelte
│   │   │   │   │   ├── PickingProcess.svelte
│   │   │   │   │   └── PendingReason.svelte
│   │   │   │   └── SuratJalan/
│   │   │   │       ├── SJList.svelte
│   │   │   │       ├── SJDetail.svelte
│   │   │   │       ├── SJReview.svelte
│   │   │   │       └── PrintSJButton.svelte
│   │   │   └── manager/                 # Manager-specific
│   │   │       ├── Beranda/
│   │   │       │   ├── KpiStrip.svelte
│   │   │       │   ├── RevenueChart.svelte
│   │   │       │   ├── BestSellersCard.svelte
│   │   │       │   ├── InventorySummary.svelte
│   │   │       │   ├── FinanceSummary.svelte
│   │   │       │   ├── ApprovalQueue.svelte
│   │   │       │   └── NotificationFeed.svelte
│   │   │       ├── Penjualan/
│   │   │       │   └── SalesAnalytics.svelte
│   │   │       ├── Inventaris/
│   │   │       │   └── InventoryAnalytics.svelte
│   │   │       ├── Keuangan/
│   │   │       │   └── FinanceAnalytics.svelte
│   │   │       ├── Karyawan/
│   │   │       │   ├── EmployeeList.svelte
│   │   │       │   ├── AttendanceSummary.svelte
│   │   │       │   ├── LeaveRequests.svelte
│   │   │       │   └── PerformanceChart.svelte
│   │   │       ├── Laporan/
│   │   │       │   └── BusinessAnalytics.svelte
│   │   │       ├── SuratJalan/
│   │   │       │   └── SJManagement.svelte
│   │   │       ├── AI/
│   │   │       │   ├── AIChat.svelte
│   │   │       │   ├── AIActivity.svelte
│   │   │       │   ├── AIInsights.svelte
│   │   │       │   └── AIControlCenter.svelte
│   │   │       └── Pengaturan/
│   │   │           ├── OutletProfile.svelte
│   │   │           ├── OperationalHours.svelte
│   │   │           ├── AccessRights.svelte
│   │   │           ├── ServerDatabase.svelte
│   │   │           └── SystemSummary.svelte
│   │   ├── stores/
│   │   │   ├── auth.svelte.ts            # Auth state (current user, token)
│   │   │   ├── cart.svelte.ts            # Kasir cart state (rune-based)
│   │   │   ├── notifications.svelte.ts   # In-app notifications
│   │   │   └── ui.svelte.ts              # UI state (sidebar, modal, theme)
│   │   ├── utils/
│   │   │   ├── format.ts                 # Currency, date, number formatting
│   │   │   ├── validation.ts             # Common zod schemas
│   │   │   ├── id.ts                     # ID generator (uuid)
│   │   │   ├── debounce.ts               # Debounce helper
│   │   │   └── download.ts               # File download helper
│   │   └── types/
│   │       ├── api.ts                    # API response types
│   │       ├── domain.ts                 # Domain types (Order, Product, dll)
│   │       └── ui.ts                     # UI-only types
│   └── routes/
│       ├── +layout.svelte                # Root layout (minimal)
│       ├── +layout.ts                    # Root loader (auth check, theme)
│       ├── +page.svelte                  # Landing → redirect by role
│       ├── login/
│       │   └── +page.svelte              # SATU login page (auto-detect role)
│       ├── (kasir)/                      # Group: Kasir routes
│       │   ├── +layout.svelte            # Kasir layout (sidebar POS)
│       │   ├── +layout.ts                # Kasir loader (RBAC: kasir)
│       │   ├── kasir/
│       │   │   ├── pos/+page.svelte
│       │   │   ├── order/+page.svelte
│       │   │   ├── produk/+page.svelte
│       │   │   ├── pelanggan/+page.svelte
│       │   │   ├── shift/+page.svelte
│       │   │   ├── laporan/+page.svelte
│       │   │   └── setting/+page.svelte
│       ├── (gudang)/                     # Group: Gudang routes
│       │   ├── +layout.svelte            # Gudang layout
│       │   ├── +layout.ts                # Gudang loader (RBAC: gudang)
│       │   └── gudang/
│       │       ├── beranda/+page.svelte
│       │       ├── inventaris/+page.svelte
│       │       ├── barang-masuk/+page.svelte
│       │       ├── barang-keluar/+page.svelte
│       │       └── surat-jalan/+page.svelte
│       ├── (manager)/                    # Group: Manager routes
│       │   ├── +layout.svelte            # Manager layout
│       │   ├── +layout.ts                # Manager loader (RBAC: manager)
│       │   └── manager/
│       │       ├── beranda/+page.svelte
│       │       ├── penjualan/+page.svelte
│       │       ├── inventaris/+page.svelte
│       │       ├── keuangan/+page.svelte
│       │       ├── karyawan/+page.svelte
│       │       ├── laporan/+page.svelte
│       │       ├── surat-jalan/+page.svelte
│       │       ├── ai/+page.svelte
│       │       └── pengaturan/+page.svelte
│       └── api/                          # (optional) Edge functions, proxy
├── static/                              # Static files (favicon, robots.txt)
├── tests/
│   ├── unit/                            # Vitest unit tests
│   └── e2e/                             # Playwright E2E tests
├── package.json
├── tsconfig.json
├── svelte.config.js
├── vite.config.ts
└── README.md
```

## 4. Route Map (Berdasarkan FEATURE_MATRIX + USER_FLOW)

### 4.1 Public Routes

| Path                | Component         | Akses      | Keterangan                                   |
|---------------------|-------------------|------------|----------------------------------------------|
| `/`                 | `+page.svelte`    | public     | Redirect: jika auth → `/{role}/beranda` atau `/kasir/pos`; jika tidak → `/login` |
| `/login`            | `login/+page.svelte` | public | SATU login page (auto-detect role, lihat §6.1) |
| `/health`           | (opsional)        | public     | SvelteKit endpoint cek status                |

### 4.2 Kasir Routes (`role: kasir`)

| Path                | Nama Halaman  | Fitur Utama (FEATURE_MATRIX)                                  |
|---------------------|---------------|---------------------------------------------------------------|
| `/kasir/pos`        | POS           | Scan barcode, filter kategori, search, input member, ringkasan pesanan |
| `/kasir/order`      | Order         | List, detail, search, void, draft counter                     |
| `/kasir/produk`     | Produk        | List, detail, stock, search, riwayat, produk serupa           |
| `/kasir/pelanggan`  | Pelanggan     | List, detail, search, tier, poin, purchase history            |
| `/kasir/shift`      | Shift         | List, detail, start/end shift, search, handover              |
| `/kasir/laporan`    | Laporan       | Ringkasan shift, metode bayar, best sellers, export PDF       |
| `/kasir/setting`    | Setting       | Profil, PIN, printer, devices, ringkasan sistem               |

### 4.3 Gudang Routes (`role: gudang`)

| Path                | Nama Halaman  | Fitur Utama                                                  |
|---------------------|---------------|--------------------------------------------------------------|
| `/gudang/beranda`   | Beranda       | Ringkasan, tugas hari ini, prioritas stok, aktivitas terbaru |
| `/gudang/inventaris`| Inventaris    | List produk, add/edit, restock, restock massal, export       |
| `/gudang/barang-masuk` | Barang Masuk | List PO, input manual, verifikasi                            |
| `/gudang/barang-keluar`| Barang Keluar| List, picking process, cetak SJ, alasan tertunda           |
| `/gudang/surat-jalan`| Surat Jalan  | List, review, setujui internal, cetak, reprint               |

### 4.4 Manager Routes (`role: manager`)

| Path                | Nama Halaman  | Fitur Utama                                                  |
|---------------------|---------------|--------------------------------------------------------------|
| `/manager/beranda`  | Beranda       | Dashboard operasional, KPI, 3 best sellers, ringkasan, approval queue |
| `/manager/penjualan`| Penjualan     | Analisis penjualan, best sellers, insight                   |
| `/manager/inventaris`| Inventaris   | Analisis, fast moving, stok kritis, insight                  |
| `/manager/keuangan` | Keuangan      | Analisis, laba rugi, hutang, insight                         |
| `/manager/karyawan` | Karyawan      | Manajemen, kehadiran, cuti/izin, performa, insight           |
| `/manager/laporan`  | Laporan       | Dashboard analitik, top produk, KPI outlet, insight          |
| `/manager/surat-jalan`| Surat Jalan | Approval, review, cetak, insight                            |
| `/manager/ai`       | AI Assistant  | Chat, activity, insight chips, control center                |
| `/manager/pengaturan`| Pengaturan   | Outlet profile, jam operasional, hak akses, server, sistem   |

## 5. Layout & Navigation

### 5.1 Role-Based Layout (3 layout terpisah)

**Mengapa 3 layout?** Pemisahan tegas antar-role (lihat FEATURE_MATRIX §18 + PRD §3). Tidak ada cross-role navigation.

#### Kasir Layout
```
┌─────────────────────────────────────────────────────────┐
│ Top Bar: [HEKAS POS] [Shift Aktif #N] [Jam] [Profile] [Logout] │
├──────┬──────────────────────────────────────────────────┤
│      │                                                  │
│ Side │                Content Area                      │
│ bar  │                                                  │
│      │  (POS / Order / Produk / Pelanggan / Shift /     │
│ Menu │   Laporan / Setting)                            │
│ Item │                                                  │
│      │                                                  │
└──────┴──────────────────────────────────────────────────┘
```

Sidebar items (Kasir):
- POS (default route)
- Order
- Produk
- Pelanggan
- Shift
- Laporan
- Setting

#### Gudang Layout
```
┌─────────────────────────────────────────────────────────┐
│ Top Bar: [HEKAS Gudang] [Outlet] [Sync] [Profile] [Logout]│
├──────┬──────────────────────────────────────────────────┤
│      │                                                  │
│ Side │                Content Area                      │
│ bar  │  (Beranda / Inventaris / Barang Masuk /          │
│      │   Barang Keluar / Surat Jalan)                   │
└──────┴──────────────────────────────────────────────────┘
```

Sidebar items (Gudang):
- Beranda (default)
- Inventaris
- Barang Masuk
- Barang Keluar
- Surat Jalan

#### Manager Layout
```
┌─────────────────────────────────────────────────────────┐
│ Top Bar: [HEKAS Manager] [Tanggal] [Export] [🔔] [Profile]│
├──────┬──────────────────────────────────────────────────┤
│      │                                                  │
│ Side │                Content Area                      │
│ bar  │  (Beranda / Penjualan / Inventaris / Keuangan /  │
│      │   Karyawan / Laporan / Surat Jalan / AI /        │
│      │   Pengaturan)                                    │
└──────┴──────────────────────────────────────────────────┘
```

Sidebar items (Manager):
- Beranda (default)
- Penjualan
- Inventaris
- Keuangan
- Karyawan
- Laporan
- Surat Jalan
- AI Assistant
- Pengaturan

### 5.2 Layout Implementation (SvelteKit)

Menggunakan **route groups** (`(kasir)`, `(gudang)`, `(manager)`) untuk grouping tanpa mengubah URL:

```typescript
// src/routes/(kasir)/+layout.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ locals, url }) => {
  const user = locals.user;

  if (!user) {
    throw redirect(302, '/login?redirect=' + url.pathname);
  }

  if (user.role !== 'kasir') {
    throw redirect(302, `/${roleHomePath(user.role)}`);
  }

  return { user };
};
```

```svelte
<!-- src/routes/(kasir)/+layout.svelte -->
<script lang="ts">
  import Sidebar from '$lib/components/shared/Sidebar.svelte';
  import TopBar from '$lib/components/shared/TopBar.svelte';
  import { kasirMenu } from '$lib/auth/roles';
  let { data, children } = $props();
</script>

<div class="flex h-screen bg-surface">
  <Sidebar menu={kasirMenu} role={data.user.role} />
  <main class="flex-1 flex flex-col overflow-hidden">
    <TopBar user={data.user} />
    <div class="flex-1 overflow-auto p-6">
      {@render children()}
    </div>
  </main>
</div>
```

## 6. Auth & Login Flow

### 6.1 SATU Login Page (Auto-Detect Role)

**Compliance dengan memory HEKAS POS** + PRD: hanya 1 route `/login`, sistem auto-detect role setelah verify credentials.

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import LoginForm from '$lib/components/LoginForm.svelte';

  let { form } = $props();
</script>

<LoginForm {form} />
```

```typescript
// src/routes/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { authApi } from '$lib/api/auth';

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get('username') as string;
    const password = data.get('password') as string;

    try {
      const result = await authApi.login(username, password);

      // Set HTTP-only cookie dengan token
      cookies.set('hekas_token', result.data.token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 12 // 12 hours
      });

      // Set user info (non-sensitive) di cookie terpisah untuk client
      cookies.set('hekas_user', JSON.stringify({
        id: result.data.user.id,
        username: result.data.user.username,
        role: result.data.user.role,
        full_name: result.data.user.full_name
      }), {
        path: '/',
        httpOnly: false, // accessible client-side untuk UI
        maxAge: 60 * 60 * 12
      });

      // Redirect by role
      const homePath = roleHomePath(result.data.user.role);
      throw redirect(303, homePath);
    } catch (e) {
      if (e.status === 401) {
        return fail(401, { error: 'Username atau password salah' });
      }
      return fail(500, { error: 'Terjadi kesalahan, coba lagi' });
    }
  }
};
```

```typescript
// src/lib/auth/roles.ts
export type Role = 'kasir' | 'gudang' | 'manager';

export const roleHomePath = (role: Role): string => {
  switch (role) {
    case 'kasir': return '/kasir/pos';
    case 'gudang': return '/gudang/beranda';
    case 'manager': return '/manager/beranda';
  }
};

export const kasirMenu = [
  { label: 'POS', path: '/kasir/pos', icon: 'ShoppingCart' },
  { label: 'Order', path: '/kasir/order', icon: 'Receipt' },
  { label: 'Produk', path: '/kasir/produk', icon: 'Package' },
  { label: 'Pelanggan', path: '/kasir/pelanggan', icon: 'Users' },
  { label: 'Shift', path: '/kasir/shift', icon: 'Clock' },
  { label: 'Laporan', path: '/kasir/laporan', icon: 'BarChart2' },
  { label: 'Setting', path: '/kasir/setting', icon: 'Settings' },
];

export const gudangMenu = [
  { label: 'Beranda', path: '/gudang/beranda', icon: 'Home' },
  { label: 'Inventaris', path: '/gudang/inventaris', icon: 'Boxes' },
  { label: 'Barang Masuk', path: '/gudang/barang-masuk', icon: 'Truck' },
  { label: 'Barang Keluar', path: '/gudang/barang-keluar', icon: 'Send' },
  { label: 'Surat Jalan', path: '/gudang/surat-jalan', icon: 'FileText' },
];

export const managerMenu = [
  { label: 'Beranda', path: '/manager/beranda', icon: 'Home' },
  { label: 'Penjualan', path: '/manager/penjualan', icon: 'TrendingUp' },
  { label: 'Inventaris', path: '/manager/inventaris', icon: 'Package' },
  { label: 'Keuangan', path: '/manager/keuangan', icon: 'DollarSign' },
  { label: 'Karyawan', path: '/manager/karyawan', icon: 'Users' },
  { label: 'Laporan', path: '/manager/laporan', icon: 'BarChart2' },
  { label: 'Surat Jalan', path: '/manager/surat-jalan', icon: 'FileText' },
  { label: 'AI Assistant', path: '/manager/ai', icon: 'Sparkles' },
  { label: 'Pengaturan', path: '/manager/pengaturan', icon: 'Settings' },
];
```

### 6.2 Hooks (`hooks.server.ts`)

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get('hekas_token');
  const userCookie = event.cookies.get('hekas_user');

  if (token && userCookie) {
    try {
      const user = JSON.parse(userCookie);
      event.locals.user = user;
      event.locals.token = token;
    } catch {
      // Invalid cookie, clear
      event.cookies.delete('hekas_token');
      event.cookies.delete('hekas_user');
    }
  }

  return resolve(event);
};
```

### 6.3 Logout

Tombol logout ada di TopBar setiap role. POST ke `/logout` action → clear cookies → redirect ke `/login`.

## 7. API Client Layer

### 7.1 Base Client

```typescript
// src/lib/api/client.ts
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error?.code || 'UNKNOWN_ERROR',
      json?.error?.message || res.statusText,
      json?.error?.details
    );
  }

  return json?.data;
}

// Server-side fetch dengan token dari locals
export function serverFetch(token: string) {
  return <T>(path: string, options?: RequestInit) =>
    apiFetch<T>(path, options, token);
}
```

### 7.2 Per-Domain Modules (contoh)

```typescript
// src/lib/api/orders.ts
import { apiFetch, ApiError } from './client';
import type { Order, OrderItem } from '$lib/types/domain';

export const ordersApi = {
  list: (filters: OrderFilters, token?: string) =>
    apiFetch<Paginated<Order>>(`/orders?${qs(filters)}`, {}, token),

  get: (id: number, token?: string) =>
    apiFetch<Order>(`/orders/${id}`, {}, token),

  create: (data: CreateOrderDto, token?: string) =>
    apiFetch<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data)
    }, token),

  complete: (id: number, payment: PaymentDto, token?: string) =>
    apiFetch<Order>(`/orders/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ payment })
    }, token),

  void: (id: number, pin: string, reason: string, token?: string) =>
    apiFetch<Order>(`/orders/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ pin, reason })
    }, token),

  // ... etc
};
```

## 8. State Management

### 8.1 Cart State (Kasir — rune-based)

Cart POS adalah state yang kompleks (item list, qty, discount, member, payment). Pakai Svelte 5 runes:

```typescript
// src/lib/stores/cart.svelte.ts
import type { CartItem, Product } from '$lib/types/domain';

class CartStore {
  items = $state<CartItem[]>([]);
  member = $state<{ id: number; name: string; tier: string } | null>(null);
  globalDiscount = $state(0);

  subtotal = $derived(
    this.items.reduce((sum, item) => sum + (item.price * item.qty), 0)
  );

  itemDiscountTotal = $derived(
    this.items.reduce((sum, item) => sum + item.discount, 0)
  );

  total = $derived(
    this.subtotal - this.itemDiscountTotal - this.globalDiscount
  );

  itemCount = $derived(
    this.items.reduce((sum, item) => sum + item.qty, 0)
  );

  addProduct(product: Product) {
    const existing = this.items.find(i => i.productId === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      this.items.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        qty: 1,
        discount: 0,
        unit: product.unit
      });
    }
  }

  setQty(productId: number, qty: number) {
    if (qty <= 0) {
      this.items = this.items.filter(i => i.productId !== productId);
    } else {
      const item = this.items.find(i => i.productId === productId);
      if (item) item.qty = qty;
    }
  }

  remove(productId: number) {
    this.items = this.items.filter(i => i.productId !== productId);
  }

  setDiscount(productId: number, discount: number) {
    const item = this.items.find(i => i.productId === productId);
    if (item) item.discount = discount;
  }

  clear() {
    this.items = [];
    this.member = null;
    this.globalDiscount = 0;
  }
}

export const cart = new CartStore();
```

### 8.2 Auth State

```typescript
// src/lib/stores/auth.svelte.ts
import type { User } from '$lib/types/domain';

class AuthStore {
  user = $state<User | null>(null);

  isAuthenticated = $derived(this.user !== null);
  role = $derived(this.user?.role ?? null);

  setUser(user: User | null) {
    this.user = user;
  }
}

export const auth = new AuthStore();
```

### 8.3 Notification State (In-App)

Untuk notifikasi non-Telegram (mis. toast error, success message). Bukan untuk push notifications.

```typescript
// src/lib/stores/notifications.svelte.ts
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration?: number;
}

class NotificationStore {
  toasts = $state<Toast[]>([]);
  private counter = 0;

  show(message: string, type: ToastType = 'info', duration = 3000) {
    const id = ++this.counter;
    this.toasts.push({ id, type, message, duration });
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(message: string) { this.show(message, 'success'); }
  error(message: string) { this.show(message, 'error'); }

  dismiss(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}

export const notifications = new NotificationStore();
```

## 9. Data Fetching (SvelteKit `load`)

### 9.1 Server Load (default — prefer ini)

```typescript
// src/routes/(manager)/manager/beranda/+page.server.ts
import type { PageServerLoad } from './$types';
import { dashboardApi } from '$lib/api/dashboard';
import { serverFetch } from '$lib/api/client';

export const load: PageServerLoad = async ({ locals }) => {
  const fetch = serverFetch(locals.token);

  const [dashboard, approvals] = await Promise.all([
    dashboardApi.manager(fetch),
    fetch('/surat-jalan?status=MENUNGGU_APPROVAL&limit=5')
  ]);

  return { dashboard, approvals };
};
```

### 9.2 Universal Load (kalau perlu client+server)

```typescript
// src/routes/(kasir)/kasir/produk/+page.ts
import type { PageLoad } from './$types';
import { productsApi } from '$lib/api/products';
import { auth } from '$lib/stores/auth.svelte';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:products');

  // Gunakan fetch SvelteKit (auto-handle credential + SSR)
  // Atau gunakan productsApi.list() yang pakai native fetch
  // ...
};
```

### 9.3 Form Actions (untuk POST/PUT/DELETE dari form)

```typescript
// src/routes/(gudang)/gudang/inventaris/+page.server.ts
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { inventoryApi } from '$lib/api/inventory';

export const actions: Actions = {
  restock: async ({ request, locals }) => {
    const data = await request.formData();
    const productId = Number(data.get('product_id'));
    const quantity = Number(data.get('quantity'));
    const supplierId = Number(data.get('supplier_id'));

    try {
      await inventoryApi.restock(productId, { quantity, supplier_id: supplierId }, locals.token);
      return { success: true, message: 'Restock berhasil' };
    } catch (e) {
      return fail(400, { error: e.message });
    }
  }
};
```

## 10. Error Handling

### 10.1 Global Error Page

```svelte
<!-- src/routes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/state';
</script>

<div class="flex flex-col items-center justify-center h-screen bg-surface p-8">
  <h1 class="text-headline-lg font-bold text-error">
    {page.status}
  </h1>
  <p class="text-body-lg mt-4">{page.error?.message || 'Terjadi kesalahan'}</p>
  <a href="/" class="mt-6 px-4 py-2 bg-primary text-on-primary rounded-lg">
    Kembali ke Beranda
  </a>
</div>
```

### 10.2 API Error → Toast

Di semua form action atau client-side fetch, tangkap `ApiError` dan tampilkan toast:

```typescript
try {
  await ordersApi.complete(orderId, payment);
  notifications.success('Transaksi berhasil');
} catch (e) {
  if (e instanceof ApiError) {
    if (e.code === 'INSUFFICIENT_STOCK') {
      notifications.error('Stok produk tidak cukup');
    } else {
      notifications.error(e.message);
    }
  }
}
```

### 10.3 Retry Strategy
- Network error: otomatis retry 1x dengan delay 1s.
- 5xx: tampilkan error, tidak retry otomatis.
- 401: redirect ke `/login`.

## 11. Design System Integration

### 11.1 Design Tokens (CSS Variables)

Dari PRD §5 + `default_shadcn_theme.css`:

```css
/* src/app.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Brand */
    --primary: 0 40 142;            /* #00288e */
    --primary-container: 30 64 175; /* #1e40af */
    --on-primary: 255 255 255;

    /* Surface */
    --surface: 248 249 255;         /* #f8f9ff */
    --background: 248 249 255;
    --on-surface: 11 28 48;         /* #0b1c30 */
    --outline: 117 118 132;         /* #757684 */

    /* Semantic */
    --error: 186 26 26;             /* #ba1a1a */
    --warning: 217 119 6;
    --success: 5 150 105;

    /* Typography */
    --font-sans: 'Inter', system-ui, sans-serif;
  }
}
```

### 11.2 Tailwind Config Integration

```typescript
// tailwind.config.ts (atau @theme di Tailwind 4)
export default {
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-container': 'rgb(var(--primary-container) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        error: 'rgb(var(--error) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      fontSize: {
        'headline-lg': ['30px', { lineHeight: '38px', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'headline-sm': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px' }],
        'body-md': ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        'numeral-xl': ['36px', { lineHeight: '44px', fontWeight: '700' }],
      },
      borderRadius: {
        DEFAULT: '8px'
      }
    }
  }
};
```

### 11.3 Component Library (shadcn-svelte)

Install via shadcn CLI untuk Svelte. Contoh:

```bash
bunx shadcn-svelte@latest init
bunx shadcn-svelte@latest add button card input dialog table
```

Komponen di-generate di `src/lib/components/ui/`. Custom variants untuk HEKAS:
- `Button`: variant `primary | secondary | ghost | destructive`, size `sm | md | lg`.
- `Card`: dengan header/body/footer slots.
- `Table`: dengan pagination built-in.
- `Dialog`: dengan backdrop blur.
- `Badge`: variant `default | success | warning | error | info` untuk status order/SJ.

## 12. Performance & UX Patterns

### 12.1 Performance
- **Code splitting**: SvelteKit otomatis per-route.
- **Prefetch**: `data-sveltekit-preload-data="hover"` untuk link internal.
- **Image lazy loading**: `<img loading="lazy">` atau `enhanced:img` (SvelteKit).
- **Pagination**: 20 item per page default (lihat API_SPEC §2.2).
- **Debounced search**: 300ms debounce untuk input search.
- **Optimistic updates**: untuk aksi kasir (qty change, dll) — update UI dulu, rollback jika API error.

### 12.2 UX Patterns
- **Loading state**: skeleton atau spinner saat `load` berjalan.
- **Empty state**: ilustrasi + CTA untuk list kosong.
- **Confirmation dialog**: untuk aksi destruktif (void, delete, reject).
- **PIN dialog**: modal centered untuk void + end shift.
- **Toast notification**: bottom-right, auto-dismiss 3s.
- **Keyboard shortcuts** (Asumsi):
  - Kasir: `F1` (scan), `F2` (payment), `F3` (hold draft), `Esc` (clear cart).
  - Gudang: `Ctrl+K` (search).
  - Manager: `Ctrl+E` (export PDF).

### 12.3 Accessibility (a11y)
- Semantic HTML (`<nav>`, `<main>`, `<aside>`, `<button>`).
- ARIA labels untuk icon-only buttons.
- Focus visible (Tailwind `focus-visible:ring-2`).
- Color contrast AA minimum (cek primary #00288e on #f8f9ff → kontras cukup).
- Keyboard navigation full (Tab, Enter, Escape).
- Screen reader text untuk status badges.

### 12.4 Responsive Design
- **Desktop-first** (UI evidence menunjukkan desktop prototype, lihat PRD §7).
- Breakpoint Tailwind default (`sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`).
- Minimum supported: 1024×768 (tablet landscape minimum).
- Tidak ada mobile-first design (sesuai PRD §7 Non-Goals: mobile native app).

## 13. Testing Strategy

| Level        | Tool                            | Cakupan                                         |
|--------------|---------------------------------|-------------------------------------------------|
| Unit         | Vitest                          | Stores, utils, formatters                       |
| Component    | @testing-library/svelte         | Per-component: props, events, rendering         |
| Integration  | Vitest + MSW                    | API client + load functions                     |
| E2E          | Playwright                      | Per-role flow: login → main action              |

Critical E2E flows (wajib ada):
- Kasir: login → start shift → POS → complete order (Tunai/QRIS/Debit) → end shift.
- Kasir: void order dengan PIN.
- Gudang: input PO → verifikasi → cek stok naik.
- Gudang: buat barang keluar → buat SJ → submit ke Manager.
- Manager: approve SJ → cek Telegram log.
- Manager: chat AI (echo MVP).
- RBAC: kasir coba akses `/manager/beranda` → redirect ke `/kasir/pos`.

## 14. Build & Deploy

### 14.1 Build

```bash
bun install
bun run build       # SvelteKit build (output: .svelte-kit/output)
bun run preview     # Local preview
```

Adapter: `@sveltejs/adapter-auto` (default; auto-detect Vercel/Netlify/Node).

### 14.2 Env Vars

```bash
# .env.example
VITE_API_BASE=http://localhost:3001/api
DATABASE_URL=postgres://user:pass@localhost:5432/hekas_pos
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_WEBHOOK_SECRET=xxx
JWT_SECRET=xxx
```

### 14.3 Deploy

Frontend (SvelteKit) deploy terpisah dari backend (ElysiaJS + Bun):
- Frontend: Vercel/Netlify/Node static.
- Backend: Bun runtime di Railway/Fly.io/VPS.

Monorepo structure (jika pakai Bun workspaces):
```
/home/jazli/hekas-pos/
├── apps/
│   ├── web/        # SvelteKit (frontend)
│   └── api/        # ElysiaJS (backend)
├── packages/
│   └── shared/     # Shared types (zod schemas, Drizzle types)
├── docs/
└── package.json
```

> **Catatan**: Saat ini struktur project adalah `hekas-app/` (frontend) + `design/` (UI reference). Backend ElysiaJS belum ada folder. Saat implementasi backend, buat `apps/api/` atau `backend/`.

## 15. Catatan & Prinsip UX

### 15.1 Yang TIDAK Boleh Dilakukan

1. **Jangan soft-launch role override**: Tombol "Lihat sebagai Manager" untuk kasir = TIDAK ADA. Strict separation.
2. **Jangan hardcode warna/typography**: Selalu pakai design tokens. Linting rules enforce ini (Asumsi: ESLint custom rule).
3. **Jangan skip RBAC check**: Setiap endpoint harus diverifikasi role-nya. Backend + frontend double-check.
4. **Jangan expose token ke client-side JS**: Token hanya di HTTP-only cookie. Client tidak pernah pegang JWT secara langsung.
5. **Jangan simpan PII di localStorage**: Gunakan cookies HTTP-only untuk data sensitif.
6. **Jangan auto-redirect kasir dari draft hold**: Hold tetap ada sampai kasir explicitly resume atau delete.
7. **Jangan tampilkan harga beli ke kasir**: Pembelian harga (HPP) hanya untuk gudang + manager.
8. **Jangan izinkan multi-role user**: 1 user = 1 role. Tidak ada user yang bisa switch role tanpa logout-login ulang.

### 15.2 Prinsip UX

1. **Speed**: POS harus responsif <100ms per action. Optimistic update + debounce search.
2. **Clarity**: Status badge dengan warna jelas (success green, warning amber, error red).
3. **Feedback**: Setiap aksi user ada response visible (toast, animation, state change).
4. **Reversibility**: Aksi destruktif (void, delete) bisa di-undo dalam window 5 detik (toast dengan tombol "Undo").
5. **Offline-tolerant** (Asumsi): POS kasir tampilkan data terakhir yang valid saat network error, jangan crash.
6. **Mobile-friendly secondary**: Desktop primary, tapi boleh diakses dari tablet/phone dengan responsive layout (tidak optimal, tapi functional).

## 16. Open Questions

1. **PWA support**: POS kasir bisa di-install sebagai PWA untuk tablet kasir? (Asumsi: ya, pakai @vite-pwa/sveltekit)
2. **Push notification browser**: Untuk approval queue real-time Manager? (Asumsi: cukup Telegram + in-app refresh, no browser push)
3. **Receipt printer integration**: Frontend perlu panggil printer via Web Bluetooth/USB, atau backend handle? (Asumsi: backend handle via job queue, frontend trigger print job)
4. **Multi-language**: Indonesia only atau perlu English fallback? (Asumsi: ID only per PRD §7)
5. **Theme**: Light only per PRD §5, atau siapkan dark mode infrastructure untuk Tahap 2? (Asumsi: light only, prepare CSS variable structure agar dark mode tinggal swap value)

---

**Akhir dokumen FRONTEND_ARCHITECTURE.md**
