/**
 * Centralized pgEnum definitions — exported to all schema files.
 * Keeping enums in one file prevents circular imports and ensures consistency.
 */

import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'kasir',
  'admin_gudang',
  'manager',
  'super_admin',
]);

export const productStatusEnum = pgEnum('product_status', [
  'aktif',
  'stok_tipis',
  'habis',
  'nonaktif',
]);

export const memberTierEnum = pgEnum('member_tier', [
  'silver',
  'gold',
  'platinum',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'draft',
  'held',
  'pending_payment',
  'completed',
  'voided',
  'refunded',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'tunai',
  'qris',
  'debit',
]);

export const shiftStatusEnum = pgEnum('shift_status', [
  'aktif',
  'selesai',
  'ditutup_paksa',
]);

export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'in_purchase',
  'in_adjustment',
  'in_return',
  'out_sale',
  'out_adjustment',
  'out_damage',
  'out_transfer',
]);

export const incomingGoodStatusEnum = pgEnum('incoming_good_status', [
  'draft',
  'pending',
  'verified',
  'rejected',
]);

export const outgoingGoodStatusEnum = pgEnum('outgoing_good_status', [
  'draft',
  'picking',
  'ready',
  'sent',
  'cancelled',
]);

export const suratJalanStatusEnum = pgEnum('surat_jalan_status', [
  'draft',
  'pending_review',
  'pending_approval',
  'approved',
  'rejected',
  'sent',
  'cancelled',
]);

export const suratApprovalActionEnum = pgEnum('surat_approval_action', [
  'review',
  'approve',
  'reject',
]);

export const telegramEventTypeEnum = pgEnum('telegram_event_type', [
  'sj_pending_approval',
  'sj_approved',
  'sj_rejected',
  'stock_kritis',
  'barang_masuk_verified',
  'laporan_harian_ready',
  'shift_dimulai',
  'shift_diakhiri',
  'error_sistem',
]);

export const notificationStatusEnum = pgEnum('notification_status', [
  'pending',
  'sending',
  'sent',
  'failed',
  'cancelled',
]);

export const telegramMessageDirectionEnum = pgEnum('telegram_message_direction', [
  'incoming',
  'outgoing',
]);

export const attendanceStatusEnum = pgEnum('attendance_status', [
  'hadir',
  'izin',
  'sakit',
  'cuti',
  'alpha',
]);

export const leaveTypeEnum = pgEnum('leave_type', [
  'tahunan',
  'sakit',
  'penting',
  'melahirkan',
  'lainnya',
]);

export const leaveRequestStatusEnum = pgEnum('leave_request_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'void',
  'approve',
  'reject',
  'login',
  'logout',
  'export',
  'import',
  'verify',
  'pick',
  'send',
]);

export const deviceTypeEnum = pgEnum('device_type', [
  'pos_terminal',
  'tablet',
  'smartphone',
  'printer',
  'scanner',
]);

export const printerConnectionEnum = pgEnum('printer_connection', [
  'usb',
  'network',
  'bluetooth',
]);

export const aiMessageRoleEnum = pgEnum('ai_message_role', [
  'user',
  'assistant',
  'system',
]);