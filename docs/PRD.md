# HEKAS POS — Product Requirements Document

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Source of Truth untuk fase implementasi
**Disusun oleh**: Solution Architect / Product Manager / System Analyst / Tech Lead
**Project root**: `/home/jazli/hekas-pos/`
**Sumber UI/UX**: 3 folder Stitch export (Kasir, Admin Gudang, Manager) di `/home/jazli/Downloads/`

---

## 1. Ringkasan Produk

**HEKAS POS** adalah sistem Point of Sale (POS) modern untuk minimarket (contoh: Duamart) dengan tiga peran operasional: **Kasir**, **Admin Gudang**, dan **Manager**. Sistem mengotomasi penjualan (kasir), manajemen gudang & inventaris (admin gudang), serta analitik bisnis, SDM, dan approval (manager).

Sistem terintegrasi penuh dengan notifikasi real-time via Telegram Bot untuk event-event operasional penting (surat jalan perlu approval, stok kritis, laporan harian, dll).

## 2. Tech Stack (FINAL)

| Layer            | Pilihan                                                                 |
|------------------|-------------------------------------------------------------------------|
| Frontend         | SvelteKit 5 + TypeScript + Tailwind CSS                                 |
| Runtime          | Bun                                                                     |
| Backend          | ElysiaJS (Bun)                                                          |
| Database         | PostgreSQL                                                              |
| ORM              | Drizzle ORM (pakai Drizzle Kit untuk schema/migrations)                |
| Background Jobs  | pg-boss (PostgreSQL-backed)                                             |
| Notifikasi       | Telegram Bot API                                                        |
| Auth             | JWT + PIN kasir (4-6 digit) untuk verifikasi shift                      |
| Payment UI       | Tunai, QRIS, Debit (basic, BUKAN payment gateway terintegrasi)          |
| AI               | Workspace chat AI (placeholder untuk LLM integration; tidak required MVP) |
| Deploy target    | Monorepo Bun workspaces                                                 |

## 3. Peran (Roles) — dari evidence UI

Tiga peran dengan pemisahan tanggung jawab yang KERAS (tidak overlap):

### 3.1 Kasir
Bertanggung jawab atas operasional transaksi harian di kasir.

**Layar** (7 screens dari folder `stitch_hekas_pos_role_kasir`):
- POS, Order, Produk, Pelanggan, Shift, Laporan, Setting

### 3.2 Admin Gudang
Bertanggung jawab atas keluar-masuk barang, inventaris, dan surat jalan.

**Layar** (5 screens dari folder `stitch_hekas_pos_role_admingudang`):
- Beranda Gudang, Barang Masuk, Barang Keluar, Surat Jalan, Inventaris

### 3.3 Manager
Bertanggung jawab atas analitik, approval, SDM, dan konfigurasi sistem.

**Layar** (9 screens dari folder `stitch_hekas_pos_role_manager`):
- Beranda Manager, Penjualan, Inventaris, Keuangan, Karyawan, Laporan, Surat Jalan, AI Assistant, Pengaturan

## 4. Daftar Fitur — Diverifikasi dari UI

Fitur di bawah ini 100% muncul di HTML UI; **tidak ada fitur di luar UI yang di-assume-kan**.

### 4.1 Modul Kasir

| Layar           | Fitur Tervalidasi                                                                                    |
|-----------------|------------------------------------------------------------------------------------------------------|
| POS             | Scan barcode, filter kategori produk, search produk, input ID Member, ringkasan pesanan, kategori "Semua" |
| Order           | Daftar order, detail transaksi, void, draft order (counter), search by nomor/pelanggan/kasir/HP, metode bayar (Tunai/QRIS/Debit), status (Selesai/Void) |
| Produk (view)   | Lihat daftar produk, SKU, barcode, kategori, stok, harga jual, status (Aktif/Stok Tipis/Habis), riwayat pergerakan stok, produk serupa |
| Pelanggan       | Daftar member (ID MBR-XXX), nama, No HP, tier (Gold/Silver/Platinum), poin, status, riwayat pembelian, aktivitas member |
| Shift           | Daftar shift (SHF-XXX), nama kasir, jam masuk/keluar, total transaksi, total penjualan, status (Aktif/Selesai), serah terima shift, detail shift |
| Laporan         | Ringkasan shift hari ini, ringkasan pembayaran (QRIS%, Tunai%, dll), produk terlaris, total transaksi & item, export PDF |
| Setting         | Profil kasir, PIN login, printer struk, perangkat terhubung, ringkasan sistem, aktivitas akun, shortcut pengaturan |

