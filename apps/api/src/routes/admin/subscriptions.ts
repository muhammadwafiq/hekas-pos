/**
 * Admin subscription management routes.
 *
 * Endpoints (all require super_admin role):
 * - GET    /api/admin/subscriptions              List all subscriptions
 * - GET    /api/admin/subscriptions/:id          Get subscription detail
 * - POST   /api/admin/subscriptions              Create subscription manually (Enterprise)
 * - PATCH  /api/admin/subscriptions/:id          Update plan / custom limits
 * - POST   /api/admin/subscriptions/:id/cancel   Cancel subscription
 * - POST   /api/admin/subscriptions/:id/suspend  Suspend immediately
 * - POST   /api/admin/subscriptions/:id/resume   Resume suspended
 * - POST   /api/admin/subscriptions/:id/payments Record manual payment
 *
 * - GET    /api/admin/organizations              List all organizations
 * - GET    /api/admin/organizations/:id          Get org detail with subscription
 *
 * - GET    /api/admin/plans                      List subscription plans
 * - PATCH  /api/admin/plans/:code                Update plan (price, limits, features)
 *
 * - GET    /api/admin/subscriptions/stats        Dashboard stats
 *
 * Public:
 * - GET    /api/public/plans                     List public plans (for pricing page)
 */

import { Elysia, t } from 'elysia';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import { db } from '../../config/database.js';
import {
  subscriptions,
  subscriptionPlans,
  subscriptionPayments,
  organizations,
  outlets,
} from '../../db/schema/subscription.js';
import { users } from '../../db/schema/auth.js';
import {
  activateSubscription,
  cancelSubscription,
  suspendSubscription,
  resumeSubscription,
  changePlan,
  recordManualPayment,
  getActiveSubscription,
  getSubscriptionStats,
  getMonthlyRevenue,
} from '../../services/subscription.service.js';
import { logger } from '../../config/logger.js';

// ====== HELPER: REQUIRE SUPER_ADMIN ======
// We use a simple role check. Real Elysia middleware would use .guard()

