/**
 * Admin outlet management routes — multi-tenant outlet CRUD.
 *
 * Endpoints (require role: manager or super_admin):
 * - GET    /api/admin/outlets          List outlets in user's organization
 * - GET    /api/admin/outlets/:id      Get outlet detail
 * - POST   /api/admin/outlets          Create new outlet (enforces plan limit)
 * - PATCH  /api/admin/outlets/:id      Update outlet (name, address, phone)
 * - POST   /api/admin/outlets/:id/deactivate Deactivate outlet (no delete)
 *
 * Outlet limit enforced via `enforceOutletLimit` middleware.
 */

import { Elysia, t } from 'elysia';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../../config/database.js';
import {
  organizations,
  outlets,
} from '../../db/schema/subscription.js';
import { outletSettings } from '../../db/schema/system.js';
import { users } from '../../db/schema/auth.js';
import { getAuthUser, requireRole } from '../../lib/auth-helper.js';
import { assertCanCreateOutlet, getActiveSubscription } from '../../services/subscription.service.js';
import { logger } from '../../config/logger.js';

export const adminOutletRoutes = new Elysia({ prefix: '/api/admin/outlets', tags: ['Admin - Outlets'] })

  // ====== LIST OUTLETS (in user's organization) ======
  .get('/', async ({ jwt, headers }: any) => {
    const user = await requireRole(jwt, headers, ['manager', 'super_admin']);

    // Resolve organizationId for this user
    let orgId: string | null = null;
    if (user.role === 'super_admin') {
      // Super admin: list ALL outlets (with ?orgId filter optional)
      const filterOrgId = (headers as any)['x-org-id'] as string | undefined;
      if (filterOrgId) {
        orgId = filterOrgId;
      } else {
        // No filter: list all outlets
        const all = await db
          .select()
          .from(outlets)
          .orderBy(desc(outlets.createdAt));
        return { ok: true, data: all };
      }
    } else {
      // Manager: list outlets in their org only
      if (!user.outletId) {
        return { ok: true, data: [] };
      }
      const [userOutlet] = await db
        .select()
        .from(outlets)
        .where(eq(outlets.id, user.outletId))
        .limit(1);
      orgId = userOutlet?.organizationId ?? null;
    }

    if (!orgId) {
      return { ok: true, data: [] };
    }

    const orgOutlets = await db
      .select()
      .from(outlets)
      .where(eq(outlets.organizationId, orgId))
      .orderBy(desc(outlets.createdAt));

    return { ok: true, data: orgOutlets };
  })

  // ====== OUTLET DETAIL ======
  .get('/:id', async ({ params, jwt, headers, set }: any) => {
    const user = await requireRole(jwt, headers, ['manager', 'super_admin', 'admin_gudang', 'kasir']);

    const [outlet] = await db
      .select()
      .from(outlets)
      .where(eq(outlets.id, params.id))
      .limit(1);

    if (!outlet) {
      set.status = 404;
      return { ok: false, error: 'not_found' };
    }

    // Kasir/admin_gudang can only see their own outlet
    if (user.role === 'kasir' || user.role === 'admin_gudang') {
      if (user.outletId !== outlet.id) {
        set.status = 403;
        return { ok: false, error: 'forbidden' };
      }
    }

    return { ok: true, data: outlet };
  })

  // ====== CREATE OUTLET (enforces plan limit) ======
  .post('/', async ({ body, jwt, headers, set }: any) => {
    try {
      const user = await requireRole(jwt, headers, ['manager', 'super_admin']);

      // Resolve organizationId
      let orgId: string;
      if (user.role === 'super_admin') {
        // Super admin: read orgId from body OR X-Org-Id header (for convenience)
        orgId = body.organizationId ?? (headers as any)['x-org-id'];
        if (!orgId) {
          set.status = 400;
          return { ok: false, error: 'organizationId_required', message: 'Super admin must specify organizationId in body or X-Org-Id header' };
        }
      } else {
        if (!user.outletId) {
          set.status = 400;
          return { ok: false, error: 'user_has_no_outlet' };
        }
        const [userOutlet] = await db
          .select()
          .from(outlets)
          .where(eq(outlets.id, user.outletId))
          .limit(1);
        if (!userOutlet) {
          set.status = 400;
          return { ok: false, error: 'user_outlet_not_found' };
        }
        orgId = userOutlet.organizationId;
      }

      // ⭐ ENFORCE OUTLET LIMIT (throws SubscriptionError if at limit)
      await assertCanCreateOutlet(orgId);

      // Create outlet (code is NOT NULL, must be unique per org)
      const outletCode = body.code ?? `OUT-${Date.now().toString(36).toUpperCase()}`;
      const [newOutlet] = await db
        .insert(outlets)
        .values({
          organizationId: orgId,
          name: body.name,
          code: outletCode,
          address: body.address ?? null,
          phone: body.phone ?? null,
          status: 'active',
        })
        .returning();

      // Also create default outlet_settings (timezone, currency, etc.)
      // outletId uses the new outlet's UUID; id is auto-generated
      await db.insert(outletSettings).values({
        outletId: newOutlet.id,
        name: body.name,  // outlet_settings.name is NOT NULL
        timezone: 'Asia/Jakarta',
        currency: 'IDR',
        taxRate: '0',
        receiptHeader: '',
        receiptFooter: 'Terima kasih atas kunjungan Anda!',
        isActive: true,
      });

      logger.info({
        outletId: newOutlet.id,
        orgId,
        createdBy: user.id,
        name: body.name,
      }, 'Outlet created');

      return { ok: true, data: newOutlet };
    } catch (e: any) {
      // Subscription limit errors return 403
      if (e.code === 'outlet_limit_reached' || e.code === 'no_subscription' || e.code === 'subscription_expired') {
        set.status = 403;
        return {
          ok: false,
          error: e.code,
          message: e.message,
          upgradeUrl: '/admin/subscription/upgrade',
        };
      }
      logger.error({ err: e.message }, 'Failed to create outlet');
      set.status = e.statusCode ?? 500;
      return { ok: false, error: 'internal', message: e.message };
    }
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 255 }),
      code: t.Optional(t.String({ maxLength: 50 })),
      address: t.Optional(t.String()),
      phone: t.Optional(t.String({ maxLength: 50 })),
      email: t.Optional(t.String({ format: 'email' })),
      organizationId: t.Optional(t.String()),  // super_admin only
    }),
  })

  // ====== UPDATE OUTLET ======
  .patch('/:id', async ({ params, body, jwt, headers, set }: any) => {
    const user = await requireRole(jwt, headers, ['manager', 'super_admin']);

    const [outlet] = await db
      .select()
      .from(outlets)
      .where(eq(outlets.id, params.id))
      .limit(1);

    if (!outlet) {
      set.status = 404;
      return { ok: false, error: 'not_found' };
    }

    // Manager: only their org
    if (user.role === 'manager' && user.outletId) {
      const [userOutlet] = await db
        .select()
        .from(outlets)
        .where(eq(outlets.id, user.outletId))
        .limit(1);
      if (userOutlet?.organizationId !== outlet.organizationId) {
        set.status = 403;
        return { ok: false, error: 'forbidden' };
      }
    }

    const updates: any = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.code !== undefined) updates.code = body.code;
    if (body.address !== undefined) updates.address = body.address;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.email !== undefined) updates.email = body.email;
    if (body.status !== undefined) updates.status = body.status as any;  // 'active' | 'suspended' | 'cancelled'

    const [updated] = await db
      .update(outlets)
      .set(updates)
      .where(eq(outlets.id, params.id))
      .returning();

    return { ok: true, data: updated };
  }, {
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
      code: t.Optional(t.String({ maxLength: 50 })),
      address: t.Optional(t.String()),
      phone: t.Optional(t.String({ maxLength: 50 })),
      email: t.Optional(t.String({ format: 'email' })),
      status: t.Optional(t.Union([
        t.Literal('active'),
        t.Literal('suspended'),
        t.Literal('cancelled'),
      ])),
    }),
  })

  // ====== DEACTIVATE OUTLET (no hard delete to preserve data) ======
  .post('/:id/deactivate', async ({ params, jwt, headers, set }: any) => {
    const user = await requireRole(jwt, headers, ['manager', 'super_admin']);

    const [outlet] = await db
      .select()
      .from(outlets)
      .where(eq(outlets.id, params.id))
      .limit(1);

    if (!outlet) {
      set.status = 404;
      return { ok: false, error: 'not_found' };
    }

    if (user.role === 'manager' && user.outletId) {
      const [userOutlet] = await db
        .select()
        .from(outlets)
        .where(eq(outlets.id, user.outletId))
        .limit(1);
      if (userOutlet?.organizationId !== outlet.organizationId) {
        set.status = 403;
        return { ok: false, error: 'forbidden' };
      }
    }

    const [updated] = await db
      .update(outlets)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(eq(outlets.id, params.id))
      .returning();

    return { ok: true, data: updated };
  })

  // ====== STATS: outlet count vs limit ======
  .get('/stats/usage', async ({ jwt, headers }: any) => {
    const user = await requireRole(jwt, headers, ['manager', 'super_admin']);

    let orgId: string;
    if (user.role === 'super_admin') {
      orgId = (headers as any)['x-org-id'];
      if (!orgId) {
        return { ok: false, error: 'x-org-id_header_required' };
      }
    } else {
      if (!user.outletId) {
        return { ok: true, data: { current: 0, max: 0, unlimited: true } };
      }
      const [userOutlet] = await db
        .select()
        .from(outlets)
        .where(eq(outlets.id, user.outletId))
        .limit(1);
      if (!userOutlet) {
        return { ok: true, data: { current: 0, max: 0 } };
      }
      orgId = userOutlet.organizationId;
    }

    const sub = await getActiveSubscription(orgId);
    if (!sub) {
      return { ok: true, data: { current: 0, max: 0, hasSubscription: false } };
    }

    // Get plan limits
    const { subscriptionPlans } = await import('../../db/schema/subscription.js');
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.code, sub.planCode))
      .limit(1);

    const [outletCountRow] = await db
      .select({ count: count() })
      .from(outlets)
      .where(and(
        eq(outlets.organizationId, orgId),
        eq(outlets.status, 'active'),
      ));

    const current = Number(outletCountRow?.count ?? 0);
    const max = sub.customMaxOutlets ?? plan?.maxOutlets ?? null;

    return {
      ok: true,
      data: {
        current,
        max,
        unlimited: max === null,
        plan: sub.planCode,
        hasSubscription: true,
      },
    };
  });
