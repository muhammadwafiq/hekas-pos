/**
 * Payment repository.
 */

import { eq } from 'drizzle-orm';
import { db, type DbOrTx} from '../config/database.js';
import { payments } from '../db/schema/pos.js';

export const paymentRepo = {
  async create(payment: typeof payments.$inferInsert, tx: DbOrTx = db) {
    const [row] = await tx.insert(payments).values(payment).returning();
    return row;
  },

  async findByOrderId(orderId: string) {
    return db.select().from(payments).where(eq(payments.orderId, orderId));
  },
};
