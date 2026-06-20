# TASK BREAKDOWN — JAZLI (FRONTEND LEAD)

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Detail task breakdown untuk frontend developer (Jazli)
**Dasar**: `DEVELOPMENT_ROADMAP.md` v1.0.0 + `FRONTEND_ARCHITECTURE.md` v1.0.0 + `SCREEN_MAP.md` v1.0.0
**Project root**: `/home/jazli/hekas-pos/hekas-app/`
**Backend sync**: Wafiq (lihat `TASK_WAFIQ_BACKEND.md`)

---

## 1. Ringkasan

Tugas frontend owner: **Jazli**. Total estimasi: **~117 hari kerja** (~23 sprint × ~5 hari kerja, atau ~6 bulan kalender full-time). Parallel dengan backend Wafiq.

> **Catatan**: Estimasi hari kerja termasuk review, testing, dan revisi. Actual sprint mungkin lebih panjang karena ada dependencies dengan backend.

## 2. Workflow Harian

| Jam          | Aktivitas                                                              |
|--------------|------------------------------------------------------------------------|
| 09:00-09:15  | Daily standup (async atau sync dengan Wafiq)                           |
| 09:15-12:00  | Coding block 1 (focus deep work)                                       |
| 12:00-13:00  | Istirahat                                                              |
| 13:00-15:30  | Coding block 2                                                         |
| 15:30-16:00  | Code review (PR dari Wafiq atau junior)                                |
| 16:00-17:00  | Testing + bugfix                                                       |
| 17:00-17:30  | Update task board + eskalasi blocker ke pak bos jika ada               |

## 3. Konvensi Kode (Frontend)

### 3.1 Naming

| Jenis              | Convention                | Contoh                              |
|--------------------|---------------------------|-------------------------------------|
| Component file     | PascalCase.svelte         | `ProductGrid.svelte`                |
| Utility file       | kebab-case.ts             | `format-currency.ts`                |
| Store (rune)       | kebab-case.svelte.ts      | `cart.svelte.ts`                    |
| Type/Interface     | PascalCase                | `OrderItem`, `CartState`            |
| Variable (local)   | camelCase                 | `cartItems`, `isLoading`            |
| Constant           | UPPER_SNAKE_CASE          | `MAX_RETRY_ATTEMPTS`                |
| CSS class          | Tailwind utility          | `bg-primary text-on-primary`        |
| CSS custom         | kebab-case                | `--hekas-blue`                      |
| Route path         | kebab-case                | `/barang-masuk`                     |
| API endpoint       | snake_case (sesuai API)   | `/api/incoming-goods`               |

### 3.2 Git Workflow

- **Branch naming**: `feat/...`, `fix/...`, `chore/...`, `refactor/...`
- Contoh: `feat/kasir-pos-screen`, `fix/cart-quantity-bug`
- **Commit message**: Conventional Commits
  - `feat(pos): add barcode scanner component`
  - `fix(cart): handle empty cart submit`
  - `chore(deps): update shadcn-svelte components`
- **PR review**: Wajib 1 approval dari peer sebelum merge.
- **Squash merge** ke `main`.

### 3.3 Quality Gate (per PR)

- [ ] TypeScript: zero error (`bun run check`)
- [ ] Lint: zero warning (`bun run lint`)
- [ ] Build sukses (`bun run build`)
- [ ] Component tested (jika logic complex)
- [ ] Manual QA di dev server
- [ ] Design tokens compliant (no hardcoded color/typography)
- [ ] No `any` di production code (Asumsi rule ESLint)

## 4. Task Detail per Gate

### Gate 0 — Foundation (Sprint 1-2, ~13 hari kerja)

