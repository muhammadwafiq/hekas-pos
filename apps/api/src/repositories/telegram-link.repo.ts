/**
 * Telegram link repository — user ↔ chat_id binding.
 * Phase 4 Gate 3.
 */

import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { db } from '../config/database.js';
import { telegramLinks } from '../db/schema/telegram.js';
import { NotFoundError } from '../lib/errors.js';

export const telegramLinkRepo = {
  async findByCode(code: string) {
    const [row] = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.linkCode, code))
      .limit(1);
    return row ?? null;
  },

  async findByUserId(userId: string) {
    const [row] = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.userId, userId))
      .orderBy(desc(telegramLinks.createdAt))
      .limit(1);
    return row ?? null;
  },

  async findByChatId(chatId: string) {
    const [row] = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.telegramChatId, chatId))
      .limit(1);
    return row ?? null;
  },

  /**
   * Upsert link code for a user (latest pending code wins).
   * If user already has a verified link, throw (must unlink first).
   */
  async upsertPendingCode(opts: { userId: string; code: string; expiresAt: Date }) {
    const existing = await this.findByUserId(opts.userId);
    if (existing?.isVerified) {
      throw new Error('User already linked to Telegram — unlink first');
    }

    if (existing) {
      const [row] = await db
        .update(telegramLinks)
        .set({
          linkCode: opts.code,
          expiresAt: opts.expiresAt,
          isVerified: false,
        })
        .where(eq(telegramLinks.id, existing.id))
        .returning();
      return row!;
    }

    const [row] = await db
      .insert(telegramLinks)
      .values({
        userId: opts.userId,
        linkCode: opts.code,
        expiresAt: opts.expiresAt,
        isVerified: false,
      })
      .returning();
    return row!;
  },

  async completeLink(id: string, opts: { chatId: string; username?: string; name?: string }) {
    const [row] = await db
      .update(telegramLinks)
      .set({
        telegramChatId: opts.chatId,
        telegramUsername: opts.username ?? null,
        isVerified: true,
        verifiedAt: new Date(),
      })
      .where(eq(telegramLinks.id, id))
      .returning();
    if (!row) throw new NotFoundError(`Telegram link ${id} not found`);
    return row;
  },

  async unlinkByUserId(userId: string) {
    const [row] = await db
      .update(telegramLinks)
      .set({
        telegramChatId: null,
        telegramUsername: null,
        isVerified: false,
        verifiedAt: null,
      })
      .where(eq(telegramLinks.userId, userId))
      .returning();
    return row ?? null;
  },

  async unlinkByChatId(chatId: string) {
    const [row] = await db
      .update(telegramLinks)
      .set({
        telegramChatId: null,
        telegramUsername: null,
        isVerified: false,
        verifiedAt: null,
      })
      .where(eq(telegramLinks.telegramChatId, chatId))
      .returning();
    return row ?? null;
  },

  /**
   * List verified links for given roles — used by notification target resolution.
   */
  async listVerifiedByUserIds(userIds: string[]) {
    if (!userIds.length) return [];
    return db
      .select()
      .from(telegramLinks)
      .where(
        and(
          sql`${telegramLinks.userId} = ANY(${userIds})`,
          eq(telegramLinks.isVerified, true)
        ) as any
      );
  },

  async listVerifiedByRoles(roles: string[]) {
    if (!roles.length) return [];
    return db.execute(
      sql`SELECT tl.* FROM telegram_links tl
          JOIN users u ON u.id = tl.user_id
          WHERE u.role = ANY(${roles}) AND tl.is_verified = true`
    ) as any;
  },
};