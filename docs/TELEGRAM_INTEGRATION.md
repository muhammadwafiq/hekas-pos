# TELEGRAM INTEGRATION — HEKAS POS

**Versi**: 1.0.0
**Tanggal**: 2026-06-19
**Status**: Spesifikasi integrasi Telegram Bot API untuk notifikasi & interaksi
**Dasar**: `PRD.md` v1.0.0 + `FEATURE_MATRIX.md` v1.0.0 + `USER_FLOW.md` v1.0.0 + `DATABASE_DESIGN.md` v1.0.0 + `BACKEND_ARCHITECTURE.md` v1.0.0
**Bot Library**: `grammY` (Asumsi; modern, type-safe, untuk Bun) atau `node-telegram-bot-api`
**API**: Telegram Bot API (https://core.telegram.org/bots/api)

---

## 1. Ringkasan & Use Cases

HEKAS POS menggunakan Telegram Bot untuk:

1. **Push notification** ke Manager & Admin Gudang untuk event operasional penting (lihat FEATURE_MATRIX §17 + PRD §8).
2. **Offline-tolerant delivery** — event di-buffer saat Telegram down (lihat USER_FLOW §7).
3. **Interaksi opsional** (Asumsi Tahap 2) — Manager bisa acknowledge approval via inline button.

### 1.1 Event yang Trigger Notifikasi

| Event                              | Penerima              | Priority | Channel    |
|------------------------------------|-----------------------|----------|------------|
| Surat jalan perlu approval         | Manager               | High     | Push       |
| Surat jalan disetujui              | Admin Gudang          | Normal   | Push       |
| Surat jalan ditolak                | Admin Gudang          | High     | Push       |
| Stok produk kritis                 | Admin Gudang + Manager| High     | Push       |
| Barang masuk berhasil diverifikasi | Admin Gudang + Manager| Normal   | Push       |
| Laporan harian penjualan tersedia  | Manager               | Normal   | Push       |
| Shift kasir dimulai                | Manager               | Low      | Push       |
| Shift kasir diakhiri               | Manager               | Normal   | Push       |
| Error sistem / integrasi           | Manager               | High     | Push       |

> **Catatan**: Per PRD §8 + USER_FLOW §7, sistem harus offline-tolerant — jika Telegram down, event di-buffer di `notification_queue` dan di-retry exponential backoff max 5x.

### 1.2 Non-Goals (Tahap 1)

- ❌ Two-way chat dengan bot (kecuali command `/start`, `/link`, `/status`).
- ❌ File upload ke bot.
- ❌ Inline button untuk aksi (Tahap 2 — Asumsi).
- ❌ Group chat integration.

## 2. Setup Bot

### 2.1 Buat Bot di Telegram

1. Chat dengan `@BotFather` di Telegram.
2. Kirim `/newbot`, ikuti instruksi (nama, username).
3. Simpan **Bot Token** di env var `TELEGRAM_BOT_TOKEN`.
4. Set bot commands via `@BotFather` → `/setcommands`:
   ```
   start - Mulai interaksi & link akun
   link - Hubungkan akun HEKAS dengan Telegram
   status - Cek status integrasi
   unlink - Putuskan link akun
   help - Bantuan
   ```
5. Set bot description & about text.
6. Generate webhook secret: `openssl rand -hex 32` → simpan di `TELEGRAM_WEBHOOK_SECRET`.

### 2.2 Environment Variables

```bash
# .env
TELEGRAM_BOT_TOKEN=123456789:ABCDefghijk...n
TELEGRAM_WEBHOOK_SECRET=abc123def456...n
TELEGRAM_WEBHOOK_URL=https://api.hekas.id/api/telegram/webhook
TELEGRAM_BOT_USERNAME=hekas_pos_bot
```

### 2.3 Webhook Registration

```typescript
// src/services/telegram.service.ts
import { Bot } from 'grammy';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// Command handlers (lihat §5)
bot.command('start', handleStart);
bot.command('link', handleLink);
bot.command('status', handleStatus);
bot.command('unlink', handleUnlink);
bot.command('help', handleHelp);

// Webhook handler (lihat §7)
bot.on('callback_query', handleCallbackQuery);

// Initialize
export async function initTelegram() {
  if (env.NODE_ENV === 'production') {
    await bot.api.setWebhook(env.TELEGRAM_WEBHOOK_URL, {
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['message', 'callback_query']
    });
  } else {
    // Polling mode for dev (Asumsi)
    await bot.start();
  }
}
```

## 3. User Linking Flow

Setiap user (Manager atau Admin Gudang) yang ingin menerima notifikasi harus link akun HEKAS mereka dengan Telegram chat_id.

### 3.1 Flow

```
1. User login ke HEKAS web app
2. Buka Settings → Telegram (Asumsi Tahap 2) atau POST /api/telegram/link
3. Backend generate verification code (e.g. "HEKAS-A4B7C9"), simpan di telegram_links.verify_code + expires_at (15 menit)
4. User klik link "Buka Bot" → deep link ke https://t.me/hekas_pos_bot?start=A4B7C9
5. User klik START di bot
6. Bot terima /start A4B7C9 → verifikasi code → set telegram_links.chat_id, is_verified = true
7. User terima konfirmasi "Akun berhasil di-link"
```

### 3.2 Backend Generate Link

```typescript
// src/services/telegram.service.ts
import { telegramRepo } from '../repositories/telegram.repo';
import { generateCode } from '../lib/code-generator';

export const telegramService = {
  async generateLinkCode(userId: string) {
    const code = `HEKAS-${generateCode(6)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await telegramRepo.upsertLinkCode(userId, code, expiresAt);

    return {
      code,
      bot_url: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${code.split('-')[1]}`,
      deep_link: `tg://resolve?domain=${env.TELEGRAM_BOT_USERNAME}&start=${code.split('-')[1]}`,
      expires_at: expiresAt.toISOString()
    };
  },

  async verifyAndLink(code: string, chatId: string, telegramUser: { username?: string; first_name: string }) {
    const link = await telegramRepo.findLinkByCode(code);
    if (!link || link.verify_expires_at < new Date()) {
      throw new ValidationError('Code tidak valid atau kadaluarsa');
    }

    await telegramRepo.completeLink(link.id, {
      chat_id: chatId,
      is_verified: true,
      telegram_username: telegramUser.username,
      telegram_name: telegramUser.first_name
    });

    return { success: true, user_id: link.user_id };
  }
};
```

### 3.3 Bot Command Handlers

```typescript
// src/workers/telegram-bot.handlers.ts
bot.command('start', async (ctx) => {
  const args = ctx.match?.trim();
  if (!args) {
    await ctx.reply(
      '👋 Selamat datang di HEKAS POS Bot!\n\n' +
      'Untuk menghubungkan akun, buka aplikasi HEKAS POS → Settings → Telegram, ' +
      'lalu klik "Hubungkan Telegram".\n\n' +
      'Atau gunakan perintah /link <code>.'
    );
    return;
  }

  // Verify code from /start <code>
  try {
    const result = await telegramService.verifyAndLink(
      `HEKAS-${args}`,
      String(ctx.chat.id),
      {
        username: ctx.from?.username,
        first_name: ctx.from?.first_name || 'User'
      }
    );

    await ctx.reply(
      '✅ Akun berhasil dihubungkan!\n\n' +
      'Anda akan menerima notifikasi untuk event operasional penting.'
    );
  } catch (err) {
    await ctx.reply(`❌ Gagal menghubungkan: ${err.message}`);
  }
});

