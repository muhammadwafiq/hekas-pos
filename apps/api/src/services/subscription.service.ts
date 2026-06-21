/**
 * Subscription service — business logic for plan management.
 *
 * Public methods:
 * - getActiveSubscription(orgId)         : get current active sub
 * - getEffectivePlan(orgId)               : get plan + custom overrides
 * - assertCanCreateOutlet(orgId)          : check outlet limit (throws)
 * - hasFeature(orgId, featureName)        : check feature flag
 * - assertHasFeature(orgId, featureName)  : check feature flag (throws)
 * - createTrialSubscription(orgId, days)  : start trial subscription
 * - activateSubscription(orgId, plan, ...) : activate paid subscription
 * - cancelSubscription(orgId, reason)     : cancel (keep until period end)
 * - suspendSubscription(orgId, reason)    : immediate suspend
 * - resumeSubscription(orgId)             : un-suspend
 * - changePlan(orgId, newPlan, ...)       : upgrade/downgrade
 * - recordManualPayment(orgId, amount, ...) : Phase 1 manual payment
 */

import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  subscriptions,
  subscriptionPlans,
  subscriptionPayments,
  organizations,
  outlets,
} from '../db/schema/subscription.js';
import { logger } from '../config/logger.js';

// ====== TYPE INFERENCE ======
type Subscription = typeof subscriptions.$inferSelect;
type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// ====== HELPERS ======

export async function getActiveSubscription(organizationId: string): Promise<Subscription | null> {
  const result = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.organizationId, organizationId),
      inArray(subscriptions.status, ['trial', 'active', 'past_due']),
    ),
    orderBy: [desc(subscriptions.createdAt)],
  });
  return result ?? null;
}

export async function getEffectivePlan(organizationId: string): Promise<(SubscriptionPlan & { maxOutlets: number | null; maxUsersPerOutlet: number | null }) | null> {
  const sub = await getActiveSubscription(organizationId);
  if (!sub) return null;

  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.code, sub.planCode),
  });
  if (!plan) return null;

  // Apply custom overrides
  return {
    ...plan,
    maxOutlets: sub.customMaxOutlets ?? plan.maxOutlets,
    maxUsersPerOutlet: sub.customMaxUsers ?? plan.maxUsersPerOutlet,
  };
}

export async function getOutletCount(organizationId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(outlets)
    .where(eq(outlets.organizationId, organizationId));
  return result[0]?.count ?? 0;
}

// ====== ERRORS ======

export class SubscriptionError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 403,
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

// ====== CHECKS ======

export async function assertCanCreateOutlet(organizationId: string): Promise<void> {
  const plan = await getEffectivePlan(organizationId);
  if (!plan) {
    throw new SubscriptionError(
      'no_subscription',
      'Organization has no active subscription. Please subscribe first.',
      402,
    );
  }

  const sub = await getActiveSubscription(organizationId);
  if (sub?.status === 'trial' && sub.trialEndsAt && new Date() > sub.trialEndsAt) {
    throw new SubscriptionError(
      'trial_expired',
      'Trial period has expired. Please upgrade to a paid plan to continue.',
      402,
    );
  }

  if (sub?.status === 'cancelled' || sub?.status === 'expired') {
    throw new SubscriptionError(
      'subscription_inactive',
      'Subscription is not active. Please renew to continue.',
      402,
    );
  }

  if (plan.maxOutlets !== null) {
    const currentCount = await getOutletCount(organizationId);
    if (currentCount >= plan.maxOutlets) {
      throw new SubscriptionError(
        'outlet_limit_reached',
        `Plan "${plan.name}" allows maximum ${plan.maxOutlets} outlet(s). ` +
        `You currently have ${currentCount}. Please upgrade your plan to add more outlets.`,
        402,
      );
    }
  }
}

export async function hasFeature(organizationId: string, featureName: string): Promise<boolean> {
  const plan = await getEffectivePlan(organizationId);
  if (!plan) return false;

  const features = (plan.features as Record<string, boolean>) ?? {};
  return features[featureName] === true;
}

export async function assertHasFeature(organizationId: string, featureName: string): Promise<void> {
  const has = await hasFeature(organizationId, featureName);
  if (!has) {
    const plan = await getEffectivePlan(organizationId);
    throw new SubscriptionError(
      'feature_not_available',
      `Feature "${featureName}" is not available in your current plan (${plan?.name ?? 'none'}). ` +
      `Please upgrade to access this feature.`,
      402,
    );
  }
}

// ====== LIFECYCLE ======

export async function createTrialSubscription(
  organizationId: string,
  trialDays: number = 30,
): Promise<Subscription> {
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

  const [sub] = await db.insert(subscriptions).values({
    organizationId,
    planCode: 'trial' as const,
    status: 'trial' as const,
    startedAt: now,
    trialEndsAt,
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
    billingCycle: 'monthly' as const,
    autoRenew: false,
  }).returning();

  logger.info({ organizationId, trialEndsAt }, '✅ Trial subscription created');
  return sub!;
}