| # | Task | File/Folder | Detail | Estimasi | Status |
|---|------|-------------|--------|----------|--------|
| 0.1 | Setup SvelteKit 5 | `package.json`, `svelte.config.js`, `vite.config.ts` | Init project, config adapter-auto, TypeScript strict | 1 hari | ☐ |
| 0.2 | Setup Tailwind 4 | `app.css`, `tailwind.config.ts` | Design tokens dari PRD §5 + Inter font | 1 hari | ☐ |
| 0.3 | Install shadcn-svelte | `src/lib/components/ui/*` | Init + add Button, Card, Input, Dialog, Table, Select, Badge, Alert, Toast, Dropdown, Pagination | 1 hari | ☐ |
| 0.4 | Setup route groups | `src/routes/(kasir)/`, `(gudang)/`, `(manager)/` | Buat folder + `+layout.svelte` + `+layout.ts` masing-masing | 2 hari | ☐ |
| 0.5 | Login page | `src/routes/login/+page.svelte`, `+page.server.ts` | Single login page, auto-detect role, redirect | 2 hari | ☐ |
| 0.6 | Layout guards | `src/routes/(role)/+layout.ts` × 3 | RBAC check via locals.user.role | 1 hari | ☐ |
| 0.7 | API client base | `src/lib/api/client.ts` | Fetch wrapper dengan auth header + error handling | 1 hari | ☐ |
| 0.8 | Auth API wrapper | `src/lib/api/auth.ts` | login, logout, refresh, me | 0.5 hari | ☐ |
| 0.9 | Roles + helper | `src/lib/auth/roles.ts` | Type Role, roleHomePath, menu per role | 0.5 hari | ☐ |
| 0.10 | Sidebar component | `src/lib/components/shared/Sidebar.svelte` | Dynamic menu per role | 1 hari | ☐ |
| 0.11 | TopBar component | `src/lib/components/shared/TopBar.svelte` | Logo + user info + logout | 0.5 hari | ☐ |
| 0.12 | Breadcrumb | `src/lib/components/shared/Breadcrumb.svelte` | Path-based breadcrumb | 0.5 hari | ☐ |
| 0.13 | EmptyState | `src/lib/components/shared/EmptyState.svelte` | Ilustrasi + title + CTA | 0.5 hari | ☐ |
| 0.14 | LoadingSpinner | `src/lib/components/shared/LoadingSpinner.svelte` | Spinner reusable | 0.5 hari | ☐ |
| 0.15 | ErrorBoundary | `src/lib/components/shared/ErrorBoundary.svelte` | Catch error UI | 0.5 hari | ☐ |
| 0.16 | Toast store + UI | `src/lib/stores/notifications.svelte.ts` + `ToastContainer.svelte` | Success/error/info/warning | 1 hari | ☐ |
| 0.17 | Auth store | `src/lib/stores/auth.svelte.ts` | Current user state | 0.5 hari | ☐ |
| 0.18 | Format utils | `src/lib/utils/format.ts` | Currency (Rp), date, time helpers | 0.5 hari | ☐ |
| 0.19 | Hooks server | `src/hooks.server.ts` | Parse JWT cookie, populate locals.user | 0.5 hari | ☐ |
| 0.20 | Index landing redirect | `src/routes/+page.svelte` | Redirect based on role atau /login | 0.5 hari | ☐ |
| 0.21 | Custom error page | `src/routes/+error.svelte` | Global error UI | 0.5 hari | ☐ |

**Total Gate 0 frontend**: ~16.5 hari kerja (di roadmap 13 hari, ini lebih detail)

---

