/**
 * Telegram link routes — generate/unlink/status.
 * Phase 4 Gate 3.
 */

import { Elysia, t } from 'elysia';
import { getAuthUser } from '../lib/auth-helper.js';
import { authorize as requireRole } from '../lib/authorize.js';
import { telegramLinkService } from '../services/telegram-link.service.js';
import { notificationService } from '../services/notification.service.js';
import { telegramMessageRepo } from '../repositories/notification-queue.repo.js';
import { telegramLinkRepo } from '../repositories/telegram-link.repo.js';
import { NotFoundError } from '../lib/errors.js';

export const telegramRoutes = new Elysia({ prefix: '/api/telegram', tags: ['Telegram'] })

  // Generate link code (for verified users — manager/admin_gudang)
  .post('/link', async ({ jwt, headers }) => {
    const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    return telegramLinkService.generateLinkCode(user);
  })

  // Get link status
  .get('/status', async ({ jwt, headers }) => {
    const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager', 'kasir']);
    return telegramLinkService.getStatus(user);
  })

  // Unlink (revoke binding)
  .delete('/link', async ({ jwt, headers }) => {
    const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager', 'kasir']);
    return telegramLinkService.unlinkByUser(user);
  })

  // List notification feed (last 50 messages for current user's link)
  .get('/messages', async ({ jwt, headers }) => {
    const user = await requireRole(await getAuthUser(jwt, headers), ['admin_gudang', 'manager']);
    const link = await telegramLinkRepo.findByUserId(user.id);
    if (!link) throw new NotFoundError('No telegram link for this user');
    return telegramMessageRepo.listByLink(link.id, 50);
  })

  // Admin: notification queue stats
  .get('/queue/stats', async ({ jwt, headers }) => {
    await requireRole(await getAuthUser(jwt, headers), ['manager']);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return notificationService.stats({ since });
  })

  // Admin: list recent queue items
  .get('/queue', async ({ jwt, query, headers }) => {
    await requireRole(await getAuthUser(jwt, headers), ['manager']);
    return notificationService.listQueue({
      status: query.status as string | undefined,
      limit: Number(query.limit ?? 50),
    });
  });