### 4.2 Modul Admin Gudang

| Layar          | Fitur Tervalidasi                                                                                  |
|----------------|----------------------------------------------------------------------------------------------------|
| Beranda        | Ringkasan gudang hari ini, tugas gudang hari ini, prioritas stok menipis, aktivitas terbaru, pengiriman & supplier |
| Inventaris     | Daftar produk & stok (foto, SKU, nama, kategori, stok saat ini, min. stok, harga beli, status), pergerakan stok terbaru, produk perlu restock, tambah produk, edit, unduh laporan stok, urutkan (Stok Terendah), restock massal, restock |
| Barang Masuk   | Daftar PO (No SJ/PO, supplier, tanggal kirim, jumlah item, status), input manual barang masuk, verifikasi, aktivitas gudang terbaru |
| Barang Keluar  | Daftar barang keluar (No SJ/ORD, tujuan, tanggal keluar, jumlah item, status), proses picking, cetak SJ, lihat alasan tertunda |
| Surat Jalan    | Daftar SJ (No SJ, referensi ORD/TRX, tujuan, jumlah item, tanggal, status), review & setujui, cetak, cetak ulang, surat jalan menunggu approval |

### 4.3 Modul Manager

| Layar           | Fitur Tervalidasi                                                                                  |
|-----------------|----------------------------------------------------------------------------------------------------|
| Beranda         | Dashboard operasional, ringkasan penjualan, best sellers (3), ringkasan inventaris, ringkasan keuangan, logistik & operasional, perlu persetujuan |
| Penjualan       | Analisis penjualan, ringkasan penjualan, best sellers, produk terlaris, ringkasan keuangan, insight penjualan |
| Inventaris      | Analisis inventaris, produk fast moving, produk stok kritis, produk terlaris, nilai persediaan, insight inventaris |
| Keuangan        | Analisis keuangan, laba rugi, hutang jatuh tempo, sumber pendapatan terbesar, pengeluaran terbesar, insight keuangan |
| Karyawan        | Manajemen karyawan, ringkasan kehadiran, karyawan terbaik bulan ini, pengajuan cuti & izin, performa, statistik SDM, insight |
| Laporan         | Dashboard laporan & analitik bisnis, top produk terlaris, top kategori penjualan, ringkasan KPI outlet, ringkasan laporan operasional, insight bisnis |
| Surat Jalan     | Manajemen SJ, daftar terbaru, menunggu persetujuan, aktivitas harian, insight pengiriman |
| AI Assistant    | Chat dengan HEKAS AI (textarea prompt), AI Control Center, aktivitas AI terbaru, insight cepat AI |
| Pengaturan      | Profil outlet, jam operasional, hak akses pengguna (Terkunci), server & database, ringkasan sistem, aktivitas akun admin, shortcut pengaturan |

## 5. Design System (Identik untuk Ketiga Role)

Dari `DESIGN.md` (sama persis di ketiga folder):

- **Color tokens**: Material 3-style tokens
  - `primary`: `#00288e` (deep blue)
  - `primary-container`: `#1e40af`
  - `on-primary`: `#ffffff`
  - `surface`: `#f8f9ff`
  - `background`: `#f8f9ff`
  - `error`: `#ba1a1a`
  - `on-surface`: `#0b1c30`
  - `outline`: `#757684`
- **Typography**: Inter (headline, body, label, numeral scales)
  - `headline-lg`: 30px / 700 / 38px line-height
  - `headline-md`: 24px / 600 / 32px
  - `headline-sm`: 20px / 600 / 28px
  - `body-lg/md/sm`: 18/16/14 px
  - `numeral-xl`: 36px / 700 / 44px (untuk angka besar di dashboard)
- **Layout patterns**: Sidebar nav (kiri), content area, top-bar dengan breadcrumb/profil, FAB untuk primary action (scan barcode, draft order, dll)
- **Roundness**: `ROUND_EIGHT` (8px)
- **Color mode**: LIGHT only (tidak ada dark mode di UI evidence)