### Gate 1 — Auth + POS (Sprint 3-4, ~25.5 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 1.1 | Cart store (runes) | `src/lib/stores/cart.svelte.ts` | CartItem[], member, discount, totals derived | 1 hari |
| 1.2 | Products API wrapper | `src/lib/api/products.ts` | list, get, search, filter | 0.5 hari |
| 1.3 | Members API wrapper | `src/lib/api/members.ts` | list, get, search | 0.5 hari |
| 1.4 | Orders API wrapper | `src/lib/api/orders.ts` | create, get, list, complete, void, hold, resume | 1 hari |
| 1.5 | Shifts API wrapper | `src/lib/api/shifts.ts` | start, end, get active, list, summary | 0.5 hari |
| 1.6 | POS Product Grid | `src/lib/components/kasir/POS/ProductGrid.svelte` | Render product cards from filtered list | 1 hari |
| 1.7 | POS Category Tabs | `src/lib/components/kasir/POS/CategoryTabs.svelte` | All + per-category filter chips | 0.5 hari |
| 1.8 | POS Product Card | `src/lib/components/kasir/POS/ProductCard.svelte` | Image emoji + name + price + stock badge | 0.5 hari |
| 1.9 | POS Barcode Scanner | `src/lib/components/kasir/POS/BarcodeScanner.svelte` | Input dengan auto-focus + add to cart | 1 hari |
| 1.10 | POS Search Bar | `src/lib/components/kasir/POS/SearchBar.svelte` | Search nama/SKU dengan debounce | 0.5 hari |
| 1.11 | POS Cart | `src/lib/components/kasir/POS/Cart.svelte` | List CartItem dengan qty controls | 1 hari |
| 1.12 | POS Cart Item | `src/lib/components/kasir/POS/CartItem.svelte` | Row dengan qty + + − + delete | 0.5 hari |
| 1.13 | POS Order Summary | `src/lib/components/kasir/POS/OrderSummary.svelte` | Subtotal + discount + total | 0.5 hari |
| 1.14 | POS Payment Modal | `src/lib/components/kasir/POS/PaymentModal.svelte` | Pilih metode + konfirmasi + numpad | 2 hari |
| 1.15 | POS Numpad | `src/lib/components/kasir/POS/Numpad.svelte` | Numeric input reusable | 0.5 hari |
| 1.16 | POS Member Search | `src/lib/components/kasir/POS/MemberSearch.svelte` | Search + attach ke cart | 1 hari |
| 1.17 | POS Discount Modal | `src/lib/components/kasir/POS/DiscountModal.svelte` | Input diskon global atau per-item | 0.5 hari |
| 1.18 | POS Held Drafts Modal | `src/lib/components/kasir/POS/HeldDrafts.svelte` | List draft + resume | 1 hari |
| 1.19 | POS Screen | `src/routes/(kasir)/kasir/pos/+page.svelte` | Compose semua POS components + TopBar shift badge | 2 hari |
| 1.20 | POS Receipt Modal | `src/lib/components/kasir/POS/ReceiptModal.svelte` | Tampilkan struk + print (mock) | 1 hari |
| 1.21 | Order List | `src/lib/components/kasir/Order/OrderList.svelte` | Tabel dengan filter status | 1 hari |
| 1.22 | Order Detail Panel | `src/lib/components/kasir/Order/OrderDetail.svelte` | Detail + actions (void, lihat) | 1 hari |
| 1.23 | Order Search | `src/lib/components/kasir/Order/OrderSearch.svelte` | Search by no/customer/kasir | 0.5 hari |
| 1.24 | Void Confirm Dialog | `src/lib/components/kasir/Order/VoidConfirmDialog.svelte` | PIN + reason input | 1 hari |
| 1.25 | PIN Dialog (reusable) | `src/lib/components/shared/PinDialog.svelte` | Generic PIN input dialog | 0.5 hari |
| 1.26 | Order Screen | `src/routes/(kasir)/kasir/order/+page.svelte` | List + detail panel layout | 1 hari |
| 1.27 | Product Catalog View | `src/lib/components/kasir/Produk/ProductCatalog.svelte` | Grid/list produk (read-only kasir) | 1 hari |
| 1.28 | Produk Screen | `src/routes/(kasir)/kasir/produk/+page.svelte` | Search + filter | 0.5 hari |
| 1.29 | Member List | `src/lib/components/kasir/Pelanggan/MemberList.svelte` | List member dengan tier badge | 1 hari |
| 1.30 | Member Detail | `src/lib/components/kasir/Pelanggan/MemberDetail.svelte` | Detail + purchase history | 0.5 hari |
| 1.31 | Member Tier Badge | `src/lib/components/kasir/Pelanggan/MemberTierBadge.svelte` | Gold/Silver/Platinum color | 0.5 hari |
| 1.32 | Pelanggan Screen | `src/routes/(kasir)/kasir/pelanggan/+page.svelte` | List + detail | 0.5 hari |
| 1.33 | Shift List | `src/lib/components/kasir/Shift/ShiftList.svelte` | Tabel shift | 1 hari |
| 1.34 | Shift Detail | `src/lib/components/kasir/Shift/ShiftDetail.svelte` | Detail + summary + handover | 0.5 hari |
| 1.35 | Start Shift Dialog | `src/lib/components/kasir/Shift/StartShiftDialog.svelte` | Input modal awal | 0.5 hari |
| 1.36 | End Shift Dialog | `src/lib/components/kasir/Shift/EndShiftDialog.svelte` | PIN + modal akhir + handover | 1 hari |
| 1.37 | Shift Screen | `src/routes/(kasir)/kasir/shift/+page.svelte` | List + active shift info | 0.5 hari |
| 1.38 | Kasir Laporan Summary | `src/lib/components/kasir/Laporan/ShiftSummary.svelte` | Total transaksi + items + sales | 1 hari |
| 1.39 | Payment Method Chart | `src/lib/components/kasir/Laporan/PaymentMethodChart.svelte` | Pie chart Tunai/QRIS/Debit % | 1 hari |
| 1.40 | Best Sellers List | `src/lib/components/kasir/Laporan/BestSellers.svelte` | Top 5 produk | 0.5 hari |
| 1.41 | Export PDF Button | `src/lib/components/kasir/Laporan/ExportButton.svelte` | Trigger + poll status + download | 1 hari |
| 1.42 | Laporan Kasir Screen | `src/routes/(kasir)/kasir/laporan/+page.svelte` | Compose summary components | 1 hari |
| 1.43 | Kasir Setting - Profile | `src/lib/components/kasir/Setting/ProfileSection.svelte` | Edit profil sendiri | 0.5 hari |
| 1.44 | Kasir Setting - PIN | `src/lib/components/kasir/Setting/PinChangeDialog.svelte` | Ubah PIN dengan verifikasi lama | 0.5 hari |
| 1.45 | Kasir Setting - Printer | `src/lib/components/kasir/Setting/PrinterConfig.svelte` | Placeholder (print belum implemented) | 0.5 hari |
| 1.46 | Kasir Setting - Devices | `src/lib/components/kasir/Setting/ConnectedDevices.svelte` | List devices | 0.5 hari |
| 1.47 | Kasir Setting Screen | `src/routes/(kasir)/kasir/setting/+page.svelte` | Compose setting sections | 0.5 hari |
| 1.48 | TopBar Shift Aktif | `src/lib/components/shared/TopBar.svelte` | Badge "Shift Aktif #N" + real-time jam | 0.5 hari |

