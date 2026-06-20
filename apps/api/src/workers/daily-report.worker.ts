/**
 * Daily report worker — generates yesterday's sales report and sends to managers via Telegram.
 * Phase 6 (Daily report cron).
 *
 * Flow:
 *  1. pg-boss fires 'reports-daily' job at 7am Asia/Jakarta
 *  2. Worker iterates all distinct outlets (from users.outletId)
 *  3. For each outlet: compute KPIs for yesterday, persist snapshot in `daily_reports`
 *  4. Send summary text to all verified manager telegram links
 *
 * Scope: text-only summary. PDF is generated on-demand via /api/reports/sales.
 */

import { db } from '../config/database.js';
import { eq, and, sql, isNotNull } from 'drizzle-orm';
import { users } from '../db/schema/auth.js';
import { telegramLinks } from '../db/schema/telegram.js';
import { dailyReports } from '../db/schema/reports.js';
import { startOfDayJakarta, endOfDayJakarta } from '../lib/timezone.js';
import { formatRupiah, formatNumber, formatDateID } from '../reports/locale.js';
import { sendTelegramMessage } from '../lib/telegram.js';
import { logger } from '../config/logger.js';

export type DailyReportJobData = {
  /** ISO date YYYY-MM-DD (Jakarta). Default: yesterday. */
  reportDate?: string;
  /** Optional: limit to single outlet. Default: all outlets. */
  outletId?: string;
};

async function listActiveOutlets(): Promise<{ id: string; name: string }[]> {
  // Outlets are not a dedicated table — derive distinct outletIds from users.
  // Use outletId as both id and name placeholder (no separate name available).
  const rows = await db
    .selectDistinct({ id: users.outletId })
    .from(users)
    .where(isNotNull(users.outletId));
  return rows
    .filter((r): r is { id: string; name: string } => r.id !== null)
    .map((r) => ({ id: r.id, name: r.id.slice(0, 8) }));
}

async function getVerifiedManagerChats(outletId: string): Promise<{ chatId: string; fullName: string }[]> {
  const rows = await db
    .select({
      chatId: telegramLinks.telegramChatId,
      fullName: users.fullName,
    })
    .from(telegramLinks)
    .innerJoin(users, eq(users.id, telegramLinks.userId))
    .where(
      and(
        eq(telegramLinks.isVerified, true),
        eq(users.outletId, outletId),
        eq(users.role, 'manager'),
        isNotNull(telegramLinks.telegramChatId),
      ),
    );
  return rows
    .filter((r) => r.chatId !== null)
    .map((r) => ({ chatId: r.chatId as string, fullName: r.fullName }));
}