## 6. Workflow Bisnis Inti

### 6.1 Sirkulasi Stok
```
Supplier → PO → Barang Masuk (verifikasi) → Inventaris (stok bertambah)
                                                  ↓
                                       Kasir jual di POS
                                                  ↓
                                       Stok berkurang (auto)
                                                  ↓
                              Admin Gudang → Barang Keluar (antar cabang) → Surat Jalan
                                                  ↓
                                            Manager Approve
                                                  ↓
                                          Cetak & Kirim
```

### 6.2 Sirkulasi Order
```
Kasir buka POS → scan/select produk → ID Member (opsional) → ringkasan pesanan
                                                       ↓
                                                  Pilih metode bayar
                                                       ↓
                                              Simpan transaksi
                                                       ↓
                                            Stok berkurang (atomic)
                                                       ↓
                                       Tercatat di Order + Shift + Laporan
```

### 6.3 Sirkulasi Approval
```
Admin Gudang buat Surat Jalan (referensi ORD/TRX)
            ↓
Status: Menunggu Approval
            ↓
Manager review di Layar Surat Jalan
            ↓
Setuju → Status: Disetujui → Cetak SJ
Tolak  → Status: Ditolak → Kembali ke Admin Gudang
```

## 7. Non-Goals (Eksplisit)

Berdasarkan evidence UI, fitur-fitur ini **TIDAK** ada dan TIDAK dibangun di MVP:

- Multi-outlet / multi-cabang management (UI referensi hanya "Cabang Bandung/Bogor/Depok" sebagai tujuan SJ)
- Konfigurasi loyalty/poin rules dinamis (UI hanya tampilkan tier statis Gold/Silver/Platinum)
- Payment gateway online (Midtrans/Xendit) — UI hanya Tunai/QRIS/Debit (basic)
- Mobile native app (UI prototype desktop)
- Dark mode (design system LIGHT only)
- Integrasi e-Faktur / perpajakan
- HRIS lengkap (payroll, PPh 21) — UI hanya cuti/izin/performa
- Predictive analytics / ML forecasting
- Customer-facing e-commerce / online shop
- Multi-currency / multi-language

## 8. Acceptance Criteria

- [ ] Setiap role hanya dapat mengakses layar sesuai divisinya (enforced via RBAC)
- [ ] Transaksi POS atomic: stok berkurang + transaksi tercatat + shift ter-update dalam 1 transaksi DB
- [ ] Draft order tersimpan dan dapat di-resume oleh kasir yang sama
- [ ] Void order hanya oleh kasir yang membuat ATAU manager
- [ ] Surat jalan tidak bisa di-cetak sebelum di-approve manager
- [ ] Telegram notifikasi terkirim untuk: (a) surat jalan perlu approval, (b) stok kritis, (c) laporan harian
- [ ] Export PDF laporan kasir per shift tersedia
- [ ] AI Assistant menerima prompt dan menampilkan response (LANGKAH 2; MVP tanpa LLM real cukup echo "AI belum tersedia")
- [ ] Semua warna/typography mengikuti design tokens (tidak ada hardcode)
- [ ] Sistem offline-tolerant: jika Telegram down, event di-buffer dan di-retry saat online

## 9. Out-of-Scope untuk MVP (Tahap 2)

- LLM real integration di AI Assistant
- Integrasi payment gateway online
- Multi-outlet
- Customer-facing online shop
- Predictive analytics
- E-Faktur

## 10. Referensi Silang

- Layar per-role detail → `FEATURE_MATRIX.md`
- User flow → `USER_FLOW.md`
- Skema database → `DATABASE_DESIGN.md` + `ERD.md`
- API endpoints → `API_SPEC.md`
- Arsitektur frontend → `FRONTEND_ARCHITECTURE.md`
- Arsitektur backend → `BACKEND_ARCHITECTURE.md`
- Telegram integration → `TELEGRAM_INTEGRATION.md`
- Roadmap → `DEVELOPMENT_ROADMAP.md`
- Pembagian tugas → `TASK_JAZLI_FRONTEND.md` + `TASK_WAFIQ_BACKEND.md`
- Checklist → `IMPLEMENTATION_CHECKLIST.md`