**Total Gate 1 frontend**: ~36 hari kerja (di roadmap 25.5 hari, lebih granular)

---

### Gate 2 — Admin Gudang (Sprint 5-6, ~22 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 2.1 | Dashboard summary API wrapper | `src/lib/api/dashboard.ts` | gudang dashboard | 0.5 hari |
| 2.2 | Inventory API wrapper | `src/lib/api/inventory.ts` | restock, summary, movements, export | 0.5 hari |
| 2.3 | Suppliers API wrapper | `src/lib/api/suppliers.ts` | list, create, update | 0.5 hari |
| 2.4 | Gudang Dashboard Summary | `src/lib/components/gudang/Beranda/DashboardSummary.svelte` | KPI cards | 1 hari |
| 2.5 | Today Tasks | `src/lib/components/gudang/Beranda/TodayTasks.svelte` | List task hari ini | 1 hari |
| 2.6 | Low Stock Alert | `src/lib/components/gudang/Beranda/LowStockAlert.svelte` | Alert + clickable ke inventaris | 0.5 hari |
| 2.7 | Recent Activity | `src/lib/components/gudang/Beranda/RecentActivity.svelte` | Stock movement log | 0.5 hari |
| 2.8 | Gudang Beranda Screen | `src/routes/(gudang)/gudang/beranda/+page.svelte` | Compose dashboard | 0.5 hari |
| 2.9 | Product Table | `src/lib/components/gudang/Inventaris/ProductTable.svelte` | Tabel produk + sort + filter | 1 hari |
| 2.10 | Stock Movement Log | `src/lib/components/gudang/Inventaris/StockMovementLog.svelte` | Per-product movement history | 1 hari |
| 2.11 | Restock Dialog | `src/lib/components/gudang/Inventaris/RestockDialog.svelte` | Single product restock | 0.5 hari |
| 2.12 | Bulk Restock Dialog | `src/lib/components/gudang/Inventaris/BulkRestockDialog.svelte` | Multi-select + bulk input | 1 hari |
| 2.13 | Product Form (Add/Edit) | `src/lib/components/gudang/Inventaris/ProductForm.svelte` | Form dengan image upload | 1.5 hari |
| 2.14 | Stock Adjustment Dialog | `src/lib/components/gudang/Inventaris/StockAdjustmentDialog.svelte` | Adjust dengan reason | 0.5 hari |
| 2.15 | Export Stock Report | `src/lib/components/gudang/Inventaris/ExportStockReport.svelte` | Trigger export | 0.5 hari |
| 2.16 | Inventaris Screen | `src/routes/(gudang)/gudang/inventaris/+page.svelte` | Compose | 1 hari |
| 2.17 | PO List | `src/lib/components/gudang/BarangMasuk/POList.svelte` | Tabel PO + filter status | 1 hari |
| 2.18 | PO Detail | `src/lib/components/gudang/BarangMasuk/PODetail.svelte` | Items + status + actions | 0.5 hari |
| 2.19 | PO Input Form | `src/lib/components/gudang/BarangMasuk/POInputForm.svelte` | Manual entry | 1 hari |
| 2.20 | PO Verification | `src/lib/components/gudang/BarangMasuk/POVerification.svelte` | Input qty aktual | 1 hari |
| 2.21 | Barang Masuk Screen | `src/routes/(gudang)/gudang/barang-masuk/+page.svelte` | Compose | 0.5 hari |
| 2.22 | Outgoing List | `src/lib/components/gudang/BarangKeluar/OutgoingList.svelte` | Tabel barang keluar | 1 hari |
| 2.23 | Outgoing Detail | `src/lib/components/gudang/BarangKeluar/OutgoingDetail.svelte` | Items + picking progress | 0.5 hari |
| 2.24 | Picking Process | `src/lib/components/gudang/BarangKeluar/PickingProcess.svelte` | Checklist per item | 1 hari |
| 2.25 | Pending Reason | `src/lib/components/gudang/BarangKeluar/PendingReason.svelte` | Input alasan tertunda | 0.5 hari |
| 2.26 | Outgoing Form | `src/lib/components/gudang/BarangKeluar/OutgoingForm.svelte` | Form buat baru | 1 hari |
| 2.27 | Barang Keluar Screen | `src/routes/(gudang)/gudang/barang-keluar/+page.svelte` | Compose | 0.5 hari |
| 2.28 | Gudang Setting - Profile | `src/lib/components/gudang/Setting/ProfileSection.svelte` | Edit profil sendiri | 0.5 hari |
| 2.29 | Gudang Setting - Sistem | `src/lib/components/gudang/Setting/SystemSummary.svelte` | Ringkasan sistem (read-only) | 0.5 hari |
| 2.30 | Gudang Setting Screen | `src/routes/(gudang)/gudang/setting/+page.svelte` | Compose | 0.5 hari |

