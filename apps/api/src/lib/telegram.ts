/**
 * Telegram bot API client + helpers.
 * Phase 4 Gate 3 — Surat Jalan + Telegram Integration.
 *
 * Calls Telegram Bot API via fetch (no extra dep). Token from env.
 */

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const TELEGRAM_API = 'https://api.telegram.org/bot';

export type TelegramSendResult = {
  ok: boolean;
  messageId?: number;
  error?: string;
};

/**
 * Send a plain text message to a chat_id.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode: 'HTML' | 'MarkdownV2' | 'Markdown' = 'HTML'
): Promise<TelegramSendResult> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.warn({ chatId }, 'TELEGRAM_BOT_TOKEN not set — skipping send');
    return { ok: false, error: 'no_bot_token' };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    const data: any = await res.json();
    if (!data.ok) {
      return { ok: false, error: data.description ?? 'telegram_api_error' };
    }
    return { ok: true, messageId: data.result?.message_id };
  } catch (err: any) {
    logger.error({ err, chatId }, 'Telegram sendMessage failed');
    return { ok: false, error: err.message ?? 'network_error' };
  }
}

/**
 * Send a document (PDF) to a chat.
 */
export async function sendTelegramDocument(
  chatId: string,
  document: { filename: string; buffer: Buffer; caption?: string }
): Promise<TelegramSendResult> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: 'no_bot_token' };
  }

  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    const blob = new Blob([new Uint8Array(document.buffer)], { type: 'application/pdf' });
    form.append('document', blob, document.filename);
    if (document.caption) form.append('caption', document.caption);

    const res = await fetch(`${TELEGRAM_API}${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: form,
    });

    const data: any = await res.json();
    if (!data.ok) return { ok: false, error: data.description ?? 'telegram_api_error' };
    return { ok: true, messageId: data.result?.message_id };
  } catch (err: any) {
    logger.error({ err, chatId }, 'Telegram sendDocument failed');
    return { ok: false, error: err.message ?? 'network_error' };
  }
}

/**
 * Verify incoming webhook secret token (X-Telegram-Bot-Api-Secret-Token).
 */
export function verifyWebhookSecret(provided: string | null | undefined): boolean {
  if (!env.TELEGRAM_WEBHOOK_SECRET) return true; // not configured — skip
  return provided === env.TELEGRAM_WEBHOOK_SECRET;
}

/**
 * Build bot deep link for user to start with a verify code.
 */
export function buildBotDeepLink(code: string): string {
  const username = env.TELEGRAM_BOT_USERNAME ?? 'hekas_pos_bot';
  const bare = code.startsWith('HEKAS-') ? code.slice(6) : code;
  return `https://t.me/${username}?start=${bare}`;
}