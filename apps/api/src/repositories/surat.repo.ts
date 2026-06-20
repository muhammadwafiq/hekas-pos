/**
 * Surat (Surat Jalan) repository — header CRUD + list filters.
 * Phase 4 Gate 3.
 */

import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import { surats } from '../db/schema/inventory.js';
import { NotFoundError } from '../lib/errors.js';

export const suratRepo = {
  async list(opts: { outletId?: string; status?: string; limit?: number; offset?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    const conds: any[] = [];
    if (opts.outletId) conds.push(eq(surats.outletId, opts.outletId));
    if (opts.status) conds.push(eq(surats.status, opts.status as any));

    const where = conds.length ? and(...conds) : undefined;

    const [items, [{ total }]] = await Promise.all([
      db.select().from(surats).where(where).orderBy(desc(surats.createdAt)).limit(limit).offset(offset),
      db.select({ total: sql<number>`COUNT(*)::int` }).from(surats).where(where),
    ]);

    return { items, total, limit, offset };
  },

  async getById(id: string) {
    const [row] = await db.select().from(surats).where(eq(surats.id, id)).limit(1);
    if (!row) throw new NotFoundError(`Surat ${id} not found`);
    return row;
  },

  async create(data: typeof surats.$inferInsert) {
    const [row] = await db.insert(surats).values(data).returning();
    return row!;
  },

  async update(id: string, data: Partial<typeof surats.$inferInsert>) {
    const [row] = await db
      .update(surats)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(surats.id, id))
      .returning();
    if (!row) throw new NotFoundError(`Surat ${id} not found`);
    return row;
  },

  async updateStatus(id: string, status: string, extra: Partial<typeof surats.$inferInsert> = {}) {
    return this.update(id, { status: status as any, ...extra });
  },

  async nextDocumentNumber(outletShortCode: string, tx: any = db): Promise<string> {
    const today = new Date();
    const yymm = `${today.getFullYear().toString().slice(2)}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `SJ/${outletShortCode}/${yymm}`;
    const [row] = await tx
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(surats)
      .where(sql`${surats.documentNumber} LIKE ${prefix + '%'}`);
    const seq = (row?.cnt ?? 0) + 1;
    return `${prefix}/${String(seq).padStart(4, '0')}`;
  },
};