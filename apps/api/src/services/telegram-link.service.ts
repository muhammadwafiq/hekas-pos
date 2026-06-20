/**
 * Telegram link service — generate verification codes + complete link.
 * Phase 4 Gate 3.
 */

import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { logger } from '../config/logger.js';
import { users } from '../db/schema/auth.js';
import { telegramLinks } from '../db/schema/telegram.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';
import { telegramLinkRepo } from '../repositories/telegram-link.repo.js';
import { generateHekasLinkCode, generateCode } from '../lib/code-generator.js';
import { buildBotDeepLink } from '../lib/telegram.js';
import type { AuthUser } from '../lib/auth-helper.js';

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const telegramLinkService = {
  /**
   * Generate a fresh link code for a user. Returns code + bot deep link.
   */
  async generateLinkCode(user: AuthUser): Promise<{
    code: string;
    bot_url: string;
    deep_link: string;
    expires_at: string;
  }> {
    const code = generateHekasLinkCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await telegramLinkRepo.upsertPendingCode({
      userId: user.id,
      code,
      expiresAt,
    });

    return {
      code,
      bot_url: buildBotDeepLink(code),
      deep_link: buildBotDeepLink(code),
      expires_at: expiresAt.toISOString(),
    };
  },

  /**
   * Verify a code (called by bot handler or webhook).
   */
  async verifyAndLink(opts: {
    code: string;
    chatId: string;
    telegramUsername?: string;
    telegramFirstName?: string;
  }): Promise<{ success: true; userId: string }> {
    const normalized = opts.code.startsWith('HEKAS-')
      ? opts.code
      : `HEKAS-${opts.code}`;

    const link = await telegramLinkRepo.findByCode(normalized);
    if (!link) {
      throw new ValidationError('Kode tidak valid');
    }

    if (link.isVerified) {
      // Already linked — return existing user
      return { success: true, userId: link.userId };
    }

    if (link.expiresAt < new Date()) {
      throw new ValidationError('Kode sudah kadaluarsa — generate ulang di aplikasi');
    }

    const updated = await telegramLinkRepo.completeLink(link.id, {
      chatId: opts.chatId,
      username: opts.telegramUsername,
      name: opts.telegramFirstName,
    });

    return { success: true, userId: updated.userId };
  },

  async unlinkByUser(user: AuthUser) {
    const result = await telegramLinkRepo.unlinkByUserId(user.id);
    return { success: true, unlinked: !!result };
  },

  async getStatus(user: AuthUser) {
    const link = await telegramLinkRepo.findByUserId(user.id);
    if (!link) {
      return { linked: false };
    }

    return {
      linked: link.isVerified,
      hasPendingCode: !link.isVerified && link.expiresAt > new Date(),
      expiresAt: link.expiresAt,
      verifiedAt: link.verifiedAt,
      telegramUsername: link.telegramUsername,
    };
  },

  /**
   * Get status by chat_id — used by bot /status command.
   * Returns user info if linked.
   */
  async getStatusByChatId(chatId: string): Promise<{
    linked: false;
  } | {
    linked: true;
    userId: string;
    fullName: string;
    username: string;
    role: string;
    verifiedAt: string | null;
  }> {
    const link = await telegramLinkRepo.findByChatId(chatId);
    if (!link || !link.isVerified) return { linked: false };

    const [user] = await db.select().from(users).where(eq(users.id, link.userId)).limit(1);
    return {
      linked: true,
      userId: link.userId,
      fullName: user?.fullName ?? '-',
      username: user?.username ?? '-',
      role: user?.role ?? '-',
      verifiedAt: link.verifiedAt?.toISOString() ?? null,
    };
  },

  /**
   * Unlink by chat_id — used by bot /unlink command.
   */
  async unlinkByChatId(chatId: string): Promise<{ success: true; unlinked: boolean }> {
    const result = await telegramLinkRepo.unlinkByChatId(chatId);
    return { success: true, unlinked: !!result };
  },

  /**
   * Resolve chat IDs for an event — given a list of roles, return all verified chat_ids.
   */
  async resolveChatIdsByRoles(roles: string[]): Promise<string[]> {
    if (!roles.length) return [];

    const result = await telegramLinkRepo.listVerifiedByRoles(roles);
    const rows = (result as any).rows ?? result;
    return (Array.isArray(rows) ? rows : [])
      .filter((r: any) => r.telegram_chat_id)
      .map((r: any) => String(r.telegram_chat_id));
  },
};