function formatSummary(outletName: string, reportDate: string, k: DailyKpis): string {
  return [
    `📊 <b>Laporan Harian</b>`,
    `<i>${formatDateID(reportDate)}</i> · Outlet: <b>${escapeHtml(outletName)}</b>`,
    ``,
    `💰 <b>Pendapatan: ${formatRupiah(k.revenue)}</b>`,
    `🧾 Transaksi: ${formatNumber(k.transactions)} (void: ${formatNumber(k.totalVoid)})`,
    `🏷️ Diskon: ${formatRupiah(k.discount)}`,
    `📈 Rata-rata: ${formatRupiah(k.avgTicket)}`,
    ``,
    `Lihat detail di dashboard: /api/dashboard/sales?range=today`,
  ].join('\n');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type DailyKpis = {
  transactions: number;
  revenue: string;
  discount: string;
  avgTicket: string;
  totalVoid: number;
  totalVoidAmount: string;
};

async function computeDailyKpis(outletId: string, sinceIso: string, toIso: string): Promise<DailyKpis> {
  const [row] = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM orders
        WHERE outlet_id = ${outletId}
          AND status = 'completed'
          AND created_at >= ${sinceIso}::timestamp
          AND created_at <= ${toIso}::timestamp) as transactions,
      (SELECT coalesce(sum(total), '0') FROM orders
        WHERE outlet_id = ${outletId}
          AND status = 'completed'
          AND created_at >= ${sinceIso}::timestamp
          AND created_at <= ${toIso}::timestamp) as revenue,
      (SELECT coalesce(sum(discount), '0') FROM orders
        WHERE outlet_id = ${outletId}
          AND status = 'completed'
          AND created_at >= ${sinceIso}::timestamp
          AND created_at <= ${toIso}::timestamp) as discount,
      (SELECT count(*)::int FROM orders
        WHERE outlet_id = ${outletId}
          AND created_at >= ${sinceIso}::timestamp
          AND created_at <= ${toIso}::timestamp
          AND status = 'voided') as total_void,
      (SELECT coalesce(sum(total), '0') FROM orders
        WHERE outlet_id = ${outletId}
          AND created_at >= ${sinceIso}::timestamp
        AND created_at <= ${toIso}::timestamp
        AND status = 'voided') as total_void_amount
  `) as any;

  const transactions = Number(row?.transactions ?? 0);
  const revenue = String(row?.revenue ?? '0');
  const discount = String(row?.discount ?? '0');
  const avgTicket = transactions > 0 ? String(Number(revenue) / transactions) : '0';
  return {
    transactions,
    revenue,
    discount,
    avgTicket,
    totalVoid: Number(row?.total_void ?? 0),
    totalVoidAmount: String(row?.total_void_amount ?? '0'),
  };
}

export async function runDailyReportJob(data: DailyReportJobData): Promise<{ processed: number; sent: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;
  let sent = 0;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const reportDate = data.reportDate ?? yesterday.toISOString().slice(0, 10);

  const outletsToProcess = data.outletId
    ? [{ id: data.outletId, name: data.outletId.slice(0, 8) }]
    : await listActiveOutlets();

  for (const outlet of outletsToProcess) {
    try {
      logger.info({ outletId: outlet.id, reportDate }, 'Daily report: processing outlet');

      const sinceIso = startOfDayJakarta(reportDate).toISOString();
      const toIso = endOfDayJakarta(reportDate).toISOString();

      const kpis = await computeDailyKpis(outlet.id, sinceIso, toIso);

      // Persist snapshot
      await db.insert(dailyReports).values({
        outletId: outlet.id,
        reportDate,
        totalOrders: kpis.transactions,
        totalSales: kpis.revenue,
        totalDiscount: kpis.discount,
        totalVoid: kpis.totalVoid,
        totalVoidAmount: kpis.totalVoidAmount,
      });

      // Get recipient chats
      const chats = await getVerifiedManagerChats(outlet.id);
      if (chats.length === 0) {
        logger.warn({ outletId: outlet.id }, 'Daily report: no verified manager telegram links');
        processed++;
        continue;
      }

      const summaryText = formatSummary(outlet.name, reportDate, kpis);
      for (const chat of chats) {
        try {
          const result = await sendTelegramMessage(chat.chatId, summaryText, 'HTML');
          if (result.ok) sent++;
          else errors.push(`send to ${chat.fullName}: ${result.error}`);
        } catch (err: any) {
          errors.push(`send to ${chat.fullName}: ${err.message}`);
          logger.error({ err, chatId: chat.chatId }, 'Daily report: telegram send failed');
        }
      }

      processed++;
    } catch (err: any) {
      errors.push(`outlet ${outlet.id}: ${err.message}`);
      logger.error({ err, outletId: outlet.id }, 'Daily report: outlet processing failed');
    }
  }

  return { processed, sent, errors };
}

export const dailyReportWorker = {
  async start(boss: any) {
    // pg-boss 12 requires explicit queue creation
    await boss.createQueue('reports-daily');
    await boss.work('reports-daily', async (jobs: any[]) => {
      // pg-boss 12: handler receives an array of jobs (batched)
      for (const job of jobs) {
        logger.info({ jobId: job.id, data: job.data }, 'Daily report job started');
        const result = await runDailyReportJob(job.data ?? {});
        logger.info({ jobId: job.id, ...result }, 'Daily report job finished');
      }
    });
    logger.info('Daily report worker registered');
  },

  /** Schedule daily 7am Asia/Jakarta. pg-boss stores cron in UTC, so we pass tz. */
  async schedule(boss: any) {
    const schedules = await boss.getSchedules();
    const existing = schedules.find((s: any) => s.name === 'reports-daily');
    if (existing) {
      logger.info('Daily report schedule already exists, skipping');
      return;
    }
    // In pg-boss 12, schedule name = queue name where the scheduled job lands.
    await boss.schedule('reports-daily', '0 7 * * *', undefined, {
      tz: 'Asia/Jakarta',
    });
    logger.info('Daily report scheduled: 7am Asia/Jakarta');
  },
};
