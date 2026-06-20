/**
 * Locale helpers for ID-ID format (Indonesian).
 * Used across reports.
 */

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const IDR_DECIMAL = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat('id-ID');

const DATE_ID = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
});

const DATETIME_ID = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
  hour12: false,
});

export function formatRupiah(value: string | number | null | undefined, withDecimal = false): string {
  if (value === null || value === undefined) return 'Rp 0';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return 'Rp 0';
  return withDecimal ? IDR_DECIMAL.format(n) : IDR.format(n);
}

export function formatNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(n) ? '0' : NUM.format(n);
}

export function formatDateID(d: Date | string | null | undefined): string {
  if (!d) return '-';
  return DATE_ID.format(new Date(d));
}

export function formatDateTimeID(d: Date | string | null | undefined): string {
  if (!d) return '-';
  return DATETIME_ID.format(new Date(d));
}

export const RANGE_LABELS: Record<string, string> = {
  today: 'Hari Ini',
  week: '7 Hari Terakhir',
  month: 'Bulan Ini',
  all: 'Semua Waktu',
};

export function rangeLabel(range: string): string {
  return RANGE_LABELS[range] ?? range;
}

export function timestampForFilename(d: Date = new Date()): string {
  return d
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
}
