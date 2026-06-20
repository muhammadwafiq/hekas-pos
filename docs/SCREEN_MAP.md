# SCREEN MAP — HEKAS POS

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Peta layar & navigasi per role
**Dasar**: `PRD.md` v1.0.0 + `FEATURE_MATRIX.md` v1.0.0 + `USER_FLOW.md` v1.0.0 + UI evidence (Stitch export Kasir + design components)
**Format**: ASCII tree + table per-role
**Catatan**: Semua path relatif terhadap SvelteKit routes (lihat `FRONTEND_ARCHITECTURE.md` §4)

---

## 1. Ringkasan

HEKAS POS memiliki **3 role** dengan pemisahan tegas (lihat FEATURE_MATRIX §18 + PRD §3):

| Role         | Jumlah Screen | Default Route     | Layout Group        |
|--------------|---------------|-------------------|---------------------|
| Kasir        | 7             | `/kasir/pos`      | `(kasir)`           |
| Admin Gudang | 5             | `/gudang/beranda` | `(gudang)`          |
| Manager      | 9             | `/manager/beranda`| `(manager)`         |

Total: **21 screen** (sesuai PRD §3 yang merujuk 21 file Stitch export).

## 2. Prinsip Umum

1. **Tidak ada cross-role navigation**: User role A tidak bisa navigate ke route role B (di-enforce via layout guard + RBAC middleware).
2. **Default route berbeda per role**: Setelah login, redirect sesuai role (lihat FRONTEND_ARCHITECTURE §6).
3. **Sidebar konsisten dalam role**: Setiap role punya sidebar tetap dengan item sesuai modulnya.
4. **Detail panel pattern**: Untuk list-detail pattern (Order, Surat Jalan, Member), gunakan split layout (list kiri, detail kanan).
5. **FAB untuk primary action**: Floating Action Button di kanan bawah untuk primary action per screen (Scan Barcode, Tambah Produk, dll).

## 3. Kasir — 7 Screen

**Tujuan role**: Operasional transaksi harian di kasir.

### 3.1 Daftar Halaman

| # | Path              | Nama         | Purpose (dari FEATURE_MATRIX §4)                                          | FAB Action        |
|---|-------------------|--------------|---------------------------------------------------------------------------|-------------------|
| 1 | `/kasir/pos`      | POS          | Scan barcode, filter kategori, search, input member, ringkasan pesanan    | Scan Barcode      |
| 2 | `/kasir/order`    | Order        | List order, detail, void, draft counter, search                          | (tidak ada)       |
| 3 | `/kasir/produk`   | Produk       | Lihat daftar produk, SKU, barcode, kategori, stok, harga, status         | (tidak ada)       |
| 4 | `/kasir/pelanggan`| Pelanggan    | Lihat daftar member, tier, poin, riwayat pembelian                       | Tambah Member     |
| 5 | `/kasir/shift`    | Shift        | List shift, start/end shift, handover, serah terima                      | Mulai Shift       |
| 6 | `/kasir/laporan`  | Laporan      | Ringkasan shift, metode bayar %, produk terlaris, total                  | Export PDF        |
| 7 | `/kasir/setting`  | Setting      | Profil, PIN, printer, devices, ringkasan sistem, aktivitas akun         | (tidak ada)       |

### 3.2 Hirarki & Navigasi