bot.command('link', async (ctx) => {
  const args = ctx.match?.trim();
  if (!args) {
    return ctx.reply('Gunakan: /link <code>\nContoh: /link HEKAS-A4B7C9');
  }

  try {
    await telegramService.verifyAndLink(
      args,
      String(ctx.chat.id),
      {
        username: ctx.from?.username,
        first_name: ctx.from?.first_name || 'User'
      }
    );
    await ctx.reply('✅ Akun berhasil dihubungkan!');
  } catch (err) {
    await ctx.reply(`❌ ${err.message}`);
  }
});

bot.command('status', async (ctx) => {
  const chatId = String(ctx.chat.id);
  const link = await telegramRepo.findByChatId(chatId);

  if (!link) {
    return ctx.reply('❌ Akun belum dihubungkan. Gunakan /start untuk memulai.');
  }

  const user = await userRepo.findById(link.user_id);
  await ctx.reply(
    `✅ Status: Terhubung\n\n` +
    `Akun: ${user.full_name}\n` +
    `Username: ${user.username}\n` +
    `Role: ${user.role}\n` +
    `Dihubungkan: ${link.created_at.toLocaleDateString('id-ID')}`
  );
});

bot.command('unlink', async (ctx) => {
  const chatId = String(ctx.chat.id);
  await telegramRepo.unlinkByChatId(chatId);
  await ctx.reply('✅ Akun berhasil diputuskan. Anda tidak akan menerima notifikasi lagi.');
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    '📖 Perintah yang tersedia:\n\n' +
    '/start - Mulai interaksi\n' +
    '/link <code> - Hubungkan akun\n' +
    '/status - Cek status integrasi\n' +
    '/unlink - Putuskan link akun\n' +
    '/help - Bantuan'
  );
});
```

## 4. Notification Events

### 4.1 Message Templates

Setiap event_type punya template message. Pakai Markdown atau HTML (Telegram supports both).

#### Event: `sj_pending_approval`
**Trigger**: Admin Gudang buat Surat Jalan
**Penerima**: Manager

```
📋 *Surat Jalan Perlu Persetujuan*

