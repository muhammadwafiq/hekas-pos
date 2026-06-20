# FEATURE MATRIX — HEKAS POS

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Dasar**: Ekstraksi langsung dari 21 file HTML Stitch + 3 DESIGN.md

---

## 1. Catatan Pembacaan

- ✅ = fitur **terbukti** muncul di UI evidence (heading, button, table, atau form field)
- 🔒 = fitur ada tapi **read-only** untuk role tersebut (data dari role lain)
- ➖ = fitur **tidak ada** untuk role ini (benar-benar tidak muncul di UI)
- **Enforcement**: Pemisahan fitur antar-role adalah HARD RULE. Tidak ada fitur monitoring/silhouette yang boleh melintasi role.

---

## 2. Modul POS (Kasir → Pelanggan → Pembayaran)

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Buka layar POS / keranjang transaksi          |  ✅   |     ➖       |   ➖    |
| Scan barcode produk                           |  ✅   |     ➖       |   ➖    |
| Filter kategori produk (semua + kategori)     |  ✅   |     ➖       |   ➖    |
| Search produk                                 |  ✅   |     ➖       |   ➖    |
| Input ID Member (attach member ke transaksi)  |  ✅   |     ➖       |   ➖    |
| Lihat ringkasan pesanan (subtotal, total)     |  ✅   |     ➖       |   ➖    |
| Pilih metode bayar (Tunai / QRIS / Debit)     |  ✅   |     ➖       |   ➖    |
| Simpan transaksi (komit stok)                 |  ✅   |     ➖       |   ➖    |
| Simpan sebagai draft order                    |  ✅   |     ➖       |   ➖    |

## 3. Modul Order / Transaksi

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Lihat daftar order                            |  ✅   |     🔒       |   🔒    |
| Lihat detail order                            |  ✅   |     🔒       |   🔒    |
| Search order (no trx/pelanggan/kasir/HP)      |  ✅   |     ➖       |   ➖    |
| Void order                                    |  ✅   |     ➖       |   ➖    |
| Lihat counter draft order (header badge)      |  ✅   |     ➖       |   ➖    |
| Resume draft order                            |  ✅   |     ➖       |   ➖    |
| Status badge (Selesai / Void / Draft)         |  ✅   |     🔒       |   🔒    |

> Catatan: Manager & Admin Gudang bisa MELIHAT order hanya sebagai data referensi (untuk laporan/operasional), tidak bisa membuat/void.

## 4. Modul Produk

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Lihat daftar produk                           |  ✅   |     ✅       |   🔒    |
| Lihat detail produk (SKU, barcode, harga)     |  ✅   |     ✅       |   🔒    |
| Lihat stok produk                             |  ✅   |     ✅       |   🔒    |
| Search produk (nama/SKU/barcode)              |  ✅   |     ✅       |   ➖    |
| Lihat riwayat pergerakan stok                 |  ✅   |     ✅       |   🔒    |
| Lihat produk serupa                           |  ✅   |     🔒       |   ➖    |
| Tambah produk baru                            |  ➖   |     ✅       |   ➖    |
| Edit produk                                   |  ➖   |     ✅       |   ➖    |
| Lihat foto produk                             |  🔒   |     ✅       |   🔒    |
| Restock produk                                |  ➖   |     ✅       |   ➖    |
| Restock massal                                |  ➖   |     ✅       |   ➖    |
| Unduh laporan stok                            |  ➖   |     ✅       |   🔒    |

## 5. Modul Pelanggan / Member

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Lihat daftar pelanggan                        |  ✅   |     ➖       |   🔒    |
| Lihat detail pelanggan                        |  ✅   |     ➖       |   🔒    |
| Search member (nama/HP/email/ID)              |  ✅   |     ➖       |   ➖    |
| Lihat tier member (Gold/Silver/Platinum)      |  ✅   |     ➖       |   🔒    |
| Lihat poin member                             |  ✅   |     ➖       |   🔒    |
| Lihat riwayat pembelian                       |  ✅   |     ➖       |   🔒    |
| Lihat aktivitas member terbaru                |  ✅   |     ➖       |   ➖    |