```
/kasir/pos (default)
├── (modal) Scan Barcode       → input barcode → add to cart
├── (modal) Payment            → pilih metode → konfirmasi → complete order
├── (modal) Member Search      → cari/attach member
├── (modal) Held Drafts        → list draft → resume → kembali ke POS
└── (modal) Discount           → input diskon

/kasir/order
├── /kasir/order?status=SELESAI → list filter status
├── /kasir/order?status=VOID    → list void orders
├── /kasir/order?status=DRAFT   → list held drafts
└── (panel) Detail Order        → muncul di kanan saat klik row
    ├── (action) Void           → PIN dialog → konfirmasi → status=VOID
    └── (action) Lihat          → expanded detail

/kasir/produk
├── /kasir/produk/:id           → detail produk + riwayat pergerakan stok
└── (panel) Produk Serupa       → muncul di bawah detail

/kasir/pelanggan
├── /kasir/pelanggan/:id        → detail member + riwayat pembelian + aktivitas
└── (modal) Tambah Member       → form create (Asumsi: hanya Manager yang bisa create, lihat FEATURE_MATRIX §5)

/kasir/shift
├── /kasir/shift/aktif          → redirect ke detail shift aktif
├── /kasir/shift/:id            → detail shift + summary
└── (modal) Mulai Shift         → input modal awal → status=AKTIF
└── (modal) Akhiri Shift        → PIN + modal akhir + handover (opsional)

/kasir/laporan
└── /kasir/laporan?period=today|week|month|custom
    └── (action) Export PDF     → generate → download

/kasir/setting
├── /kasir/setting/profil       → edit profil sendiri
├── /kasir/setting/pin          → ubah PIN (modal)
├── /kasir/setting/printer      → config printer struk
├── /kasir/setting/devices      → list perangkat terhubung
└── /kasir/setting/sistem       → ringkasan sistem (read-only)
```

### 3.3 Hubungan Antar Screen

- **POS ↔ Order**: Hold draft di POS → counter naik di header POS → resume dari Order list.
- **POS ↔ Member**: Input ID Member di POS → validasi → attach. Lihat detail dari Order detail panel.
- **Shift ↔ Laporan**: Laporan default adalah shift hari ini. End shift → laporan ter-update.
- **Produk ↔ Order**: Order detail panel bisa klik produk → ke Produk detail.

## 4. Admin Gudang — 5 Screen

**Tujuan role**: Kelola keluar-masuk barang, inventaris, surat jalan.

### 4.1 Daftar Halaman

| # | Path                          | Nama            | Purpose (dari FEATURE_MATRIX §4)                                                  | FAB Action         |
|---|-------------------------------|-----------------|-----------------------------------------------------------------------------------|--------------------|
| 1 | `/gudang/beranda`             | Beranda Gudang  | Ringkasan hari ini, tugas, prioritas stok, aktivitas, pengiriman                 | (tidak ada)        |
| 2 | `/gudang/inventaris`          | Inventaris      | List produk & stok, tambah, edit, restock, restock massal, export                | Tambah Produk      |
| 3 | `/gudang/barang-masuk`        | Barang Masuk    | List PO, input manual, verifikasi, aktivitas                                     | Input Barang Masuk |
| 4 | `/gudang/barang-keluar`       | Barang Keluar   | List barang keluar, proses picking, cetak SJ, alasan tertunda                    | Buat Barang Keluar |
| 5 | `/gudang/surat-jalan`         | Surat Jalan     | List SJ, review, setujui internal, cetak, cetak ulang                             | (tidak ada)        |

### 4.2 Hirarki & Navigasi

```
/gudang/beranda (default)
├── (card click) Stok Menipis    → /gudang/inventaris?filter=low_stock
├── (card click) Pengiriman      → /gudang/barang-keluar
├── (card click) Aktivitas       → expanded recent activity log
└── (action) Restock Massal      → modal bulk restock

/gudang/inventaris
├── /gudang/inventaris/:id       → detail produk + pergerakan stok
├── /gudang/inventaris?sort=stock_asc → urutkan stok terendah
├── (modal) Tambah Produk        → form create
├── (modal) Edit Produk          → form update
├── (modal) Restock              → single product restock
├── (modal) Restock Massal       → multi-select + bulk input
└── (action) Export Laporan Stok → download CSV/PDF

/gudang/barang-masuk
├── /gudang/barang-masuk/:id     → detail PO + items
├── /gudang/barang-masuk/baru    → form PO baru
└── (modal) Verifikasi PO        → input qty aktual per item

/gudang/barang-keluar
├── /gudang/barang-keluar/:id    → detail outgoing + items
├── /gudang/barang-keluar/baru   → form barang keluar baru
└── (modal) Proses Picking       → checklist per item

/gudang/surat-jalan
├── /gudang/surat-jalan/:id      → detail SJ + items + approval history
├── /gudang/surat-jalan/baru     → form buat SJ dari outgoing goods
└── (modal) Review & Setujui     → 2-stage approval: gudang internal review
└── (action) Cetak               → generate PDF
└── (action) Cetak Ulang         → reprint
```

