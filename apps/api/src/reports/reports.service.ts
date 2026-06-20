/**
 * Reports service — orchestrates DB queries + format dispatch.
 * Phase 6: Sales, Inventory, Transactions reports in Excel/PDF.
 */

import { db } from '../config/database.js';
import { eq, and, gte, lte, desc, inArray, sql } from 'drizzle-orm';
import { orders, payments } from '../db/schema/pos.js';
import { products, categories } from '../db/schema/master.js';
import { stocks } from '../db/schema/stock.js';
import { users } from '../db/schema/auth.js';
import { dashboardManager, type DashboardRange } from '../services/dashboard-manager.service.js';
import { buildExcel, type ExcelSheet } from './excel-export.js';
import { buildPdf, type PdfSection } from './pdf-export.js';
import {
  formatRupiah,
  formatNumber,
  formatDateTimeID,
  rangeLabel,
  timestampForFilename,
} from './locale.js';

export type ReportRange = DashboardRange;
export type ReportFormat = 'excel' | 'pdf';

export interface ReportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

function rangeStart(range: ReportRange): Date {
  const start = new Date();
  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 7);
  } else if (range === 'month') {
    start.setHours(0, 0, 0, 0);
    start.setDate(1);
  } else {
    return new Date('2000-01-01T00:00:00.000Z');
  }
  return start;
}

interface TransactionRow {
  id: string;
  orderNumber: string;
  createdAt: Date | null;
  cashierName: string | null;
  total: string;
  discount: string;
  tax: string;
  status: string;
  payments: { method: string; amount: string }[];
}