Nomor: SJ-2406015
Tujuan: Cabang Bandung
Jumlah Item: 12
Referensi: ORD-2406010
Dibuat oleh: Admin Gudang
Waktu: 10 Jun 2026 14:32

[Detail & Approve di aplikasi]
```

#### Event: `sj_approved`
**Trigger**: Manager approve SJ
**Penerima**: Admin Gudang

```
✅ *Surat Jalan Disetujui*

Nomor: SJ-2406015
Disetujui oleh: Manager (Andi)
Waktu: 10 Jun 2026 14:45

Silakan cetak & kirim barang.
```

#### Event: `sj_rejected`
**Trigger**: Manager reject SJ
**Penerima**: Admin Gudang

```
❌ *Surat Jalan Ditolak*

Nomor: SJ-2406015
Ditolak oleh: Manager (Andi)
Alasan: Stok tidak cukup untuk cabang tujuan

Waktu: 10 Jun 2026 14:45

Mohon revise & submit ulang.
```

#### Event: `stok_kritis`
**Trigger**: Stok produk <= min_stock (dari restock, sale, atau cron check)
**Penerima**: Admin Gudang + Manager

```
⚠️ *Stok Kritis*

Produk: Indomie Goreng (SBK001)
Stok saat ini: 3 pcs
Minimum: 50 pcs

Segera lakukan restock.

[Lihat Inventaris]
```

#### Event: `po_verified`
**Trigger**: Admin Gudang verifikasi PO
**Penerima**: Admin Gudang + Manager

```
✅ *Barang Masuk Diverifikasi*

PO: PO-2406012
Supplier: PT Indofood Sukses Makmur
Jumlah item: 15
Total nilai: Rp 4.500.000
Diverifikasi oleh: Admin Gudang

Waktu: 10 Jun 2026 13:15
```

#### Event: `daily_report_ready`
**Trigger**: pg-boss cron (00:30 WIB)
**Penerima**: Manager

```
📊 *Laporan Harian Tersedia*

Tanggal: 9 Juni 2026
Total Transaksi: 142
Total Penjualan: Rp 12.450.000
Produk Terlaris: Aqua 600ml (48 pcs)

[Download PDF] (link ke app)
```

#### Event: `shift_started`
**Trigger**: Kasir mulai shift
**Penerima**: Manager

```
🟢 *Shift Dimulai*

Kasir: Andi Nugraha
Shift: SHF-2406010
Mulai: 08:02 WIB
Modal Awal: Rp 200.000

Outlet: Outlet Utama
```

#### Event: `shift_ended`
**Trigger**: Kasir akhiri shift
**Penerima**: Manager

```
🔴 *Shift Diakhiri*

Kasir: Andi Nugraha
Shift: SHF-2406010
Selesai: 16:30 WIB
Durasi: 8 jam 28 menit
Total Transaksi: 87
Total Penjualan: Rp 4.250.000
Modal Akhir: Rp 245.000