## 6. Modul Shift

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Lihat daftar shift                            |  ✅   |     ➖       |   🔒    |
| Lihat detail shift                            |  ✅   |     ➖       |   🔒    |
| Search shift (nama kasir/no shift/status)      |  ✅   |     ➖       |   ➖    |
| Start shift                                   |  ✅   |     ➖       |   ➖    |
| End shift (serah terima)                      |  ✅   |     ➖       |   ➖    |
| Lihat shift aktif (badge "Shift Aktif N")     |  ✅   |     ➖       |   🔒    |
| Lihat serah terima shift terbaru              |  ✅   |     ➖       |   🔒    |

## 7. Modul Laporan

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Laporan penjualan                             |  ✅   |     ➖       |   ✅    |
| Ringkasan shift hari ini                      |  ✅   |     ➖       |   ➖    |
| Ringkasan pembayaran (metode %)               |  ✅   |     ➖       |   ✅    |
| Produk terlaris                               |  ✅   |     ➖       |   ✅    |
| Top kategori penjualan                        |  ➖   |     ➖       |   ✅    |
| Export PDF                                    |  ✅   |     ✅       |   🔒    |
| Laporan inventaris                            |  ➖   |     ✅       |   ✅    |
| Laporan keuangan (laba rugi, hutang, dsb)     |  ➖   |     ➖       |   ✅    |
| KPI outlet                                    |  ➖   |     ➖       |   ✅    |
| Laporan operasional                           |  ➖   |     ➖       |   ✅    |

## 8. Modul Inventaris (Admin Gudang)

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Lihat daftar produk & stok                    |  🔒   |     ✅       |   🔒    |
| Tambah produk baru                            |  ➖   |     ✅       |   ➖    |
| Edit produk                                   |  ➖   |     ✅       |   ➖    |
| Lihat pergerakan stok terbaru                 |  ➖   |     ✅       |   ➒    |
| Lihat produk perlu restock                    |  ➖   |     ✅       |   🔒    |
| Restock / Restock Massal                      |  ➖   |     ✅       |   ➖    |
| Unduh laporan stok                            |  ➖   |     ✅       |   🔒    |
| Analisis inventaris                           |  ➖   |     ➖       |   ✅    |
| Produk fast moving                            |  ➖   |     ➖       |   ✅    |
| Produk stok kritis                            |  ➖   |     ➖       |   ✅    |
| Nilai persediaan                              |  ➖   |     ➖       |   ✅    |

## 9. Modul Barang Masuk (Admin Gudang)

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Lihat daftar barang masuk (PO)                |  ➖   |     ✅       |   🔒    |
| Input barang masuk manual                     |  ➖   |     ✅       |   ➖    |
| Verifikasi barang masuk                       |  ➖   |     ✅       |   ➖    |
| Lihat aktivitas gudang terbaru                |  ➖   |     ✅       |   🔒    |
| Lihat supplier                                |  ➖   |     ✅       |   🔒    |

## 10. Modul Barang Keluar (Admin Gudang)

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Lihat daftar barang keluar                    |  ➖   |     ✅       |   🔒    |
| Proses picking                                |  ➖   |     ✅       |   ➖    |
| Cetak Surat Jalan                             |  ➖   |     ✅       |   ✅    |
| Lihat alasan tertunda                         |  ➖   |     ✅       |   🔒    |

## 11. Modul Surat Jalan

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Lihat daftar SJ                               |  ➖   |     ✅       |   ✅    |
| Review SJ                                     |  ➖   |     ✅       |   ✅    |
| Setujui / Tolak SJ                            |  ➖   |     ➖       |   ✅    |
| Cetak SJ                                      |  ➖   |     ✅       |   ✅    |
| Cetak ulang SJ                                |  ➖   |     ✅       |   🔒    |
| Lihat SJ menunggu approval                    |  ➖   |     ✅       |   ✅    |
| Buat SJ baru (dari Brg Keluar)                |  ➖   |     ✅       |   ➖    |

## 12. Modul Keuangan (Manager)

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Analisis keuangan                             |  ➖   |     ➖       |   ✅    |
| Laba rugi                                     |  ➖   |     ➖       |   ✅    |
| Hutang jatuh tempo                            |  ➖   |     ➖       |   ✅    |
| Sumber pendapatan terbesar                    |  ➖   |     ➖       |   ✅    |
| Pengeluaran terbesar                          |  ➖   |     ➖       |   ✅    |
| Ringkasan keuangan (di dashboard)             |  ➖   |     ➖       |   ✅    |

