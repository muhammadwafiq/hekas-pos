/**
 * Notification recipient config — which roles receive which events.
 * Phase 4 — Telegram.
 */

export type Role = 'kasir' | 'admin_gudang' | 'manager';

export const NOTIFICATION_RECIPIENTS: Record<string, Role[]> = {
  // Surat Jalan
  sj_pending_approval: ['manager'],
  sj_approved: ['admin_gudang'],
  sj_rejected: ['admin_gudang'],

  // Stock + PO
  stok_kritis: ['admin_gudang', 'manager'],
  po_verified: ['admin_gudang', 'manager'],

  // Daily + Shifts
  daily_report_ready: ['manager'],
  shift_started: ['manager'],
  shift_ended: ['manager'],

  // System
  system_error: ['manager'],
};

export function recipientsFor(eventType: string): Role[] {
  return NOTIFICATION_RECIPIENTS[eventType] ?? [];
}