[Detail Shift]
```

#### Event: `system_error`
**Trigger**: Internal error / integration failure (Telegram down bukan, tapi DB error / Drizzle error / Elysia crash)
**Penerima**: Manager

```
🚨 *Error Sistem*

Tipe: DATABASE_ERROR
Pesan: Connection timeout ke primary DB
Endpoint: POST /api/orders/:id/complete
Trace ID: req_abc123xyz
Waktu: 10 Jun 2026 15:22

Sistem mungkin terganggu. Mohon cek dashboard.
```

### 4.2 Message Rendering

```typescript
// src/services/telegram-message-renderer.ts
export const messageRenderer = {
  render(eventType: string, payload: any): { text: string; options?: any } {
    switch (eventType) {
      case 'sj_pending_approval':
        return {
          text:
            `📋 *Surat Jalan Perlu Persetujuan*\n\n` +
            `Nomor: ${payload.sj_no}\n` +
            `Tujuan: ${payload.destination}\n` +
            `Jumlah Item: ${payload.total_items}\n` +
            `Referensi: ${payload.order_reference || '-'}\n` +
            `Dibuat oleh: ${payload.created_by_name}\n` +
            `Waktu: ${formatDateTime(payload.created_at)}\n\n` +
            `[Detail & Approve di aplikasi]`,
          options: { parse_mode: 'Markdown' }
        };

      case 'sj_approved':
        return {
          text:
            `✅ *Surat Jalan Disetujui*\n\n` +
            `Nomor: ${payload.sj_no}\n` +
            `Disetujui oleh: ${payload.approved_by_name}\n` +
            `Waktu: ${formatDateTime(payload.approved_at)}\n\n` +
            `Silakan cetak & kirim barang.`,
          options: { parse_mode: 'Markdown' }
        };

      // ... (semua 9 event di atas)

      default:
        return {
          text: `[HEKAS] Event: ${eventType}\n\n${JSON.stringify(payload, null, 2)}`
        };
    }
  }
};

function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
```

## 5. Notification Dispatch

### 5.1 Enqueue Pattern

Setiap kali event terjadi, service enqueue ke pg-boss (lihat BACKEND_ARCHITECTURE §10):

```typescript
// Contoh di order.service.ts
export const orderService = {
  async completeOrder(...) {
    // ... existing logic

    if (order.member_id) {
      // Get member telegram link (Asumsi: Tahap 2)
      // Untuk MVP, skip member notification
    }

    // Enqueue stock alert jika ada produk jadi kritis
    for (const item of order.items) {
      const stock = await stockRepo.findByProduct(item.product_id);
      if (stock.quantity <= stock.min_stock) {
        await notificationService.enqueueTelegram(
          'stok_kritis',
          {
            product_name: item.product_name_snapshot,
            sku: item.sku_snapshot,
            current_stock: stock.quantity,
            min_stock: stock.min_stock
          },
          await getTargetsForEvent('stok_kritis') // ['gudang', 'manager']
        );
      }
    }

    return order;
  }
};
```

### 5.2 Targets Resolution

```typescript
// src/services/notification.service.ts
async function getTargetsForEvent(eventType: string): Promise<string[]> {
  const recipients = await notificationRepo.getRecipients(eventType);
  // recipients adalah array of {user_id, role}
  const chatIds = await Promise.all(
    recipients.map(async (r) => {
      const link = await telegramRepo.findByUserId(r.user_id);
      return link?.is_verified ? link.chat_id : null;
    })
  );
  return chatIds.filter((id): id is string => id !== null);
}
```

### 5.3 Recipients Config

```typescript
// src/config/notification-recipients.ts
export const NOTIFICATION_RECIPIENTS: Record<string, Role[]> = {
  'sj_pending_approval': ['manager'],
  'sj_approved': ['gudang'],
  'sj_rejected': ['gudang'],
  'stok_kritis': ['gudang', 'manager'],
  'po_verified': ['gudang', 'manager'],
  'daily_report_ready': ['manager'],
  'shift_started': ['manager'],
  'shift_ended': ['manager'],
  'system_error': ['manager']
};
```

## 6. Queue & Retry Mechanism

### 6.1 Flow

```
Event Trigger
    ↓
Insert ke notification_queue (status='PENDING', attempts=0)
    ↓
