# USER FLOW — HEKAS POS

**Versi**: 1.0.0
**Dasar**: Semua flow berasal dari screens & interactions yang muncul di HTML Stitch.

---

## 1. Flow Umum (Semua Role)

```
[Start] → Login → Dashboard per-role → Logout → [End]
```

### 1.1 Login
- **Trigger**: Buka aplikasi pertama kali atau setelah logout
- **Input**: Username + Password
- **Output**:
  - Role teridentifikasi dari kredensial
  - Redirect ke dashboard sesuai role:
    - Kasir       → `/kasir/pos`
    - Admin Gudang → `/gudang/beranda`
    - Manager     → `/manager/beranda`
- **Catatan**: UI evidence tidak menampilkan halaman login eksplisit. Asumsi: 1 endpoint `/login` dengan auto-detect role (sesuai memory: HEKAS POS pakai 1 login page, bukan 3).

### 1.2 Logout
- **Trigger**: Klik tombol "Keluar" di sidebar (ada di setiap screen evidence)
- **Output**: Session invalidated, redirect ke `/login`

---

## 2. Flow Kasir — Transaksi POS

### 2.1 Flow Utama: Selesaikan Transaksi (Happy Path)
```
[Buka POS] 
    → [Tambah produk ke keranjang]
        • Scan barcode (FAB Scan Barcode), ATAU
        • Klik produk dari daftar, ATAU
        • Search produk (input "Cari produk...")
    → [Opsional: Input ID Member] (lampirkan pelanggan)
    → [Lihat Ringkasan Pesanan]
        • Subtotal, total item, diskon (jika ada), grand total
    → [Pilih Metode Pembayaran]
        • Tunai / QRIS / Debit
    → [Konfirmasi Pembayaran]
    → [Simpan Transaksi]
    → [Cetak Struk ke Printer]
    → [Reset POS untuk transaksi berikutnya]
```

### 2.2 Flow: Simpan sebagai Draft
```
[Buka POS]
    → [Tambah produk]
    → [Klik "Simpan Draft" / tombol draft]
    → [Draft tersimpan, counter "Draft Order" di header naik]
    → [Bisa di-resume dari menu Order dengan filter Draft]
```

### 2.3 Flow: Lihat Detail Order
```
[Buka Order]
    → [Pilih baris order di tabel]
    → [Panel detail muncul di kanan]
        • No Transaksi
        • Tanggal & waktu
        • Pelanggan
        • Kasir
        • Daftar Item
        • Total
        • Metode bayar
        • Status (Selesai / Void / Draft)
    → [Aksi: Void / Lihat]
```

### 2.4 Flow: Void Transaksi
```
[Buka Order] → [Pilih order dengan status "Selesai"]
    → [Klik tombol Void]
    → [Konfirmasi dengan PIN kasir]
    → [Status berubah ke "Void"]
    → [Stok produk dikembalikan ke inventaris]
    → [Audit log tercatat]
```

> Catatan: UI hanya menampilkan tombol Void; dialog konfirmasi + PIN tidak di-render eksplisit di HTML, tapi WAJIB ada untuk compliance (lihat PRD acceptance criteria).

### 2.5 Flow: Shift Kasir
```
[Buka Shift]
    → [Lihat shift aktif] (badge "Shift Aktif N")
    → [Mulai shift baru]
        • Klik "Mulai Shift"
        • Input modal awal (tidak di-render, tapi WAJIB)
        • Status: Aktif
    → [Kerja kasir]
    → [Akhiri shift]
        • Klik "Akhiri Shift"
        • Input modal akhir
        • Hitung selisih (otomatis sistem)
        • Serah terima ke kasir berikutnya (opsional)
        • Status: Selesai
```

### 2.6 Flow: Laporan Kasir
```
[Buka Laporan]
    → [Pilih rentang tanggal] (filter, default "Hari Ini")
    → [Lihat Ringkasan Laporan]
        • Total transaksi
        • Total item terjual
        • Total penjualan
        • Metode pembayaran (chart + %)
        • Produk terlaris
        • Ringkasan shift hari ini
    → [Export PDF] → file terunduh
```

---

## 3. Flow Admin Gudang

### 3.1 Flow Utama: Penerimaan Barang Masuk (PO)
```
[Buka Barang Masuk]
    → [Lihat daftar PO]
        • No SJ / PO
        • Supplier
        • Tanggal Kirim
        • Jumlah Item (Unit, SKU)
        • Status (Menunggu Verifikasi / Terverifikasi / Ditolak)
    → [Klik Verifikasi pada PO]
        • Lihat detail item
        • Cocokkan dengan fisik
        • Input jumlah aktual per item
    → [Submit Verifikasi]
    → [Status → Terverifikasi]
    → [Stok bertambah otomatis]
    → [Telegram notifikasi ke Manager]
```