### 4.3 Hubungan Antar Screen

- **Beranda → Inventaris**: Click "Stok Menipis" → filter list ke produk dengan stok rendah.
- **Barang Keluar → Surat Jalan**: Setelah picking selesai → otomatis atau manual create SJ dengan referensi.
- **Inventaris ↔ Barang Masuk**: PO verify → stok produk ter-update → muncul di Inventaris.
- **Surat Jalan → Manager**: Submit SJ → Manager terima notifikasi Telegram → approve/reject di route Manager.

## 5. Manager — 9 Screen

**Tujuan role**: Analitik bisnis, approval, SDM, konfigurasi sistem.

### 5.1 Daftar Halaman

| # | Path                          | Nama             | Purpose (dari FEATURE_MATRIX §4)                                                       | FAB Action      |
|---|-------------------------------|------------------|----------------------------------------------------------------------------------------|-----------------|
| 1 | `/manager/beranda`            | Beranda          | Dashboard operasional, KPI, 3 best sellers, ringkasan, approval queue, notifikasi      | (tidak ada)     |
| 2 | `/manager/penjualan`          | Penjualan        | Analisis penjualan, best sellers, ringkasan keuangan, insight                          | Export          |
| 3 | `/manager/inventaris`         | Inventaris       | Analisis inventaris, fast moving, stok kritis, nilai persediaan, insight              | Export          |
| 4 | `/manager/keuangan`           | Keuangan         | Analisis keuangan, laba rugi, hutang jatuh tempo, sumber pendapatan, insight          | Export          |
| 5 | `/manager/karyawan`           | Karyawan         | Manajemen, kehadiran, cuti/izin, performa, statistik SDM, insight                     | (tidak ada)     |
| 6 | `/manager/laporan`            | Laporan          | Dashboard analitik, top produk, KPI outlet, insight bisnis                            | Export PDF      |
| 7 | `/manager/surat-jalan`        | Surat Jalan      | List SJ, approval, review, cetak, insight                                              | (tidak ada)     |
| 8 | `/manager/ai`                 | AI Assistant     | Chat dengan HEKAS AI, aktivitas, insight chips, control center                        | (tidak ada)     |
| 9 | `/manager/pengaturan`         | Pengaturan       | Profil outlet, jam operasional, hak akses (locked), server, sistem, aktivitas         | (tidak ada)     |

### 5.2 Hirarki & Navigasi

```
/manager/beranda (default)
├── (KPI card) Pendapatan         → /manager/penjualan
├── (KPI card) Staff Aktif       → /manager/karyawan
├── (card) Perlu Persetujuan      → /manager/surat-jalan?status=MENUNGGU_APPROVAL
├── (card) Notifikasi Telegram   → expanded feed
└── (card) Best Sellers           → /manager/penjualan?view=best_sellers

/manager/penjualan
├── /manager/penjualan?period=today|week|month|custom
└── (chart) Time Series Revenue   → drill-down per hari
└── (list) Produk Terlaris        → expanded table

/manager/inventaris
├── /manager/inventaris?view=fast_moving
├── /manager/inventaris?view=critical
└── (list) Nilai Persediaan       → expanded detail per kategori

/manager/keuangan
├── (tab) Laba Rugi               → detail income/expense
├── (tab) Hutang Jatuh Tempo      → list hutang + jatuh tempo date
├── (tab) Sumber Pendapatan       → chart breakdown
└── (tab) Pengeluaran             → top expenses

/manager/karyawan
├── /manager/karyawan/:id         → detail karyawan + performa history
├── (list) Cuti & Izin            → action approve/reject
└── (modal) Detail Pengajuan       → input catatan

/manager/laporan
├── /manager/laporan?period=...&type=business|operational|kpi
└── (action) Export PDF           → generate

/manager/surat-jalan
├── /manager/surat-jalan?status=MENUNGGU_APPROVAL  → filter pending
├── /manager/surat-jalan/:id      → detail SJ + review
└── (action) Setujui              → update status + telegram ke gudang
└── (action) Tolak                → input alasan + telegram ke gudang

/manager/ai
├── /manager/ai/conversations/:id → chat history detail
├── (chip) Insight Cepat          → pre-defined prompt
└── (form) Prompt Input           → submit → response (MVP echo)

/manager/pengaturan
├── /manager/pengaturan/outlet    → edit profil outlet
├── /manager/pengaturan/jam       → edit jam operasional per hari
├── /manager/pengaturan/hak-akses → (read-only, locked)
├── /manager/pengaturan/server    → info server & DB
└── /manager/pengaturan/sistem    → ringkasan sistem
```