**Total Gate 2 frontend**: ~20 hari kerja

---

### Gate 3 — Surat Jalan Approval (Sprint 7, ~13 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 3.1 | Surat Jalan API wrapper | `src/lib/api/surat-jalan.ts` | CRUD + approve + reject + print | 0.5 hari |
| 3.2 | Telegram API wrapper | `src/lib/api/telegram.ts` | Generate link code | 0.5 hari |
| 3.3 | SJ Create Form | `src/lib/components/gudang/SuratJalan/SJCreateForm.svelte` | Form dari outgoing goods | 1 hari |
| 3.4 | SJ List (Gudang) | `src/lib/components/gudang/SuratJalan/SJList.svelte` | Filter status + actions | 1 hari |
| 3.5 | SJ Detail | `src/lib/components/gudang/SuratJalan/SJDetail.svelte` | Items + approvals history | 1 hari |
| 3.6 | SJ Review Action | `src/lib/components/gudang/SuratJalan/SJReview.svelte` | Gudang review internal | 1 hari |
| 3.7 | Print SJ Button | `src/lib/components/gudang/SuratJalan/PrintSJButton.svelte` | Trigger + download PDF | 0.5 hari |
| 3.8 | Surat Jalan Gudang Screen | `src/routes/(gudang)/gudang/surat-jalan/+page.svelte` | Compose | 0.5 hari |
| 3.9 | SJ List (Manager) | `src/lib/components/manager/SuratJalan/SJListManager.svelte` | Filter pending | 0.5 hari |
| 3.10 | SJ Detail Manager | `src/lib/components/manager/SuratJalan/SJDetailManager.svelte` | Review + actions | 1 hari |
| 3.11 | Approve/Reject Modal | `src/lib/components/manager/SuratJalan/ApproveRejectModal.svelte` | Action + reason input | 1 hari |
| 3.12 | Surat Jalan Manager Screen | `src/routes/(manager)/manager/surat-jalan/+page.svelte` | Compose | 0.5 hari |
| 3.13 | Telegram Link UI | `src/lib/components/manager/Pengaturan/TelegramLink.svelte` | Generate code + show URL | 1 hari |
| 3.14 | Notification Bell | `src/lib/components/shared/NotificationBell.svelte` | Real-time count di TopBar | 1 hari |
| 3.15 | Notification Feed | `src/lib/components/shared/NotificationFeed.svelte` | Recent messages list | 0.5 hari |

