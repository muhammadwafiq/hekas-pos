/**
 * Surat (Surat Jalan / Delivery Order) service.
 * Phase 4 Gate 3.
 *
 * Workflow:
 *   draft → reviewed → approved → sent
 *        ↘ rejected
 *
 * - Admin Gudang: create draft + submit for review (review)
 * - Manager: approve / reject
 * - Approved: PDF generated, auto-sent to Telegram recipients
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { surats, suratItems, outgoingGoodItems } from '../db/schema/inventory.js';
import { products } from '../db/schema/master.js';
import { NotFoundError, ValidationError, BusinessRuleError } from '../lib/errors.js';
import { suratRepo } from '../repositories/surat.repo.js';
import { suratItemRepo } from '../repositories/surat-item.repo.js';
import { suratApprovalRepo } from '../repositories/surat-approval.repo.js';
import { renderSuratJalanPdf } from './pdf-sj.service.js';
import { notificationService } from './notification.service.js';
import type { AuthUser } from '../lib/auth-helper.js';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_review', 'rejected'],
  pending_review: ['approved', 'rejected'],
  approved: ['sent'],
  rejected: [],
  sent: [],
};

export const suratService = {
  async list(opts: { outletId?: string; status?: string; limit?: number; offset?: number }) {
    return suratRepo.list(opts);
  },

  async getDetail(id: string) {
    const sj = await suratRepo.getById(id);
    const items = await suratItemRepo.listBySurat(id);
    const history = await suratApprovalRepo.listBySurat(id);
    return { ...sj, items, history };
  },

  /**
   * Create a Surat Jalan draft from an existing outgoing goods (or items directly).
   * If outgoingGoodId provided, snapshot items from outgoingGoodItems.
   */
  async create(opts: {
    outletId: string;
    destination: string;
    recipientName: string;
    recipientPhone?: string;
    notes?: string;
    outgoingGoodId?: string;
    items?: Array<{ productId: string; quantity: number; notes?: string }>;
    createdBy: string;
  }) {
    if (!opts.destination) throw new ValidationError('destination required');
    if (!opts.recipientName) throw new ValidationError('recipientName required');

    return db.transaction(async (tx) => {
      // Generate outlet short code from outletId (no outlets table in schema)
      const outletShort = (opts.outletId ?? 'OUT').slice(0, 3).toUpperCase();
      const documentNumber = await suratRepo.nextDocumentNumber(outletShort, tx);

      // Resolve items
      let resolvedItems: Array<typeof suratItems.$inferInsert> = [];

      if (opts.outgoingGoodId) {
        // Snapshot from outgoing goods
        const ogItems = await tx
          .select()
          .from(outgoingGoodItems)
          .where(eq(outgoingGoodItems.outgoingGoodId, opts.outgoingGoodId));

        if (!ogItems.length) {
          throw new ValidationError(`Outgoing good ${opts.outgoingGoodId} has no items`);
        }

        // Fetch product snapshots
        const productIds = ogItems.map((i) => i.productId);
        const prodRows = await tx.select().from(products).where(inArray(products.id, productIds));
        const prodMap = new Map(prodRows.map((p) => [p.id, p]));

        resolvedItems = ogItems.map((i) => {
          const p = prodMap.get(i.productId);
          return {
            productId: i.productId,
            productName: p?.name ?? i.productName,
            productSku: p?.sku ?? i.productSku,
            quantity: i.quantitySent,
            notes: i.notes ?? null,
          } as typeof suratItems.$inferInsert;
        });
      } else if (opts.items?.length) {
        // Use provided items
        const productIds = opts.items.map((i) => i.productId);
        const prodRows = await tx.select().from(products).where(inArray(products.id, productIds));
        const prodMap = new Map(prodRows.map((p) => [p.id, p]));
        for (const item of opts.items) {
          const p = prodMap.get(item.productId);
          if (!p) throw new ValidationError(`Product ${item.productId} not found`);
          resolvedItems.push({
            productId: item.productId,
            productName: p.name,
            productSku: p.sku,
            quantity: item.quantity,
            notes: item.notes ?? null,
          } as typeof suratItems.$inferInsert);
        }
      } else {
        throw new ValidationError('Either outgoingGoodId or items required');
      }

      const totalItems = resolvedItems.reduce((s, i) => s + (i.quantity as number), 0);

      // Create header
      const [sj] = await tx
        .insert(surats)
        .values({
          documentNumber,
          outletId: opts.outletId,
          outgoingGoodId: opts.outgoingGoodId ?? null,
          destination: opts.destination,
          recipientName: opts.recipientName,
          recipientPhone: opts.recipientPhone ?? null,
          totalItems,
          status: 'draft',
          notes: opts.notes ?? null,
          createdBy: opts.createdBy,
        } as typeof surats.$inferInsert)
        .returning();

      // Create items
      const itemsWithSurat = resolvedItems.map((i) => ({ ...i, suratId: sj!.id }));
      await tx.insert(suratItems).values(itemsWithSurat as any);

      return sj!;
    });
  },

  /**
   * Gudang reviews and submits for approval.
   */
  async reviewGudang(id: string, user: AuthUser, notes?: string) {
    const sj = await suratRepo.getById(id);
    if (!VALID_TRANSITIONS[sj.status]?.includes('pending_review')) {
      throw new BusinessRuleError(`Cannot review SJ with status '${sj.status}'`);
    }

    const updated = await suratRepo.update(id, {
      status: 'pending_review',
      reviewedBy: user.id,
      reviewedAt: new Date(),
    });

    await suratApprovalRepo.create({
      suratId: id,
      approverId: user.id,
      action: 'review',
      notes: notes ?? null,
    });

    // Notify Manager
    await notificationService
      .enqueueTelegram('sj_pending_approval', {
        documentNumber: sj.documentNumber,
        destination: sj.destination,
        recipientName: sj.recipientName,
        totalItems: sj.totalItems,
      })
      .catch((err) => logger.error({ err }, 'enqueue sj_pending_approval failed'));

    return updated;
  },

  /**
   * Manager approves.
   */
  async approve(id: string, user: AuthUser, notes?: string) {
    if (user.role !== 'manager') {
      throw new BusinessRuleError('Only manager can approve Surat Jalan');
    }
    const sj = await suratRepo.getById(id);
    if (!VALID_TRANSITIONS[sj.status]?.includes('approved')) {
      throw new BusinessRuleError(`Cannot approve SJ with status '${sj.status}'`);
    }

    // Generate PDF
    const detail = await this.getDetail(id);
    const pdfBuffer = await renderSuratJalanPdf({
      sj: detail,
      outletName: sj.destination, // simplified — no outlets table in schema
    });

    // Persist PDF path
    const pdfUrl = `/uploads/surat-jalan/${sj.documentNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    await suratRepo.update(id, { pdfUrl });

    const updated = await suratRepo.update(id, {
      status: 'approved',
      approvedBy: user.id,
      approvedAt: new Date(),
    });

    await suratApprovalRepo.create({
      suratId: id,
      approverId: user.id,
      action: 'approve',
      notes: notes ?? null,
    });

    // Notify Gudang
    await notificationService
      .enqueueTelegram('sj_approved', {
        documentNumber: sj.documentNumber,
        destination: sj.destination,
        recipientName: sj.recipientName,
        approvedBy: user.fullName ?? user.username,
      })
      .catch((err) => logger.error({ err }, 'enqueue sj_approved failed'));

    return updated;
  },

  /**
   * Manager rejects.
   */
  async reject(id: string, user: AuthUser, reason: string) {
    if (user.role !== 'manager') {
      throw new BusinessRuleError('Only manager can reject Surat Jalan');
    }
    if (!reason) throw new ValidationError('reason required');

    const sj = await suratRepo.getById(id);
    if (!VALID_TRANSITIONS[sj.status]?.includes('rejected')) {
      throw new BusinessRuleError(`Cannot reject SJ with status '${sj.status}'`);
    }

    const updated = await suratRepo.update(id, {
      status: 'rejected',
      rejectedBy: user.id,
      rejectedAt: new Date(),
      rejectReason: reason,
    });

    await suratApprovalRepo.create({
      suratId: id,
      approverId: user.id,
      action: 'reject',
      notes: reason,
    });

    await notificationService
      .enqueueTelegram('sj_rejected', {
        documentNumber: sj.documentNumber,
        destination: sj.destination,
        recipientName: sj.recipientName,
        reason,
        rejectedBy: user.fullName ?? user.username,
      })
      .catch((err) => logger.error({ err }, 'enqueue sj_rejected failed'));

    return updated;
  },

  /**
   * Mark as sent (after physical delivery).
   */
  async markSent(id: string, user: AuthUser) {
    const sj = await suratRepo.getById(id);
    if (!VALID_TRANSITIONS[sj.status]?.includes('sent')) {
      throw new BusinessRuleError(`Cannot mark SJ as sent with status '${sj.status}'`);
    }

    return suratRepo.update(id, {
      status: 'sent',
      reviewedBy: sj.reviewedBy,
    });
  },
};