### 5.3 Hubungan Antar Screen

- **Beranda → Surat Jalan**: Click "Perlu Persetujuan" → ke list SJ pending.
- **Penjualan ↔ Inventaris**: Top selling product di penjualan → cek inventaris (fast moving / stock kritis).
- **Karyawan → Cuti/Izin**: Action approve/reject → update status + notifikasi ke karyawan (Asumsi Tahap 2).
- **AI Assistant → Modul lain**: Quick insight chip navigate ke modul terkait (Asumsi Tahap 2).

## 6. Cross-Role Navigation (Tidak Ada)

Per PRD §3 + FEATURE_MATRIX §18, **tidak ada cross-role navigation**. Masing-masing role punya layout group terpisah.

Layout guard enforce:

```typescript
// src/routes/(kasir)/+layout.ts
if (user.role !== 'kasir') {
  throw redirect(302, roleHomePath(user.role));
}
```

Jika user role A coba akses route role B (mis. `/manager/beranda` sebagai kasir):
- Backend API: 403 Forbidden (lihat BACKEND_ARCHITECTURE §5 RBAC).
- Frontend: Layout guard redirect ke default route role-nya.

## 7. Cross-Screen Flow (E2E)

Beberapa flow melewati banyak screen dari beberapa role. Dokumentasi visual:

### 7.1 Surat Jalan Approval Flow

```
ADMIN GUDANG:                          MANAGER:
──────────                             ───────
/gudang/barang-keluar (buat)
   ↓
/gudang/barang-keluar/:id (picking)
   ↓
/gudang/surat-jalan/baru
   ↓
(gudang internal review)
   ↓
[submit] → Telegram: "SJ perlu approval"  →  /manager/beranda
                                                  ↓
                                           (lihat notifikasi)
                                                  ↓
                                          /manager/surat-jalan?status=MENUNGGU_APPROVAL
                                                  ↓
                                          /manager/surat-jalan/:id (review)
                                                  ↓
                                          [Setujui] → status=DISETUJUI
                                                  ↓
[Telegram: "SJ disetujui"]              ←
   ↓
/gudang/surat-jalan/:id
   ↓
[Cetak SJ] → PDF download
   ↓
[Kirim barang] → mark TERKIRIM
```

### 7.2 POS Transaction Flow

```
KASIR:
──────
/login (1 endpoint, auto-detect role)
   ↓ (role=kasir)
/kasir/pos (default)
   ↓
[Scan / klik produk] → cart bertambah
   ↓
[Opsional: attach member]
   ↓
[Pilih metode bayar] → Payment modal
   ↓
[Konfirmasi] → /api/orders/:id/complete
   ↓
[Cetak struk] → reset POS
   ↓
(transaksi berikutnya atau end shift)
```

### 7.3 Stock Restock Flow