### 3.2 Flow: Barang Keluar (Antar Cabang)
```
[Buka Barang Keluar]
    → [Lihat daftar barang keluar]
    → [Pilih dengan status "Menunggu Picking"]
    → [Klik "Proses Picking"]
        • Pilih item yang akan di-pick
        • Tandai selesai per item
    → [Submit]
    → [Status berubah ke "Siap Dikirim"]
    → [Buat Surat Jalan otomatis dengan referensi]
    → [Kirim ke Manager untuk approval]
```

### 3.3 Flow: Surat Jalan (Approval dari Admin Gudang)
```
[Buka Surat Jalan]
    → [Lihat daftar SJ]
    → [Pilih SJ dengan status "Menunggu Approval"]
    → [Review detail]
        • Referensi ORD/TRX
        • Tujuan
        • Jumlah item
        • Catatan
    → [Aksi: Setujui (kirim ke Manager) / Tolak (kembalikan ke picker)]
```

> Catatan: UI menampilkan tombol "Review & Setujui" di layar Surat Jalan untuk Admin Gudang, TAPI keputusan akhir (approve/tolak) adalah MANAGER. Tombol Admin Gudang adalah persetujuan internal sebelum naik ke Manager. Ini membedakan 2-stage approval.

### 3.4 Flow: Inventaris
```
[Buka Inventaris]
    → [Lihat daftar produk & stok]
        • Foto, SKU, nama, kategori, stok saat ini, min. stok, harga beli, status
    → [Filter / Search / Urutkan (Stok Terendah)]
    → [Aksi per produk]
        • Edit → buka form edit (kategori, harga, min.stok, dll)
        • Restock → form input jumlah restock + supplier
    → [Aksi Massal]
        • Restock Massal → multi-select + input terpusat
        • Unduh Laporan Stok
    → [Tambah Produk Baru]
        • Form: SKU, nama, kategori, harga jual, harga beli, min. stok, foto
```

### 3.5 Flow: Beranda Gudang (Operational Dashboard)
```
[Buka Beranda]
    → [Lihat ringkasan]
        • Tugas gudang hari ini
        • Prioritas stok menipis (clickable → ke Inventaris)
        • Aktivitas terbaru (recent stock movements)
        • Pengiriman & supplier (recent activity)
    → [Aksi cepat: Lihat Semua / Restock Massal / Restock / Lihat Log]
```

---

## 4. Flow Manager

### 4.1 Flow Utama: Approve Surat Jalan
```
[Buka Surat Jalan]
    → [Lihat "Menunggu Persetujuan"]
    → [Klik baris SJ]
    → [Review detail]
        • Daftar item, tujuan, jumlah, referensi
    → [Keputusan]
        • Setujui → status "Disetujui" → trigger Telegram ke Admin Gudang
        • Tolak → isi alasan → status "Ditolak" → trigger Telegram ke Admin Gudang
```

### 4.2 Flow: Dashboard Manager (Beranda)
```
[Buka Beranda]
    → [Lihat Dashboard Operasional]
        • Ringkasan Penjualan (KPI cards)
        • 3 Best Sellers (top products)
        • Ringkasan Inventaris (stok value, items kritis)
        • Ringkasan Keuangan (revenue, margin)
        • Logistik & Operasional (SJ pending, brg masuk/kluar hari ini)
        • Perlu Persetujuan (count + clickable)
    → [Klik card "Perlu Persetujuan"] → redirect ke Surat Jalan
```

### 4.3 Flow: Analisis Penjualan
```
[Buka Penjualan]
    → [Pilih filter periode (hari/minggu/bulan/custom)]
    → [Lihat]
        • Ringkasan Penjualan (total, growth %)
        • 3 Best Sellers
        • Produk Terlaris (full list)
        • Ringkasan Keuangan
        • Insight Penjualan (auto-generated)
    → [Export jika perlu]
```

### 4.4 Flow: Analisis Inventaris
```
[Buka Inventaris]
    → [Pilih filter]
    → [Lihat]
        • Ringkasan Inventaris (total SKU, total nilai)
        • Produk Fast Moving
        • Produk Stok Kritis
        • Produk Terlaris
        • Nilai Persediaan
        • Insight Inventaris
```

### 4.5 Flow: Analisis Keuangan
```
[Buka Keuangan]
    → [Pilih filter periode]
    → [Lihat]
        • Ringkasan Keuangan
        • Laba Rugi
        • Hutang Jatuh Tempo
        • Sumber Pendapatan Terbesar
        • Pengeluaran Terbesar
        • Insight Keuangan
```

