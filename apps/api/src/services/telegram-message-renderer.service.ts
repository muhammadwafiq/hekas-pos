/**
 * Telegram message renderer — converts event payloads to readable Indonesian text.
 * Phase 4 Gate 3.
 */

export type TelegramEvent =
  | 'sj_pending_approval'
  | 'sj_approved'
  | 'sj_rejected'
  | 'stok_kritis'
  | 'po_verified'
  | 'daily_report_ready'
  | 'shift_started'
  | 'shift_ended'
  | 'system_error';

export function renderTelegramMessage(eventType: TelegramEvent, payload: Record<string, any>): string {
  switch (eventType) {
    case 'sj_pending_approval':
      return (
        `📋 <b>SURAT JALAN — Perlu Persetujuan</b>\n\n` +
        `No: ${payload.documentNumber}\n` +
        `Tujuan: ${payload.destination}\n` +
        `Penerima: ${payload.recipientName}\n` +
        `Total Item: ${payload.totalItems}\n\n` +
        `<i>Menunggu approval Manager di aplikasi HEKAS POS.</i>`
      );

    case 'sj_approved':
      return (
        `✅ <b>SURAT JALAN DISETUJUI</b>\n\n` +
        `No: ${payload.documentNumber}\n` +
        `Tujuan: ${payload.destination}\n` +
        `Penerima: ${payload.recipientName}\n` +
        `Disetujui oleh: ${payload.approvedBy}\n\n` +
        `<i>Silakan proses pengiriman.</i>`
      );

    case 'sj_rejected':
      return (
        `❌ <b>SURAT JALAN DITOLAK</b>\n\n` +
        `No: ${payload.documentNumber}\n` +
        `Tujuan: ${payload.destination}\n` +
        `Penerima: ${payload.recipientName}\n` +
        `Ditolak oleh: ${payload.rejectedBy}\n` +
        `Alasan: ${payload.reason}\n\n` +
        `<i>Silakan perbaiki dan submit ulang.</i>`
      );

    case 'stok_kritis':
      return (
        `⚠️ <b>STOK KRITIS</b>\n\n` +
        `Produk: ${payload.product_name}\n` +
        `SKU: ${payload.sku}\n` +
        `Stok saat ini: ${payload.current_stock}\n` +
        `Minimum: ${payload.min_stock}\n\n` +
        `<i>Segera lakukan restock.</i>`
      );

    case 'po_verified':
      return (
        `📦 <b>PO VERIFIED</b>\n\n` +
        `No: ${payload.documentNumber}\n` +
        `Supplier: ${payload.supplierName ?? '-'}\n` +
        `Total Item: ${payload.totalItems}\n` +
        `Verified by: ${payload.verifiedBy ?? '-'}\n\n` +
        `<i>Stok sudah diperbarui.</i>`
      );

    case 'shift_started':
      return (
        `🟢 <b>SHIFT DIMULAI</b>\n\n` +
        `Kasir: ${payload.cashierName}\n` +
        `Waktu: ${payload.startedAt}\n` +
        `Modal Awal: Rp ${payload.initialCash?.toLocaleString('id-ID') ?? 0}`
      );

    case 'shift_ended':
      return (
        `🔴 <b>SHIFT BERAKHIR</b>\n\n` +
        `Kasir: ${payload.cashierName}\n` +
        `Waktu: ${payload.endedAt}\n` +
        `Total Penjualan: Rp ${payload.totalSales?.toLocaleString('id-ID') ?? 0}`
      );

    case 'daily_report_ready':
      return (
        `📊 <b>LAPORAN HARIAN TERSEDIA</b>\n\n` +
        `Tanggal: ${payload.date}\n` +
        `Total Revenue: Rp ${payload.totalRevenue?.toLocaleString('id-ID') ?? 0}\n` +
        `Total Transaksi: ${payload.totalTransactions ?? 0}\n\n` +
        `<i>Lihat detail di dashboard Manager.</i>`
      );

    case 'system_error':
      return (
        `🚨 <b>SYSTEM ERROR</b>\n\n` +
        `Event: ${payload.event ?? '-'}\n` +
        `Pesan: ${payload.message ?? '-'}\n` +
        `Waktu: ${new Date().toISOString()}`
      );

    default:
      return `📨 ${eventType}\n\n${JSON.stringify(payload, null, 2)}`;
  }
}