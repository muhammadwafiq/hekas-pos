/**
 * Surat approval history repository.
 * Phase 4 Gate 3.
 */

import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { suratApprovals } from '../db/schema/inventory.js';

export const suratApprovalRepo = {
  async listBySurat(suratId: string) {
    return db
      .select()
      .from(suratApprovals)
      .where(eq(suratApprovals.suratId, suratId))
      .orderBy(desc(suratApprovals.createdAt));
  },

  async create(data: typeof suratApprovals.$inferInsert) {
    const [row] = await db.insert(suratApprovals).values(data).returning();
    return row!;
  },

  async countByAction(suratId: string, action: string) {
    const [{ cnt }] = await db
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(suratApprovals)
      .where(eq(suratApprovals.suratId, suratId));
    return cnt;
  },
};