export async function activateSubscription(
  organizationId: string,
  planCode: string,
  billingCycle: 'monthly' | 'yearly' = 'monthly',
  days?: number,
): Promise<Subscription> {
  const plan = await db.query.subscriptionPlans.findFirst({
    where: eq(subscriptionPlans.code, planCode as any),
  });
  if (!plan) {
    throw new SubscriptionError('plan_not_found', `Plan "${planCode}" not found`, 404);
  }

  // Cancel any existing active subscription
  await db.update(subscriptions)
    .set({ status: 'cancelled', cancelledAt: new Date() })
    .where(and(
      eq(subscriptions.organizationId, organizationId),
      inArray(subscriptions.status, ['trial', 'active', 'past_due']),
    ));

  // Create new subscription
  const now = new Date();
  const periodDays = days ?? (billingCycle === 'yearly' ? 365 : 30);
  const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

  const [sub] = await db.insert(subscriptions).values({
    organizationId,
    planCode: planCode as any,
    status: 'active' as const,
    startedAt: now,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    billingCycle,
    autoRenew: true,
  }).returning();

  logger.info({ organizationId, planCode, periodEnd }, '✅ Subscription activated');
  return sub!;
}

export async function cancelSubscription(organizationId: string, reason?: string): Promise<void> {
  await db.update(subscriptions)
    .set({
      status: 'cancelled' as const,
      cancelledAt: new Date(),
      cancellationReason: reason,
      autoRenew: false,
    })
    .where(and(
      eq(subscriptions.organizationId, organizationId),
      inArray(subscriptions.status, ['active', 'past_due']),
    ));

  logger.info({ organizationId, reason }, '✅ Subscription cancelled (will end at period end)');
}

export async function suspendSubscription(organizationId: string, reason: string): Promise<void> {
  await db.update(subscriptions)
    .set({ status: 'cancelled' as const, cancellationReason: reason })
    .where(eq(subscriptions.organizationId, organizationId));

  // Also suspend all outlets
  await db.update(outlets)
    .set({ status: 'suspended' as const })
    .where(eq(outlets.organizationId, organizationId));

  logger.warn({ organizationId, reason }, '⚠️  Subscription + outlets suspended');
}

export async function resumeSubscription(organizationId: string): Promise<void> {
  const sub = await getActiveSubscription(organizationId);
  if (!sub) {
    throw new SubscriptionError('no_subscription', 'No subscription to resume', 404);
  }

  await db.update(subscriptions)
    .set({ status: 'active' as const, cancelledAt: null, cancellationReason: null })
    .where(eq(subscriptions.id, sub.id));

  // Re-activate outlets
  await db.update(outlets)
    .set({ status: 'active' as const })
    .where(eq(outlets.organizationId, organizationId));

  logger.info({ organizationId }, '✅ Subscription resumed');
}

export async function changePlan(
  organizationId: string,
  newPlanCode: string,
  options: { billingCycle?: 'monthly' | 'yearly'; customMaxOutlets?: number; customMaxUsers?: number } = {},
): Promise<Subscription> {
  const sub = await getActiveSubscription(organizationId);
  if (!sub) {
    throw new SubscriptionError('no_subscription', 'No active subscription', 404);
  }

  const updates: any = { updatedAt: new Date() };
  if (newPlanCode) updates.planCode = newPlanCode;
  if (options.billingCycle) updates.billingCycle = options.billingCycle;
  if (options.customMaxOutlets !== undefined) updates.customMaxOutlets = options.customMaxOutlets;
  if (options.customMaxUsers !== undefined) updates.customMaxUsers = options.customMaxUsers;

  await db.update(subscriptions)
    .set(updates)
    .where(eq(subscriptions.id, sub.id));

  logger.info({ organizationId, newPlanCode }, '✅ Plan changed');
  return (await getActiveSubscription(organizationId))!;
}

// ====== MANUAL PAYMENT (Phase 1) ======

export async function recordManualPayment(
  organizationId: string,
  data: {
    amountIdr: number;
    paymentMethod: 'transfer' | 'qris' | 'cash' | 'other';
    periodStart: Date;
    periodEnd: Date;
    manualReference: string;
    manualNotes?: string;
    verifiedBy?: string | null;  // userId of admin who verified (null = system)
  },
): Promise<void> {
  const sub = await getActiveSubscription(organizationId);
  if (!sub) {
    throw new SubscriptionError('no_subscription', 'No active subscription', 404);
  }

  // Record payment
  await db.insert(subscriptionPayments).values({
    subscriptionId: sub.id,
    organizationId,
    amountIdr: data.amountIdr,
    paymentMethod: data.paymentMethod,
    paymentStatus: 'paid' as const,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    manualReference: data.manualReference,
    manualNotes: data.manualNotes,
    paidAt: new Date(),
    verifiedBy: data.verifiedBy ?? null,
  });

  // Extend subscription
  await db.update(subscriptions)
    .set({
      status: 'active' as const,
      currentPeriodStart: data.periodStart,
      currentPeriodEnd: data.periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));

  // Re-activate outlets if they were suspended
  await db.update(outlets)
    .set({ status: 'active' as const })
    .where(and(
      eq(outlets.organizationId, organizationId),
      eq(outlets.status, 'suspended'),
    ));

  logger.info({ organizationId, amount: data.amountIdr }, '✅ Manual payment recorded');
}

// ====== STATS (for Wafiq admin dashboard) ======

export async function getSubscriptionStats(): Promise<Array<{ plan_code: string; status: string; count: number }>> {
  const result = await db.execute(sql`
    SELECT
      plan_code,
      status,
      COUNT(*)::int as count
    FROM subscriptions
    GROUP BY plan_code, status
    ORDER BY plan_code, status
  ` as any);
  return result as unknown as Array<{ plan_code: string; status: string; count: number }>;
}

export async function getMonthlyRevenue(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(amount_idr), 0)::int as revenue
    FROM subscription_payments
    WHERE payment_status = 'paid'
      AND paid_at >= DATE_TRUNC('month', NOW())
  ` as any);
  return Number((result as any)[0]?.revenue ?? 0);
}