pg-boss worker 'telegram.send' consume
    ↓
Call Telegram Bot API (sendMessage)
    ↓ (success)
Update queue.status='DONE'
Insert telegram_messages (status='SENT')
    ↓ (failure)
attempts++ → next_retry_at = now + exp_backoff
attempts < 5 → retry (pg-boss automatic)
attempts >= 5 → queue.status='FAILED', messages.status='FAILED'
```

### 6.2 Retry Configuration

```typescript
// src/workers/telegram-sender.worker.ts
import { boss } from './boss';
import { sendTelegramMessage } from '../lib/telegram';
import { messageRenderer } from '../services/telegram-message-renderer';
import { telegramRepo } from '../repositories/telegram.repo';
import { logger } from '../config/logger';

const MAX_ATTEMPTS = 5;

export const telegramSenderWorker = {
  async handle(job: any) {
    const { queue_id } = job.data;

    const queue = await telegramRepo.findQueueItem(queue_id);
    if (!queue) {
      logger.warn({ queue_id }, 'queue item not found');
      return;
    }

    const message = messageRenderer.render(
      queue.payload.event_type,
      queue.payload.data
    );

    try {
      await sendTelegramMessage(
        queue.target,
        message.text,
        message.options
      );

      await telegramRepo.updateQueueStatus(queue_id, 'DONE');
      await telegramRepo.insertMessage({
        chat_id: queue.target,
        event_type: queue.payload.event_type,
        payload: message,
        status: 'SENT',
        attempts: queue.attempts + 1,
        sent_at: new Date()
      });

      logger.info({
        queue_id,
        event_type: queue.payload.event_type,
        chat_id: queue.target,
        attempts: queue.attempts + 1
      }, 'telegram sent');

    } catch (err: any) {
      const newAttempts = queue.attempts + 1;

      if (newAttempts >= MAX_ATTEMPTS) {
        await telegramRepo.updateQueueStatus(queue_id, 'FAILED', err.message);
        await telegramRepo.insertMessage({
          chat_id: queue.target,
          event_type: queue.payload.event_type,
          payload: message,
          status: 'FAILED',
          attempts: newAttempts,
          last_error: err.message
        });

        // Optional: send system_error to manager
        if (queue.payload.event_type !== 'system_error') {
          await notificationService.enqueueTelegram(
            'system_error',
            {
              type: 'TELEGRAM_DELIVERY_FAILED',
              original_event: queue.payload.event_type,
              chat_id: queue.target,
              attempts: newAttempts,
              last_error: err.message
            },
            await getTargetsForEvent('system_error')
          );
        }

        logger.error({
          queue_id,
          event_type: queue.payload.event_type,
          chat_id: queue.target,
          attempts: newAttempts,
          error: err.message
        }, 'telegram FAILED after max attempts');

        return; // don't throw, mark as done
      }

      // Update for retry
      await telegramRepo.updateQueueRetry(
        queue_id,
        newAttempts,
        new Date(Date.now + Math.pow(2, newAttempts) * 60_000), // exponential: 2min, 4min, 8min, 16min, 32min
        err.message
      );

      logger.warn({
        queue_id,
        attempts: newAttempts,
        error: err.message
      }, 'telegram send failed, will retry');

      throw err; // pg-boss retries
    }
  }
};
```

### 6.3 Telegram API Client

```typescript
// src/lib/telegram.ts
import { bot } from '../services/telegram.service'; // or direct API

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: { parse_mode?: 'Markdown' | 'HTML' }
): Promise<any> {
  return await bot.api.sendMessage(chatId, text, {
    parse_mode: options?.parse_mode,
    disable_web_page_preview: true
  });
}

export async function setWebhook(url: string, secretToken: string) {
  return await bot.api.setWebhook(url, {
    secret_token: secretToken,
    allowed_updates: ['message', 'callback_query']
  });
}

export async function deleteWebhook() {
  return await bot.api.deleteWebhook();
}

export async function getWebhookInfo() {
  return await bot.api.getWebhookInfo();
}
```

## 7. Webhook Handler

### 7.1 Endpoint

Telegram mengirim update ke webhook URL. Handler di backend ElysiaJS:

```typescript
// src/routes/webhook/telegram.ts
import { Elysia } from 'elysia';
import { bot } from '../../services/telegram.service';
import { env } from '../../config/env';