```
ADMIN GUDANG:
─────────────
/gudang/inventaris (lihat stok menipis)
   ↓
[Restock Massal] → modal multi-select
   ↓
[Submit] → /api/products/restock-bulk
   ↓
(stok updated + stock_movements)
   ↓
[Trigger] Telegram "stok_kritis" jika masih <= min → Manager receive

ATAU

/gudang/barang-masuk (PO baru)
   ↓
/gudang/barang-masuk/:id (verifikasi)
   ↓
[Submit] → /api/incoming-goods/:id/verify
   ↓
(stok updated, PO verified)
   ↓
[Telegram] "po_verified" → Manager + Gudang
```

## 8. Component Pattern per Screen

### 8.1 List-Detail Pattern (Order, Surat Jalan, Member, Karyawan)

```
┌─────────────────────────────────────────────────────────┐
│ Top Bar                                                 │
├────────────────────┬────────────────────────────────────┤
│                    │                                    │
│  List (kiri)       │  Detail Panel (kanan)              │
│  ───────────────   │  ─────────────────────             │
│  [Search]          │  Header: Title + Status Badge      │
│  [Filter chips]    │  Metadata: Date, User, dll         │
│  Row 1 (selected)  │  Tabs: Items | History | Activity  │
│  Row 2             │  Content                           │
│  Row 3             │  Actions (bottom): Void | Print    │
│  ...               │                                    │
│  [Pagination]      │                                    │
│                    │                                    │
└────────────────────┴────────────────────────────────────┘
```

Implementasi: Grid layout `grid-cols-[400px_1fr]` atau responsive collapse ke stack di mobile.

### 8.2 Dashboard Pattern (Manager Beranda, Kasir Dashboard)