**Total Gate 3 frontend**: ~12 hari kerja

---

### Gate 4 — Manager Dashboard + Analytics (Sprint 8-9, ~17 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 4.1 | Dashboard API wrapper | `src/lib/api/dashboard.ts` | manager dashboard | 0.5 hari |
| 4.2 | Analytics API wrapper | `src/lib/api/analytics.ts` | sales, inventory, finance | 0.5 hari |
| 4.3 | Reports API wrapper | `src/lib/api/reports.ts` | sales, inventory, finance | 0.5 hari |
| 4.4 | Settings API wrapper | `src/lib/api/settings.ts` | outlet, hours, system | 0.5 hari |
| 4.5 | KPI Strip | `src/lib/components/manager/Beranda/KpiStrip.svelte` | 5 KPI cards | 1 hari |
| 4.6 | Revenue Chart | `src/lib/components/manager/Beranda/RevenueChart.svelte` | Line chart 7 hari | 1 hari |
| 4.7 | Best Sellers Card | `src/lib/components/manager/Beranda/BestSellersCard.svelte` | Top 3 | 0.5 hari |
| 4.8 | Inventory Summary | `src/lib/components/manager/Beranda/InventorySummary.svelte` | KPI inventaris | 0.5 hari |
| 4.9 | Finance Summary | `src/lib/components/manager/Beranda/FinanceSummary.svelte` | KPI keuangan | 0.5 hari |
| 4.10 | Approval Queue | `src/lib/components/manager/Beranda/ApprovalQueue.svelte` | Pending SJ list | 0.5 hari |
| 4.11 | Notification Feed Manager | `src/lib/components/manager/Beranda/NotificationFeed.svelte` | Compose | 0.5 hari |
| 4.12 | Manager Beranda Screen | `src/routes/(manager)/manager/beranda/+page.svelte` | Compose | 1 hari |
| 4.13 | Sales Analytics | `src/lib/components/manager/Penjualan/SalesAnalytics.svelte` | Time series + breakdown + insight | 1.5 hari |
| 4.14 | Penjualan Screen | `src/routes/(manager)/manager/penjualan/+page.svelte` | Compose | 0.5 hari |
| 4.15 | Inventory Analytics | `src/lib/components/manager/Inventaris/InventoryAnalytics.svelte` | Fast moving + kritis + nilai | 1.5 hari |
| 4.16 | Inventaris Manager Screen | `src/routes/(manager)/manager/inventaris/+page.svelte` | Compose | 0.5 hari |
| 4.17 | Finance Analytics | `src/lib/components/manager/Keuangan/FinanceAnalytics.svelte` | Laba rugi + hutang + sumber + pengeluaran | 2 hari |
| 4.18 | Keuangan Screen | `src/routes/(manager)/manager/keuangan/+page.svelte` | Compose | 0.5 hari |
| 4.19 | Chart Components (Layer) | `src/lib/components/shared/charts/*.svelte` | LineChart, BarChart, PieChart reusable | 1 hari |
| 4.20 | Insight Card | `src/lib/components/shared/InsightCard.svelte` | Auto-generated text card | 0.5 hari |