export const telegramWebhookRoutes = new Elysia({ prefix: '/api/telegram' })
  .post('/webhook', async ({ request, set }) => {
    // Verify secret token (Telegram sends in X-Telegram-Bot-Api-Secret-Token)
    const secretToken = request.headers.get('x-telegram-bot-api-secret-token');
    if (secretToken !== env.TELEGRAM_WEBHOOK_SECRET) {
      set.status = 401;
      return { ok: false, error: 'Unauthorized' };
    }

    // Parse update body
    const update = await request.json();

    // Hand off to bot (grammY handles routing to command handlers)
    try {
      await bot.handleUpdate(update);
      return { ok: true };
    } catch (err) {
      logger.error({ err, update }, 'telegram webhook error');
      // Return 200 to prevent Telegram from retrying (we log + handle internally)
      return { ok: false, error: 'Internal handler error' };
    }
  }, {
    // No rate limit (Telegram server)
    // No auth (verified via secret token)
    // No RBAC (public webhook)
  });
```

### 7.2 Webhook Registration Script

Jalankan sekali untuk register webhook:

```bash
# scripts/register-telegram-webhook.ts
import { setWebhook } from '../src/lib/telegram';

const url = process.env.TELEGRAM_WEBHOOK_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!url || !secret) {
  console.error('TELEGRAM_WEBHOOK_URL & TELEGRAM_WEBHOOK_SECRET required');
  process.exit(1);
}

