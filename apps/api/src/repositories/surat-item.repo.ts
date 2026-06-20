/**
 * Surat items repository — line items per Surat Jalan.
 * Phase 4 Gate 3.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../config/database.js';
import { suratItems } from '../db/schema/inventory.js';

export const suratItemRepo = {
  async listBySurat(suratId: string) {
    return db.select().from(suratItems).where(eq(suratItems.suratId, suratId));
  },

  async listBySurats(suratIds: string[]) {
    if (!suratIds.length) return [];
    return db.select().from(suratItems).where(eq(suratItems.suratId, suratIds[0]));
  },

  async create(data: typeof suratItems.$inferInsert) {
    const [row] = await db.insert(suratItems).values(data).returning();
    return row!;
  },

  async createMany(rows: Array<typeof suratItems.$inferInsert>) {
    if (!rows.length) return [];
    return db.insert(suratItems).values(rows).returning();
  },

  async deleteBySurat(suratId: string) {
    return db.delete(suratItems).where(eq(suratItems.suratId, suratId)).returning();
  },
};