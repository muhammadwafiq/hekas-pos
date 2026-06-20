/**
 * Telegram webhook handler — receives updates from Bot API.
 * Phase 4 Gate 3.
 *
 * Mounted at POST /api/telegram/webhook (no auth — verified via secret token).
 * Bot commands handled inline for simplicity (no separate bot instance).
 */

import { Elysia, t } from 'elysia';
import { logger } from '../../config/logger.js';
import { verifyWebhookSecret, sendTelegramMessage } from '../../lib/telegram.js';
import { telegramLinkService } from '../../services/telegram-link.service.js';

type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
  };
};

export const telegramWebhookRoutes = new Elysia({ prefix: '/api/telegram/webhook', tags: ['Telegram Webhook'] })

  .post(
    '/',
    async ({ body, request, set }) => {
      const secret = request.headers.get('x-telegram-bot-api-secret-token');
      if (!verifyWebhookSecret(secret)) {
        set.status = 401;
        return { ok: false, error: 'unauthorized' };
      }

      const update = body as TgUpdate;
      if (!update.message?.text) {
        return { ok: true, skipped: 'no_text' };
      }

      const text = update.message.text.trim();
      const chatId = String(update.message.chat.id);
      const from = update.message.from;

      try {
        await handleBotCommand({ text, chatId, from });
      } catch (err: any) {
        logger.error({ err, text }, 'Bot command handler failed');
        await sendTelegramMessage(chatId, `❌ Terjadi kesalahan: ${err.message ?? 'unknown'}`).catch(() => {});
      }

      return { ok: true };
    },
    {
      body: t.Any(),
    }
  );

async function handleBotCommand(opts: {
  text: string;
  chatId: string;
  from?: { id: number; username?: string; first_name?: string };
}) {
  const { text, chatId, from } = opts;
  const [cmd, ...args] = text.split(/\s+/);

  switch (cmd) {
    case '/start': {
      const code = args[0];
      if (!code) {
        await sendTelegramMessage(
          chatId,
          `👋 Selamat datang di HEKAS POS Bot!\n\n` +
            `Untuk menghubungkan akun, buka aplikasi HEKAS POS → Settings → Telegram, ` +
            `lalu klik "Hubungkan Telegram" untuk mendapatkan kode.\n\n` +
            `Atau gunakan /link <kode>.`
        );
        return;
      }
      try {
        const result = await telegramLinkService.verifyAndLink({
          code,
          chatId,
          telegramUsername: from?.username,
          telegramFirstName: from?.first_name,
        });
        await sendTelegramMessage(
          chatId,
          `✅ Akun berhasil dihubungkan!\n\n` +
            `Anda akan menerima notifikasi untuk event operasional penting.`
        );
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Gagal menghubungkan: ${err.message}`);
      }
      return;
    }

    case '/link': {
      const code = args[0];
      if (!code) {
        await sendTelegramMessage(chatId, `Gunakan: /link <kode>\nContoh: /link HEKAS-AB12CD`);
        return;
      }
      try {
        await telegramLinkService.verifyAndLink({
          code,
          chatId,
          telegramUsername: from?.username,
          telegramFirstName: from?.first_name,
        });
        await sendTelegramMessage(chatId, `✅ Akun berhasil dihubungkan!`);
      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ ${err.message}`);
      }
      return;
    }

    case '/status': {
      try {
        const status = await telegramLinkService.getStatusByChatId?.(chatId);
        if (!status || !status.linked) {
          await sendTelegramMessage(chatId, `❌ Akun belum dihubungkan. Gunakan /start untuk memulai.`);
          return;
        }
        await sendTelegramMessage(
          chatId,
          `✅ Status: Terhubung\n\n` +
            `Akun: ${status.fullName}\n` +
            `Username: ${status.username}\n` +
            `Role: ${status.role}\n` +
            `Dihubungkan: ${status.verifiedAt}`
        );
      } catch {
        await sendTelegramMessage(chatId, `❌ Akun belum dihubungkan.`);
      }
      return;
    }

    case '/unlink': {
      await telegramLinkService.unlinkByChatId?.(chatId);
      await sendTelegramMessage(
        chatId,
        `✅ Akun berhasil diputuskan. Anda tidak akan menerima notifikasi lagi.`
      );
      return;
    }

    case '/help': {
      await sendTelegramMessage(
        chatId,
        `📖 Perintah yang tersedia:\n\n` +
          `/start [kode] - Mulai interaksi\n` +
          `/link <kode> - Hubungkan akun\n` +
          `/status - Cek status integrasi\n` +
          `/unlink - Putuskan link akun\n` +
          `/help - Bantuan`
      );
      return;
    }

    default:
      await sendTelegramMessage(
        chatId,
        `❓ Perintah tidak dikenal: ${cmd}\n\nKetik /help untuk melihat daftar perintah.`
      );
  }
}