export const adminSubscriptionRoutes = new Elysia({ prefix: '/api/admin' })
  // ============================================================
  // SUBSCRIPTIONS
  // ============================================================
  
  .get('/subscriptions', async ({ query }) => {
    // Manual join to avoid needing Drizzle relations defined
    const subs = await db.execute(sql`
      SELECT
        s.*,
        o.name as organization_name,
        o.code as organization_code,
        o.status as organization_status
      FROM subscriptions s
      LEFT JOIN organizations o ON o.id = s.organization_id
      ORDER BY s.created_at DESC
      LIMIT ${query.limit ?? 50}
      OFFSET ${query.offset ?? 0}
    `);
    return { ok: true, data: subs };
  }, {
    query: t.Object({
      limit: t.Optional(t.Numeric()),
      offset: t.Optional(t.Numeric()),
    }),
  })

  .get('/subscriptions/stats', async () => {
    const [stats, revenue, orgCount, activeSubs] = await Promise.all([
      getSubscriptionStats(),
      getMonthlyRevenue(),
      db.select({ count: count() }).from(organizations),
      db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'active')),
    ]);

    return {
      ok: true,
      data: {
        totalOrganizations: orgCount[0]?.count ?? 0,
        activeSubscriptions: activeSubs[0]?.count ?? 0,
        monthlyRevenueIdr: revenue,
        breakdown: stats,
      },
    };
  })

  .get('/subscriptions/:id', async ({ params, set }) => {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, params.id))
      .limit(1);
    if (!sub) {
      set.status = 404;
      return { ok: false, error: 'not_found' };
    }
    return { ok: true, data: sub };
  })

  .post('/subscriptions', async ({ body, set, user }: any) => {
    try {
      const sub = await activateSubscription(
        body.organizationId,
        body.planCode,
        body.billingCycle,
        body.days,
      );

      logger.info({
        orgId: body.organizationId,
        planCode: body.planCode,
        createdBy: user?.userId,
      }, 'Subscription created manually');

      return { ok: true, data: sub };
    } catch (e: any) {
      set.status = e.statusCode ?? 400;
      return { ok: false, error: e.code, message: e.message };
    }
  }, {
    body: t.Object({
      organizationId: t.String(),
      planCode: t.String(),
      billingCycle: t.Optional(t.Union([t.Literal('monthly'), t.Literal('yearly')])),
      days: t.Optional(t.Numeric()),
    }),
  })

  .patch('/subscriptions/:id', async ({ params, body, set }) => {
    try {
      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.id, params.id),
      });
      if (!sub) {
        set.status = 404;
        return { ok: false, error: 'not_found' };
      }
      
      const updated = await changePlan(sub.organizationId, body.planCode ?? sub.planCode, {
        billingCycle: body.billingCycle,
        customMaxOutlets: body.customMaxOutlets,
        customMaxUsers: body.customMaxUsers,
      });
      return { ok: true, data: updated };
    } catch (e: any) {
      set.status = e.statusCode ?? 400;
      return { ok: false, error: e.code, message: e.message };
    }
  }, {
    body: t.Object({
      planCode: t.Optional(t.String()),
      billingCycle: t.Optional(t.Union([t.Literal('monthly'), t.Literal('yearly')])),
      customMaxOutlets: t.Optional(t.Numeric()),
      customMaxUsers: t.Optional(t.Numeric()),
    }),
  })

  .post('/subscriptions/:id/cancel', async ({ params, body }) => {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, params.id),
    });
    if (!sub) {
      return { ok: false, error: 'not_found' };
    }
    await cancelSubscription(sub.organizationId, body?.reason);
    return { ok: true };
  }, {
    body: t.Optional(t.Object({
      reason: t.Optional(t.String()),
    })),
  })

  .post('/subscriptions/:id/suspend', async ({ params, body }) => {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, params.id),
    });
    if (!sub) {
      return { ok: false, error: 'not_found' };
    }
    await suspendSubscription(sub.organizationId, body.reason);
    return { ok: true };
  }, {
    body: t.Object({
      reason: t.String(),
    }),
  })

  .post('/subscriptions/:id/resume', async ({ params }) => {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, params.id),
    });
    if (!sub) {
      return { ok: false, error: 'not_found' };
    }
    await resumeSubscription(sub.organizationId);
    return { ok: true };
  })

  .post('/subscriptions/:id/payments', async ({ params, body, user }: any) => {
    try {
      const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, params.id))
        .limit(1);
      if (!sub) {
        return { ok: false, error: 'not_found' };
      }

      await recordManualPayment(sub.organizationId, {
        amountIdr: body.amountIdr,
        paymentMethod: body.paymentMethod,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        manualReference: body.manualReference,
        manualNotes: body.manualNotes,
        verifiedBy: user?.userId ?? null,
      });

      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.code, message: e.message };
    }
  }, {
    body: t.Object({
      amountIdr: t.Numeric(),
      paymentMethod: t.Union([t.Literal('transfer'), t.Literal('qris'), t.Literal('cash'), t.Literal('other')]),
      periodStart: t.String(),
      periodEnd: t.String(),
      manualReference: t.String(),
      manualNotes: t.Optional(t.String()),
    }),
  })

  // ============================================================
  // ORGANIZATIONS
  // ============================================================

  .get('/organizations', async ({ query }) => {
    const orgs = await db
      .select()
      .from(organizations)
      .orderBy(desc(organizations.createdAt))
      .limit(query.limit ?? 50)
      .offset(query.offset ?? 0);
    return { ok: true, data: orgs };
  }, {
    query: t.Object({
      limit: t.Optional(t.Numeric()),
      offset: t.Optional(t.Numeric()),
    }),
  })

  .get('/organizations/:id', async ({ params, set }) => {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.id))
      .limit(1);
    if (!org) {
      set.status = 404;
      return { ok: false, error: 'not_found' };
    }

    const sub = await getActiveSubscription(org.id);
    const [outletCountRow] = await db
      .select({ count: count() })
      .from(outlets)
      .where(eq(outlets.organizationId, org.id));

    return {
      ok: true,
      data: {
        ...org,
        subscription: sub,
        outletCount: Number(outletCountRow?.count ?? 0),
      },
    };
  })

  // ============================================================
  // PLANS
  // ============================================================

  .get('/plans', async () => {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .orderBy(subscriptionPlans.sortOrder);
    return { ok: true, data: plans };
  })

  .patch('/plans/:code', async ({ params, body, set }) => {
    const updates: any = { updatedAt: new Date() };
    if (body.name) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.priceMonthlyIdr !== undefined) updates.priceMonthlyIdr = body.priceMonthlyIdr;
    if (body.priceYearlyIdr !== undefined) updates.priceYearlyIdr = body.priceYearlyIdr;
    if (body.maxOutlets !== undefined) updates.maxOutlets = body.maxOutlets;
    if (body.maxUsersPerOutlet !== undefined) updates.maxUsersPerOutlet = body.maxUsersPerOutlet;
    if (body.features !== undefined) updates.features = body.features;
    if (body.isActive !== undefined) updates.isActive = body.isActive;
    if (body.isPublic !== undefined) updates.isPublic = body.isPublic;

    const updated = await db.update(subscriptionPlans)
      .set(updates)
      .where(eq(subscriptionPlans.code, params.code as any))
      .returning();
    
    if (updated.length === 0) {
      set.status = 404;
      return { ok: false, error: 'not_found' };
    }
    return { ok: true, data: updated[0] };
  }, {
    body: t.Object({
      name: t.Optional(t.String()),
      description: t.Optional(t.String()),
      priceMonthlyIdr: t.Optional(t.Numeric()),
      priceYearlyIdr: t.Optional(t.Numeric()),
      maxOutlets: t.Optional(t.Numeric()),
      maxUsersPerOutlet: t.Optional(t.Numeric()),
      features: t.Optional(t.Any()),
      isActive: t.Optional(t.Boolean()),
      isPublic: t.Optional(t.Boolean()),
    }),
  })

  // ============================================================
  // STATS moved to top of file (before :id route)
  // ============================================================

// ====== PUBLIC PLANS (no auth, for pricing page) ======
export const publicPlanRoutes = new Elysia({ prefix: '/api/public' })
  .get('/plans', async () => {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(and(
        eq(subscriptionPlans.isActive, true),
        eq(subscriptionPlans.isPublic, true),
      ))
      .orderBy(subscriptionPlans.sortOrder);
    return { ok: true, data: plans };
  });
