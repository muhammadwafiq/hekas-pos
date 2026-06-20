/**
 * Surat Jalan PDF rendering.
 * Phase 4 Gate 3.
 */

import { renderSimplePdf } from '../lib/pdf.js';
import type { Surat, SuratItem, SuratApproval } from '../db/schema/inventory.js';

type SuratJalanDetail = Surat & {
  items: SuratItem[];
  history: SuratApproval[];
};

export async function renderSuratJalanPdf(opts: {
  sj: SuratJalanDetail;
  outletName: string;
}): Promise<Buffer> {
  const { sj, outletName } = opts;

  const headers = ['No', 'SKU', 'Nama Produk', 'Qty', 'Catatan'];
  const rows = sj.items.map((item, idx) => [
    String(idx + 1),
    item.productSku,
    item.productName,
    String(item.quantity),
    item.notes ?? '-',
  ]);

  return renderSimplePdf({
    title: 'SURAT JALAN',
    docNumber: sj.documentNumber,
    meta: [
      { label: 'Tanggal', value: new Date(sj.createdAt).toLocaleString('id-ID') },
      { label: 'Tujuan', value: sj.destination },
      { label: 'Penerima', value: sj.recipientName },
      ...(sj.recipientPhone ? [{ label: 'Telp', value: sj.recipientPhone }] : []),
      { label: 'Outlet', value: outletName },
      { label: 'Status', value: sj.status.toUpperCase() },
    ],
    headers,
    rows,
    footer: `Dokumen ini digenerate otomatis oleh HEKAS POS pada ${new Date().toLocaleString('id-ID')}`,
  });
}