### 4.6 Flow: Manajemen Karyawan
```
[Buka Karyawan]
    → [Lihat]
        • Ringkasan Kehadiran (today)
        • Karyawan Terbaik Bulan Ini
        • Pengajuan Cuti & Izin (actionable list)
        • Performa Karyawan Terbaik
        • Statistik SDM
        • Insight Karyawan
    → [Aksi Cuti/Izin]
        • Setujui / Tolak (dengan catatan)
```

### 4.7 Flow: Laporan & Analitik Bisnis
```
[Buka Laporan]
    → [Pilih filter / rentang waktu]
    → [Lihat]
        • Ringkasan Performa Bisnis
        • Top Produk Terlaris
        • Top Kategori Penjualan
        • Ringkasan KPI Outlet
        • Ringkasan Laporan Operasional
        • Insight Bisnis
    → [Export PDF]
```

### 4.8 Flow: AI Assistant (Manager Only)
```
[Buka AI Assistant]
    → [Lihat Chat dengan HEKAS AI]
        • Textarea input: "Tanyakan tentang penjualan, stok, karyawan..."
    → [Ketik prompt]
    → [Submit]
    → [Response AI tampil di chat area]
    → [Aktivitas AI Terbaru] (recent prompts)
    → [Insight Cepat AI] (quick action chips)
```

> Catatan: MVP, AI Assistant cukup menampilkan echo dari input + placeholder "AI belum tersedia". Real LLM integration di Tahap 2.

### 4.9 Flow: Pengaturan Manager
```
[Buka Pengaturan]
    → [Lihat]
        • Profil Outlet
        • Jam Operasional
        • Hak Akses Pengguna (status: Terkunci)
        • Server & Database
        • Ringkasan Sistem
        • Aktivitas Akun Admin
    → [Edit per item] (klik tombol "edit")
```

---

## 5. Cross-Role Flow — Order Lifecycle (E2E)

```
KASIR                          ADMIN GUDANG                  MANAGER
─────                          ────────────                  ───────
[Buka POS]
[Buat transaksi]
[Simpan transaksi]
    → Stok berkurang
    → Tercatat di Order
    → Tercatat di Shift
    → Tercatat di Laporan
                            [Lihat aktivitas di Beranda]
                            [Lihat Inventaris ter-update]
[Tutup shift]
                            [Lakukan stock opname]
                            [Buat PO ke Supplier]
                                → Telegram ke Manager
                                                        [Lihat notif PO]
                                                        [Acknowledge]
[Supplier kirim barang]
                            [Verifikasi Brg Masuk]
                                → Stok bertambah
                                → Telegram ke Manager
                                                        [Lihat notif]
[Ada permintaan antar-cabang]
                            [Buat Brg Keluar]
                            [Proses Picking]
                            [Buat Surat Jalan]
                                → Status: Menunggu Approval
                                                        [Review SJ]
                                                        [Setujui]
                                ← Telegram ke Admin Gudang
                            [Cetak SJ]
[Kirim barang]
                            [Status: Sudah Dikirim]
                                                        [Lihat di Surat Jalan]
```

---

## 6. State Machines

### 6.1 Transaksi (Order)
```
[DRAFT] → [SELESAI] → [VOID]
   ↓
[DRAFT] bisa di-resume atau di-void langsung
```

### 6.2 Shift
```
[UPCOMING] → [AKTIF] → [SELESAI]
                          ↓
                     (auto-create rekap shift)
```

### 6.3 Surat Jalan
```
[MENUNGGU PICKING] → [MENUNGGU APPROVAL] → [DISETUJUI] → [SUDAH DICETAK] → [TERKIRIM]
                                  ↓
                              [DITOLAK] → (kembali ke picker / revisi)
                                  ↓
                              [TERTUNDA] (alasan dicatat)
```

### 6.4 Barang Masuk (PO)
```
[MENUNGGU VERIFIKASI] → [TERVERIFIKASI] (stok +)
                      → [DITOLAK] (stok unchanged, alasan dicatat)
```

## 7. Error Paths

| Situasi                          | Sistem behavior                                                                |
|----------------------------------|--------------------------------------------------------------------------------|
| Kasir input ID Member tidak ada  | POS tetap lanjut tanpa member attached                                        |
| Stok produk habis saat di-cart   | Tampilkan warning, item di-disable, kasir harus hapus dari cart               |
| Stok kurang dari qty di-cart     | Tampilkan warning saat checkout, konfirmasi kasir                             |
| Kasir lupa end-shift & tutup app | Shift auto-end saat logout dengan modal awal input sebelumnya                  |
| Manager reject SJ                | Admin Gudang dapat notifikasi + alasan, bisa revise & submit ulang            |
| Telegram Bot down                | Event di-buffer di DB, retry exponential backoff (max 5x)                      |
| PDF export timeout               | Generate background job, kasih link download setelah jadi                     |
| AI Assistant timeout             | Tampilkan error message, simpan prompt ke history untuk retry manual          |