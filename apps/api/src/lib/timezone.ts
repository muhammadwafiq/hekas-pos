/**
 * Timezone helpers — Asia/Jakarta (WIB, UTC+7) for the POS business day.
 * All date boundaries are computed in Jakarta local time, then converted to UTC ISO.
 */

const TZ = 'Asia/Jakarta';

function jakartaDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): Date {
  // Date.UTC gives us a UTC timestamp. We offset by the Jakarta offset for the given date.
  // Jakarta is fixed at UTC+7 (no DST).
  const utcMs = Date.UTC(year, month - 1, day, hour - 7, minute, second, ms);
  return new Date(utcMs);
}

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function startOfDayJakarta(d: Date | string): Date {
  if (typeof d === 'string') {
    const p = parseYmd(d);
    if (!p) {
      // Try ISO timestamp
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return dt;
      // Get Jakarta Y/M/D
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = fmt.formatToParts(dt);
      const y = Number(parts.find((x) => x.type === 'year')!.value);
      const m = Number(parts.find((x) => x.type === 'month')!.value);
      const dd = Number(parts.find((x) => x.type === 'day')!.value);
      return jakartaDate(y, m, dd, 0, 0, 0, 0);
    }
    return jakartaDate(p.y, p.m, p.d, 0, 0, 0, 0);
  }
  // d is a Date
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d);
  const y = Number(parts.find((x) => x.type === 'year')!.value);
  const m = Number(parts.find((x) => x.type === 'month')!.value);
  const dd = Number(parts.find((x) => x.type === 'day')!.value);
  return jakartaDate(y, m, dd, 0, 0, 0, 0);
}

export function endOfDayJakarta(d: Date | string): Date {
  const s = startOfDayJakarta(d);
  return new Date(s.getTime() + 24 * 60 * 60 * 1000 - 1);
}