const result = await setWebhook(url, secret);
console.log('Webhook registered:', result);
```

```bash
bun run scripts/register-telegram-webhook.ts
```

## 8. Security

### 8.1 Webhook Authentication

- **Secret token**: Telegram mengirim `X-Telegram-Bot-Api-Secret-Token` header. Backend verify dengan `TELEGRAM_WEBHOOK_SECRET` env var. Reject 401 jika tidak match.
- **HTTPS only**: Production wajib HTTPS (Telegram reject HTTP untuk webhook).
- **IP whitelist (opsional)**: Telegram gunakan beberapa IP range. Bisa pakai firewall (Asumsi Tahap 2).

### 8.2 Bot Token Protection

- **Env var only**: `TELEGRAM_BOT_TOKEN` tidak pernah di-expose ke response API atau log.
- **No client-side**: Frontend tidak pernah akses Telegram API langsung. Semua via backend.

### 8.3 User Data

- **Chat ID**: Disimpan sebagai string (Telegram ID bisa besar).
- **Username**: Disimpan untuk display, bukan untuk auth.
- **Message content**: Log disimpan di `telegram_messages` untuk audit. Retention 90 hari (Asumsi), cleanup via pg-boss cron.

### 8.4 Rate Limit

- Telegram Bot API rate limit: 30 msg/sec global, 1 msg/sec per chat (untuk chat yang sama).
- Backend enqueue + worker (pg-boss teamSize: 5) → aman.

## 9. Monitoring & Logging

### 9.1 Metrics (Asumsi pakai Prometheus)

| Metric                              | Tipe    | Label                       |
|-------------------------------------|---------|-----------------------------|
| `telegram_send_total`               | counter | event_type, status          |
| `telegram_send_duration_seconds`    | histogram | event_type                |
| `telegram_queue_size`               | gauge   | status                      |
| `telegram_send_failures_total`      | counter | event_type, error_code      |
| `telegram_active_links`             | gauge   | role                        |

### 9.2 Logs

Setiap event kirim/log:

```json
{
  "level": "info",
  "time": "2026-06-19T14:32:00.000Z",
  "request_id": "req_abc123",
  "service": "hekas-api",
  "msg": "telegram sent",
  "queue_id": 142,
  "event_type": "sj_pending_approval",
  "chat_id": "123456789",
  "attempts": 1,
  "duration_ms": 245
}
```

### 9.3 Dashboard Endpoints (Asumsi)

- `GET /api/admin/telegram/stats` — total sent, failed, retry counts.
- `GET /api/admin/telegram/queue?status=PENDING` — list pending queue items.
- `POST /api/admin/telegram/queue/:id/retry` — manual retry.

## 10. Testing

### 10.1 Unit Tests

- `messageRenderer.render()` per event type.
- `notificationService.enqueueTelegram()` enqueue dengan target benar.
- `telegramService.verifyAndLink()` valid/invalid code.

### 10.2 Integration Tests

- Full flow: trigger event → enqueue → worker → Telegram mock → check DB updated.
- Retry flow: Telegram API error → queue retry with backoff → eventually success/fail.

### 10.3 E2E (Telegram Test Environment)

- Buat bot test (`@hekas_pos_test_bot`).
- Pakai `telegram-test-api` atau hit real Telegram API dengan user dummy.
- Verify message received by test chat.

## 11. Failure Handling & Edge Cases

### 11.1 Skenario & Response

| Situasi                                | Sistem Behavior                                          |
|----------------------------------------|----------------------------------------------------------|
| Telegram API 5xx                       | Retry dengan exponential backoff (max 5x)                |
| Telegram API 429 (rate limit)          | Retry dengan longer delay (60s+)                          |
| Telegram API 4xx (bad request)         | Mark FAILED immediately (jangan retry, format error)     |
| Chat ID invalid / user blocked bot     | Mark FAILED, set telegram_links.is_active = false        |
| Bot token invalid                      | Critical error, alert via in-app + system_error event    |
| Webhook signature mismatch             | Reject 401, log security event                           |
| Database down saat enqueue             | Service throws error → caller handle (transaction rollback) |
| Worker crash saat proses               | pg-boss restart, retry job                                |
| Event payload malformed               | Mark FAILED with error, don't retry                       |

### 11.2 User Unlink Flow

Jika user unlink via `/unlink` command atau via web settings:
1. Set `telegram_links.is_active = false`.
2. Notification dispatcher skip chat_id ini.
3. Log unlink event di audit_logs.

User bisa re-link kapan saja dengan generate code baru.

## 12. Catatan & Prinsip

### 12.1 Yang TIDAK Boleh Dilakukan

1. **Jangan hardcode chat_id** di source code. Selalu dari `telegram_links`.
2. **Jangan kirim PII (password, PIN) via Telegram**. Hanya info operasional non-sensitive.
3. **Jangan blocking call ke Telegram API di main request thread**. Selalu enqueue.
4. **Jangan retry tanpa backoff**. Bisa trigger rate limit永久.
5. **Jangan lupa verify webhook secret**. Tanpa itu, siapa saja bisa kirim fake update.
6. **Jangan simpan message content永久**. Ada PII + storage cost. Retention 90 hari (Asumsi).

### 12.2 Prinsip

1. **At-least-once delivery**: Dengan retry, message bisa duplicate. Idempotent di sisi receiver (Asumsi: chat_id + timestamp + content).
2. **Offline-tolerant**: Queue buffer saat Telegram down, retry saat up.
3. **Graceful degradation**: Jika Telegram永久 down, sistem operasional TETAP berjalan (in-app notif tetap).
4. **Auditability**: Semua message masuk `telegram_messages` log dengan status.
5. **User opt-in**: User harus explicit link akun. Tidak auto-link.

## 13. Open Questions

1. **Inline button untuk approve/reject**: Tahap 2? (Asumsi: ya, untuk manager approval flow)
2. **Multi-bot support**: Jika multi-outlet, perlu bot per outlet atau 1 bot global? (Asumsi: 1 bot global, filter by outlet_id)
3. **Localization**: Bahasa Indonesia only atau perlu English? (Asumsi: ID only per PRD §7)
4. **Rich message formatting**: Markdown atau HTML? Markdown lebih simple, HTML lebih flexible. (Asumsi: Markdown)
5. **Message persistence**: Simpan full message di DB atau hanya metadata? (Asumsi: payload saja, bukan full rendered text, untuk hemat storage)
6. **Admin command untuk broadcast**: Manager bisa kirim announcement ke semua user? (Asumsi: Tahap 2)
7. **Bot analytics**: Tracking open rate / click rate? (Asumsi: tidak di MVP)
8. **Webhook vs Polling**: Production pakai webhook, dev pakai polling? (Asumsi: webhook prod, polling dev — sudah di §2.3)

---

**Akhir dokumen TELEGRAM_INTEGRATION.md**