**Total Gate 4 frontend**: ~16 hari kerja

---

### Gate 5 — HR + Laporan + Export (Sprint 10, ~12 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 5.1 | Employees API wrapper | `src/lib/api/employees.ts` | list, get, performance | 0.5 hari |
| 5.2 | Attendances API wrapper | `src/lib/api/attendances.ts` | summary | 0.5 hari |
| 5.3 | Leave API wrapper | `src/lib/api/leave.ts` | list, approve, reject | 0.5 hari |
| 5.4 | Employee List | `src/lib/components/manager/Karyawan/EmployeeList.svelte` | Tabel dengan stats | 1 hari |
| 5.5 | Employee Detail | `src/lib/components/manager/Karyawan/EmployeeDetail.svelte` | Performa history | 1 hari |
| 5.6 | Attendance Summary | `src/lib/components/manager/Karyawan/AttendanceSummary.svelte` | Today + period | 0.5 hari |
| 5.7 | Leave Requests List | `src/lib/components/manager/Karyawan/LeaveRequests.svelte` | Approve/reject actions | 1 hari |
| 5.8 | Performance Chart | `src/lib/components/manager/Karyawan/PerformanceChart.svelte` | Bar chart per karyawan | 0.5 hari |
| 5.9 | Karyawan Screen | `src/routes/(manager)/manager/karyawan/+page.svelte` | Compose | 0.5 hari |
| 5.10 | Business Analytics | `src/lib/components/manager/Laporan/BusinessAnalytics.svelte` | KPI outlet + insight | 1.5 hari |
| 5.11 | Laporan Manager Screen | `src/routes/(manager)/manager/laporan/+page.svelte` | Compose | 0.5 hari |
| 5.12 | Export PDF Flow (all) | `src/lib/components/shared/ExportPdfButton.svelte` | Trigger + poll + download | 1 hari |
| 5.13 | PDF Job Polling | `src/lib/utils/pdf-job-poller.ts` | Long-running job status check | 0.5 hari |

**Total Gate 5 frontend**: ~10 hari kerja

---

### Gate 6 — AI Assistant MVP (Sprint 11, ~5 hari kerja)

| # | Task | File | Detail | Estimasi |
|---|------|------|--------|----------|
| 6.1 | AI API wrapper | `src/lib/api/ai.ts` | chat, list conversations, get, activity, insights | 0.5 hari |
| 6.2 | AI Chat UI | `src/lib/components/manager/AI/AIChat.svelte` | Textarea + submit + response | 1.5 hari |
| 6.3 | Conversation History | `src/lib/components/manager/AI/AIConversationList.svelte` | Sidebar dengan list | 0.5 hari |
| 6.4 | AI Activity | `src/lib/components/manager/AI/AIActivity.svelte` | Recent prompts | 0.5 hari |
| 6.5 | AI Insights Chips | `src/lib/components/manager/AI/AIInsights.svelte` | Quick action chips | 0.5 hari |
| 6.6 | AI Control Center | `src/lib/components/manager/AI/AIControlCenter.svelte` | Settings + status | 0.5 hari |
| 6.7 | AI Assistant Screen | `src/routes/(manager)/manager/ai/+page.svelte` | Compose | 1 hari |

**Total Gate 6 frontend**: ~5 hari kerja

---

### Gate 7 — Polish & Deploy (Sprint 12-13, ~19 hari kerja)