```
┌─────────────────────────────────────────────────────────┐
│ Top Bar                                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── KPI Strip (5 cards) ──────────────────────────┐   │
│  │ [Card 1] [Card 2] [Card 3] [Card 4] [Card 5]    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── Chart (penuh) ────────────────────────────────┐   │
│  │ Revenue Line Chart (7 hari)                     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─── 3 Best Sellers ─┐  ┌─── Inventaris Summary ──┐  │
│  │ [Product 1]       │  │ [Total value]           │  │
│  │ [Product 2]       │  │ [Stok kritis]           │  │
│  │ [Product 3]       │  │ [Restock perlu]         │  │
│  └────────────────────┘  └──────────────────────────┘  │
│                                                         │
│  ┌─── Approval Queue ─┐  ┌─── Notification Feed ───┐  │
│  │ [Pending 1]        │  │ [Notif 1]               │  │
│  │ [Pending 2]        │  │ [Notif 2]               │  │
│  └────────────────────┘  └──────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 8.3 POS Pattern (Kasir)

```
┌─────────────────────────────────────────────────────────┐
│ Top Bar: [Logo] [Shift Aktif #N] [Jam] [Profile] [Out] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── Categories (kiri) ─┐  ┌─── Cart (kanan) ──────┐  │
│  │ [Semua]               │  │ Subtitle: Order #TRX   │  │
│  │ [Minuman]             │  │ Item 1: Aqua x2  Rp8k  │  │
│  │ [Snack]               │  │ Item 2: Teh x1   Rp5k  │  │
│  │ [Sembako]             │  │ Item 3: ...            │  │
│  │ [Frozen]              │  │ ───────────────────    │  │
│  │ [Rokok]               │  │ Subtotal: Rp 13.000    │  │
│  │ [Lainnya]             │  │ Diskon:   Rp 0         │  │
│  └───────────────────────┘  │ Total:    Rp 13.000    │  │
│                             │                        │  │
│  ┌─── Search ───────────┐  │ [Draft] [Member] [Disc] │  │
│  │ [Cari produk...]    │  │ [BAYAR]                 │  │
│  └─────────────────────┘  └────────────────────────┘  │
│                                                         │
│  ┌─── Product Grid ──────────────────────────────────┐  │
│  │ [Card] [Card] [Card] [Card] [Card]                │  │
│  │ [Card] [Card] [Card] [Card] [Card]                │  │
│  │ [Card] [Card] [Card] [Card] [Card]                │  │
│  │ ...                                               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│                                  [FAB: Scan Barcode]    │
└─────────────────────────────────────────────────────────┘
```

## 9. Empty States

Setiap list/grid screen punya empty state dengan ilustrasi + CTA:

| Screen                          | Empty State                                            |
|---------------------------------|--------------------------------------------------------|
| `/kasir/order`                  | "Belum ada order hari ini. Mulai scan di POS."         |
| `/kasir/produk`                 | "Tidak ada produk ditemukan." (jika search)            |
| `/kasir/pelanggan`              | "Belum ada member terdaftar." (Asumsi read-only kasir) |
| `/gudang/inventaris`            | "Belum ada produk. Tambah produk baru."               |
| `/gudang/barang-masuk`          | "Belum ada PO. Input barang masuk manual."            |
| `/gudang/barang-keluar`         | "Belum ada barang keluar. Buat baru."                 |
| `/gudang/surat-jalan`           | "Belum ada surat jalan."                              |
| `/manager/surat-jalan?status=...`| "Tidak ada SJ menunggu persetujuan. 👍"               |
| `/manager/karyawan`             | "Belum ada karyawan terdaftar."                        |

## 10. Loading States

Setiap page transition atau data fetch:

- **Initial page load**: Skeleton (mirip layout final tapi tanpa data).
- **Search/filter**: Inline spinner di area list.
- **Action submit**: Button disabled + spinner.
- **Background job**: Toast "Sedang diproses..." → notifikasi saat selesai.

## 11. Responsive Behavior

Desktop-first (sesuai PRD §7 + UI evidence desktop). Breakpoint:

| Breakpoint | Behavior                                                       |
|------------|----------------------------------------------------------------|
| `< 640px`  | ❌ TIDAK DIDUKUNG (akan tampil warning "Gunakan layar lebih besar") |
| `640-1024px` | Sidebar collapse jadi hamburger, layout stack vertikal      |
| `≥ 1024px` | Layout penuh (default)                                         |

**Asumsi**: POS kasir pakai tablet/desktop ≥ 10 inch. Tidak ada mobile-first design.

## 12. Catatan & Cross-Reference

### 12.1 Cross-Reference

| Dokumen                                | Section                                                  |
|----------------------------------------|----------------------------------------------------------|
| `FEATURE_MATRIX.md`                    | §4 daftar fitur per role                                 |
| `USER_FLOW.md`                         | §2-4 flow per role, §5 E2E flow                          |
| `FRONTEND_ARCHITECTURE.md`             | §4 route map (paths), §5 layout, §6 auth flow            |
| `API_SPEC.md`                          | §5 endpoint per screen/domain                             |
| `DATABASE_DESIGN.md`                   | §3-4 entity per domain                                   |

### 12.2 Yang TIDAK Boleh Dilakukan

1. **Jangan tambah screen tanpa evidence UI**. Setiap screen harus muncul di Stitch export atau PRD.
2. **Jangan bikin cross-role shortcut**. Mis. tombol "Lihat sebagai Manager" untuk kasir = TIDAK.
3. **Jangan skip default route**. User harus selalu landing di default role-nya.
4. **Jangan hide FAB pada mobile**. FAB adalah primary action.

## 13. Open Questions

1. **Sidebar collapse state**: Apakah persist per user atau session only? (Asumsi: localStorage per browser)
2. **Filter URL params**: Apakah filter (status, date range) di-encode di URL untuk share? (Asumsi: ya, untuk shareable links)
3. **Recent items**: Tampilkan recently viewed order/product di dashboard? (Asumsi: tidak di MVP)
4. **Bookmarkable filters**: Quick filter presets ("Hari ini", "Minggu ini") — pakai chip atau dropdown? (Asumsi: chips)
5. **Drag-and-drop**: Untuk restock massal reorder items? (Asumsi: tidak di MVP, multi-select via checkbox cukup)

---

**Akhir dokumen SCREEN_MAP.md**
