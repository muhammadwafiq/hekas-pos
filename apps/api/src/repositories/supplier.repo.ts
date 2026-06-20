/**
 * Supplier repository — CRUD for product suppliers.
 * Phase 3 Gate 2 — Admin Gudang.
 */

import { eq, sql, and, ilike, type SQL} from 'drizzle-orm';
import { db } from '../config/database.js';
import { suppliers } from '../db/schema/master.js';
import { NotFoundError } from '../lib/errors.js';

export const supplierRepo = {
  async list(opts: { q?: string; active?: boolean; limit?: number; offset?: number } = {}) {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    const conditions: SQL[] = [];
    if (opts.q) conditions.push(ilike(suppliers.name, `%${opts.q}%`));
    if (opts.active !== undefined) conditions.push(eq(suppliers.isActive, opts.active));

    const where = conditions.length ? and(...conditions) : undefined;

    const [items, [{ total }]] = await Promise.all([
      db
        .select()
        .from(suppliers)
        .where(where)
        .orderBy(suppliers.name)
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(suppliers)
        .where(where),
    ]);

    return { items, total, limit, offset };
  },

  async getById(id: string) {
    const [row] = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!row) throw new NotFoundError(`Supplier ${id} not found`);
    return row;
  },

  async create(data: typeof suppliers.$inferInsert) {
    const [row] = await db.insert(suppliers).values(data).returning();
    return row!;
  },

  async update(id: string, data: Partial<typeof suppliers.$inferInsert>) {
    const [row] = await db
      .update(suppliers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    if (!row) throw new NotFoundError(`Supplier ${id} not found`);
    return row;
  },

  async softDelete(id: string) {
    const [row] = await db
      .update(suppliers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    if (!row) throw new NotFoundError(`Supplier ${id} not found`);
    return row;
  },
};