## 13. Modul Penjualan (Manager)

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Analisis penjualan                            |  ➖   |     ➖       |   ✅    |
| 3 Best Sellers                                |  ➖   |     ➖       |   ✅    |
| Produk terlaris                               |  ➖   |     ➖       |   ✅    |
| Insight penjualan                             |  ➖   |     ➖       |   ✅    |

## 14. Modul Karyawan (Manager)

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Manajemen karyawan                            |  ➖   |     ➖       |   ✅    |
| Ringkasan kehadiran                           |  ➖   |     ➖       |   ✅    |
| Karyawan terbaik bulan ini                    |  ➖   |     ➖       |   ✅    |
| Pengajuan cuti & izin                         |  ➖   |     ➖       |   ✅    |
| Performa karyawan terbaik                     |  ➖   |     ➖       |   ✅    |
| Statistik SDM                                 |  ➖   |     ➖       |   ✅    |
| Insight karyawan                              |  ➖   |     ➖       |   ✅    |

## 15. Modul AI Assistant (Manager Only)

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Chat dengan HEKAS AI                          |  ➖   |     ➖       |   ✅    |
| Lihat aktivitas AI terbaru                    |  ➖   |     ➖       |   ✅    |
| Lihat insight cepat AI                        |  ➖   |     ➖       |   ✅    |
| AI Control Center                             |  ➖   |     ➖       |   ✅    |

> **HARD RULE**: AI Assistant hanya untuk Manager. Tidak ada "preview" atau "(monitoring)" untuk role lain.

## 16. Modul Setting

| Fitur                                         | Kasir | Admin Gudang | Manager |
|-----------------------------------------------|:-----:|:------------:|:-------:|
| Profil sendiri                                |  ✅   |     ✅       |   ✅    |
| Ubah PIN login                                |  ✅   |     ➖       |   ➖    |
| Printer struk                                 |  ✅   |     ➖       |   ➖    |
| Perangkat terhubung                           |  ✅   |     🔒       |   🔒    |
| Profil outlet                                 |  ➖   |     ➖       |   ✅    |
| Jam operasional                               |  ➖   |     ➖       |   ✅    |
| Hak akses pengguna                            |  ➖   |     ➖       |   ✅    |
| Server & database                             |  ➖   |     ➖       |   ✅    |
| Aktivitas akun                                |  ✅   |     🔒       |   ✅    |
| Ringkasan sistem                              |  ✅   |     🔒       |   ✅    |

## 17. Modul Notifikasi Telegram

| Event                                            | Penerima Notifikasi     |
|--------------------------------------------------|-------------------------|
| Surat jalan perlu approval                       | Manager                 |
| Surat jalan disetujui                            | Admin Gudang            |
| Surat jalan ditolak                              | Admin Gudang            |
| Stok produk kritis (stok ≤ min.stok)             | Admin Gudang + Manager  |
| Barang masuk berhasil diverifikasi               | Admin Gudang + Manager  |
| Laporan harian penjualan tersedia                | Manager                 |
| Shift kasir dimulai / diakhiri                   | Manager                 |
| Error sistem / integrasi                         | Manager                 |

Detail mekanisme → `TELEGRAM_INTEGRATION.md`.

## 18. Aturan Enforcement

1. **Tidak ada cross-role UI override**. Fitur seperti "lihat inventaris" di layar Manager BUKAN untuk Admin Gudang. Manager bisa lihat ringkasan operasional, Admin Gudang adalah OWNER penuh inventaris.
2. **Read-only reference** (🔒) untuk Manager di beberapa tabel = data agregat, bukan data mentah operasional.
3. **Tombol/aksi sensitif** (void, restock, approve SJ) WAJIB punya audit log.
4. **AI Assistant = Manager only**. Tidak ada shortcut untuk role lain (tidak ada "AI buat kasir").
5. **Pengaturan sistem** (jam operasional, hak akses, server) = Manager only. Kasir & Admin Gudang punya setting khusus role-nya.