async function getSalesTransactions(opts: {
  outletId: string;
  range: ReportRange;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<TransactionRow[]> {
  const { outletId, range, from, to, limit = 1000 } = opts;
  const sinceIso = (from ?? rangeStart(range).toISOString());
  // 'to' is inclusive end-of-day if no time component given
  const toIso = to
    ? (to.length === 10 ? `${to}T23:59:59.999Z` : to)
    : null;

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      createdAt: orders.createdAt,
      cashierName: users.fullName,
      total: orders.total,
      discount: orders.discount,
      tax: orders.tax,
      status: orders.status,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.cashierId))
    .where(
      and(
        eq(orders.outletId, outletId),
        gte(orders.createdAt, sql`${sinceIso}::timestamp`),
        ...(toIso ? [lte(orders.createdAt, sql`${toIso}::timestamp`)] : []),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  const orderIds = rows.map((r) => r.id);
  const paymentMap = new Map<string, { method: string; amount: string }[]>();
  if (orderIds.length > 0) {
    const pays = await db
      .select({
        orderId: payments.orderId,
        method: payments.method,
        amount: payments.amount,
      })
      .from(payments)
      .where(inArray(payments.orderId, orderIds));
    for (const p of pays) {
      const arr = paymentMap.get(p.orderId) ?? [];
      arr.push({ method: p.method, amount: p.amount });
      paymentMap.set(p.orderId, arr);
    }
  }

  return rows.map((r) => ({
    ...r,
    payments: paymentMap.get(r.id) ?? [],
  }));
}

export const reportsService = {
  async sales(opts: {
    outletId: string;
    range: ReportRange;
    format: ReportFormat;
    from?: string;
    to?: string;
  }): Promise<ReportResult> {
    const { outletId, range, format, from, to } = opts;
    // TODO: when from/to provided, override KPI summary range too
    // For now, summary uses `range`; transactions use from/to if provided
    const data = await dashboardManager(outletId, range);
    const txs = await getSalesTransactions({ outletId, range, from, to });
    const ts = timestampForFilename();
    const filenameBase = `laporan-penjualan-${range}-${ts}`;

    if (format === 'excel') {
      const sheets: ExcelSheet[] = [
        {
          name: 'Ringkasan',
          title: 'LAPORAN PENJUALAN',
          subtitle: `${rangeLabel(range)} • Outlet ${outletId.slice(0, 8)} • Dicetak ${formatDateTimeID(new Date())}`,
          headers: ['Metrik', 'Nilai'],
          rows: [
            ['Total Transaksi', formatNumber(data.sales.transactions)],
            ['Pendapatan', formatRupiah(data.sales.revenue)],
            ['Diskon', formatRupiah(data.sales.discount)],
            ['Pajak', formatRupiah(data.sales.tax)],
            ['Rata-rata Transaksi', formatRupiah(data.sales.avgTicket)],
            ['Rata-rata Item / Transaksi', formatNumber(data.sales.avgItemsPerOrder)],
            [],
            ['Total Produk', formatNumber(data.inventory.totalProducts)],
            ['Stok Menipis', formatNumber(data.inventory.lowStock)],
            ['Stok Habis', formatNumber(data.inventory.outOfStock)],
            [],
            ['Shift Aktif', formatNumber(data.operations.activeShifts)],
            ['Total Karyawan', formatNumber(data.operations.totalEmployees)],
            ['Member Terdaftar', formatNumber(data.operations.members)],
          ],
        },
        {
          name: 'Top 5 Produk',
          headers: ['#', 'SKU', 'Nama Produk', 'Qty Terjual', 'Pendapatan'],
          rows: data.topProducts.map((p, i) => [
            i + 1,
            p.sku,
            p.name,
            p.qtySold,
            formatRupiah(p.revenue),
          ]),
        },
        {
          name: 'Penjualan per Jam',
          headers: ['Jam (WIB)', 'Jumlah Transaksi', 'Pendapatan'],
          rows: data.salesByHour.map((h) => [
            `${String(h.hour).padStart(2, '0')}:00`,
            h.count,
            formatRupiah(h.revenue),
          ]),
        },
        {
          name: 'Metode Pembayaran',
          headers: ['Metode', 'Jumlah', 'Total'],
          rows: data.payments.map((p) => [
            p.method,
            p.count,
            formatRupiah(p.total),
          ]),
        },
        {
          name: 'Transaksi',
          title: 'DETAIL TRANSAKSI',
          subtitle: `${txs.length} transaksi (maks 1000 baris)`,
          headers: [
            'No',
            'Order #',
            'Tanggal',
            'Kasir',
            'Diskon',
            'Pajak',
            'Total',
            'Status',
            'Metode Bayar',
          ],
          rows: txs.map((t, i) => [
            i + 1,
            t.orderNumber,
            formatDateTimeID(t.createdAt),
            t.cashierName ?? '-',
            formatRupiah(t.discount),
            formatRupiah(t.tax),
            formatRupiah(t.total),
            t.status,
            t.payments.map((p) => p.method).join(', ') || '-',
          ]),
        },
      ];

      const buffer = await buildExcel(sheets);
      return {
        buffer,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${filenameBase}.xlsx`,
      };
    }

    // PDF — summary only
    const sections: PdfSection[] = [
      {
        heading: 'Ringkasan Penjualan',
        rows: [
          { label: 'Total Transaksi', value: formatNumber(data.sales.transactions) },
          { label: 'Pendapatan', value: formatRupiah(data.sales.revenue) },
          { label: 'Diskon', value: formatRupiah(data.sales.discount) },
          { label: 'Pajak', value: formatRupiah(data.sales.tax) },
          { label: 'Rata-rata Transaksi', value: formatRupiah(data.sales.avgTicket) },
          { label: 'Rata-rata Item / Transaksi', value: formatNumber(data.sales.avgItemsPerOrder) },
        ],
      },
      {
        heading: 'Inventori',
        rows: [
          { label: 'Total Produk', value: formatNumber(data.inventory.totalProducts) },
          { label: 'Stok Menipis', value: formatNumber(data.inventory.lowStock) },
          { label: 'Stok Habis', value: formatNumber(data.inventory.outOfStock) },
        ],
      },
      {
        heading: 'Operasional',
        rows: [
          { label: 'Shift Aktif', value: formatNumber(data.operations.activeShifts) },
          { label: 'Total Karyawan', value: formatNumber(data.operations.totalEmployees) },
          { label: 'Member Terdaftar', value: formatNumber(data.operations.members) },
        ],
      },
    ];

    if (data.payments.length > 0) {
      sections.push({
        heading: 'Metode Pembayaran',
        rows: data.payments.map((p) => ({
          label: p.method,
          value: `${formatNumber(p.count)} • ${formatRupiah(p.total)}`,
        })),
      });
    }

    if (data.topProducts.length > 0) {
      sections.push({
        heading: 'Top 5 Produk',
        rows: data.topProducts.map((p, i) => ({
          label: `${i + 1}. ${p.name} (${p.sku}) • ${formatNumber(p.qtySold)} qty`,
          value: formatRupiah(p.revenue),
        })),
      });
    }

    const buffer = await buildPdf({
      title: 'LAPORAN PENJUALAN',
      subtitle: `${rangeLabel(range)} • Outlet ${outletId.slice(0, 8)} • ${formatDateTimeID(new Date())}`,
      sections,
    });
    return { buffer, contentType: 'application/pdf', filename: `${filenameBase}.pdf` };
  },

  async inventory(opts: {
    outletId: string;
    format: ReportFormat;
  }): Promise<ReportResult> {
    const { outletId, format } = opts;
    const rows = await db
      .select({
        sku: products.sku,
        name: products.name,
        categoryName: categories.name,
        sellingPrice: products.sellingPrice,
        stockMin: products.stockMin,
        quantity: stocks.quantity,
        updatedAt: stocks.updatedAt,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(
        stocks,
        and(eq(stocks.productId, products.id), eq(stocks.outletId, outletId)),
      )
      .where(eq(products.outletId, outletId))
      .orderBy(products.name);

    const ts = timestampForFilename();
    const filenameBase = `laporan-inventori-${ts}`;
    const totalValue = rows.reduce(
      (sum, r) => sum + Number(r.sellingPrice ?? 0) * Number(r.quantity ?? 0),
      0,
    );
    const lowStockCount = rows.filter(
      (r) => Number(r.quantity ?? 0) <= Number(r.stockMin ?? 0),
    ).length;
    const outOfStockCount = rows.filter((r) => Number(r.quantity ?? 0) <= 0).length;

    if (format === 'excel') {
      const sheets: ExcelSheet[] = [
        {
          name: 'Inventori',
          title: 'LAPORAN INVENTORI',
          subtitle: `${rows.length} produk • ${lowStockCount} menipis • ${outOfStockCount} habis • ${formatDateTimeID(new Date())}`,
          headers: [
            'SKU',
            'Nama Produk',
            'Kategori',
            'Harga Jual',
            'Stok',
            'Stok Min',
            'Status',
            'Nilai Stok',
          ],
          rows: rows.map((r) => {
            const qty = Number(r.quantity ?? 0);
            const min = Number(r.stockMin ?? 0);
            const status = qty <= 0 ? 'HABIS' : qty <= min ? 'MENIPIS' : 'AMAN';
            return [
              r.sku,
              r.name,
              r.categoryName ?? '-',
              formatRupiah(r.sellingPrice),
              qty,
              min,
              status,
              formatRupiah(Number(r.sellingPrice ?? 0) * qty),
            ];
          }),
        },
      ];
      const buffer = await buildExcel(sheets);
      return {
        buffer,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${filenameBase}.xlsx`,
      };
    }

    // PDF
    const buffer = await buildPdf({
      title: 'LAPORAN INVENTORI',
      subtitle: `Outlet ${outletId.slice(0, 8)} • ${formatDateTimeID(new Date())}`,
      sections: [
        {
          heading: 'Ringkasan',
          rows: [
            { label: 'Total Produk', value: formatNumber(rows.length) },
            { label: 'Stok Menipis', value: formatNumber(lowStockCount) },
            { label: 'Stok Habis', value: formatNumber(outOfStockCount) },
            { label: 'Total Nilai Inventori', value: formatRupiah(totalValue) },
          ],
        },
        {
          heading: 'Detail Produk',
          rows: rows.map((r) => {
            const qty = Number(r.quantity ?? 0);
            const min = Number(r.stockMin ?? 0);
            const status = qty <= 0 ? 'HABIS' : qty <= min ? 'MENIPIS' : 'AMAN';
            return {
              label: `${r.sku} • ${r.name} (stok ${qty}, min ${min})`,
              value: `${status} • ${formatRupiah(Number(r.sellingPrice ?? 0) * qty)}`,
            };
          }),
        },
      ],
    });
    return { buffer, contentType: 'application/pdf', filename: `${filenameBase}.pdf` };
  },

  async transactions(opts: {
    outletId: string;
    range: ReportRange;
    format: ReportFormat;
    from?: string;
    to?: string;
  }): Promise<ReportResult> {
    const { outletId, range, format, from, to } = opts;
    const txs = await getSalesTransactions({ outletId, range, from, to });
    const ts = timestampForFilename();
    const filenameBase = `laporan-transaksi-${range}-${ts}`;
    const totalRevenue = txs.reduce(
      (s, t) => s + Number(t.total ?? 0),
      0,
    );

    if (format === 'excel') {
      const sheets: ExcelSheet[] = [
        {
          name: 'Transaksi',
          title: 'LAPORAN TRANSAKSI',
          subtitle: `${rangeLabel(range)} • ${txs.length} transaksi • Total ${formatRupiah(totalRevenue)} • ${formatDateTimeID(new Date())}`,
          headers: [
            'No',
            'Order #',
            'Tanggal',
            'Kasir',
            'Diskon',
            'Pajak',
            'Total',
            'Status',
            'Metode Bayar',
          ],
          rows: txs.map((t, i) => [
            i + 1,
            t.orderNumber,
            formatDateTimeID(t.createdAt),
            t.cashierName ?? '-',
            formatRupiah(t.discount),
            formatRupiah(t.tax),
            formatRupiah(t.total),
            t.status,
            t.payments.map((p) => p.method).join(', ') || '-',
          ]),
        },
      ];
      const buffer = await buildExcel(sheets);
      return {
        buffer,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${filenameBase}.xlsx`,
      };
    }

    const buffer = await buildPdf({
      title: 'LAPORAN TRANSAKSI',
      subtitle: `${rangeLabel(range)} • ${txs.length} transaksi • ${formatDateTimeID(new Date())}`,
      sections: [
        {
          heading: 'Ringkasan',
          rows: [
            { label: 'Jumlah Transaksi', value: formatNumber(txs.length) },
            { label: 'Total Pendapatan', value: formatRupiah(totalRevenue) },
          ],
        },
        {
          heading: 'Daftar Transaksi',
          rows: txs.map((t) => ({
            label: `${t.orderNumber} • ${formatDateTimeID(t.createdAt)} • ${t.cashierName ?? '-'}`,
            value: `${t.status} • ${formatRupiah(t.total)}`,
          })),
        },
      ],
    });
    return { buffer, contentType: 'application/pdf', filename: `${filenameBase}.pdf` };
  },
};