| # | Task | Detail | Estimasi |
|---|------|--------|----------|
| 7.1 | Playwright E2E tests | Setup + critical flows per role | 5 hari |
| 7.2 | Accessibility audit | WCAG AA check + fix | 2 hari |
| 7.3 | Performance audit | Lighthouse + bundle optimization | 2 hari |
| 7.4 | Cross-browser test | Chrome, Edge, Safari, Firefox | 2 hari |
| 7.5 | Responsive refinement | Tablet 10" optimization (POS especially) | 2 hari |
| 7.6 | Error boundary + offline UI | Network error handling | 2 hari |
| 7.7 | Loading skeletons | Per-screen skeleton states | 2 hari |
| 7.8 | Production deploy | Vercel/Netlify + env config + custom domain | 2 hari |

**Total Gate 7 frontend**: ~19 hari kerja

## 5. Sub-task Tambahan (Ongoing)

Sepanjang project, ada sub-task maintenance:

| Task | Frequency | Detail |
|------|-----------|--------|
| Update shadcn-svelte components | Setiap ada update | `bunx shadcn-svelte update` |
| Dependency update | Mingguan | `bun update` + test |
| Type sync dengan backend | Setiap API contract berubah | Update `src/lib/types/domain.ts` |
| Storybook (Asumsi) | Opsional | Component playground untuk QA |
| Design system review | Setiap gate | Verifikasi compliance tokens |
| Bug triage | Harian | Sort by severity + user impact |

## 6. Testing Strategy (Frontend)

### 6.1 Unit Tests (Vitest)
- Stores: `cart.svelte.ts`, `auth.svelte.ts`, `notifications.svelte.ts`
- Utils: `format.ts`, `validation.ts`, `pdf-job-poller.ts`
- Custom hooks / derived state

### 6.2 Component Tests (@testing-library/svelte)
- Per-component: props, events, rendering
- Focus pada komponen dengan logic complex:
  - `ProductCatalog.svelte` (filter, search)
  - `PaymentModal.svelte` (state machine)
  - `OrderList.svelte` (filter, sort)
  - `ApprovalQueue.svelte` (action handlers)

### 6.3 E2E Tests (Playwright)
- **Critical flows wajib ada**:
  1. Kasir: login → start shift → POS transaksi → complete → end shift
  2. Kasir: void order dengan PIN
  3. Gudang: input PO → verifikasi → cek stok
  4. Gudang: buat barang keluar → buat SJ → submit
  5. Manager: approve SJ → cek Telegram log (mocked)
  6. Manager: chat AI (echo MVP)
  7. RBAC: kasir coba `/manager/beranda` → redirect

## 7. Performance Targets (Frontend)

| Metric                       | Target              |
|------------------------------|---------------------|
| First Contentful Paint       | < 1.5s              |
| Largest Contentful Paint      | < 2.5s              |
| Time to Interactive          | < 3s                |
| Bundle size (initial)        | < 200KB gzipped     |
| Lighthouse score             | > 90 (Performance, Accessibility, Best Practices) |
| API response handling p95    | < 300ms (termasuk SvelteKit `load`) |

## 8. Catatan Kolaborasi dengan Wafiq

- **API contract sync**: Setiap perubahan API di backend, update `src/lib/types/domain.ts` + API wrapper.
- **Mocking saat backend delay**: Pakai MSW (Mock Service Worker) untuk frontend dev tanpa backend ready.
- **Daily sync**: Singkat 5 menit dengan Wafiq untuk align blocker.
- **Code review**: Saling review PR untuk catch integration issue awal.

## 9. Open Questions

1. **PWA**: POS kasir perlu PWA untuk tablet? (Asumsi: tidak wajib MVP, bisa ditambah Gate 7)
2. **Storybook**: Perlu untuk component showcase? (Asumsi: tidak wajib MVP)
3. **i18n**: Indonesia only atau perlu English fallback? (Asumsi: ID only, struktur i18n tetap disiapkan)
4. **Dark mode**: Tetap light only per PRD, atau siapkan toggle? (Asumsi: light only, structure CSS variable siap untuk dark mode nanti)

---

**Akhir dokumen TASK_JAZLI_FRONTEND.md**
