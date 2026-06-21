/**
 * Subscription middleware — enforces plan limits + feature flags.
 *
 * Usage:
 *   app.post('/api/admin/outlets',
 *     requireAuth,
 *     enforceOutletLimit,    // checks if user can create outlet
 *     handler
 *   );
 *
 *   app.get('/api/hr/employees',
 *     requireAuth,
 *     requireFeature('hr_module'),  // checks if plan has HR
 *     handler
 *   );
 */

import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { outlets, organizations } from '../db/schema/subscription.js';
import {
  assertCanCreateOutlet,
  assertHasFeature,
  SubscriptionError,
  getEffectivePlan,
  getOutletCount,
} from '../services/subscription.service.js';

/**
 * Resolve organization ID for a user.
 * - super_admin: requires explicit orgId in request
 * - other roles: derive from user's outletId
 */
async function resolveOrganizationId(user: any, requestedOrgId?: string): Promise<string | null> {
  if (user?.role === 'super_admin') {
    return requestedOrgId ?? user.organizationId ?? null;
  }

  if (!user?.outletId) {
    return null;
  }

  const outlet = await db.query.outlets.findFirst({
    where: eq(outlets.id, user.outletId),
  });
  return outlet?.organizationId ?? null;
}

/**
 * Elysia before-handler: enforce outlet creation limit.
 * Use on POST /api/admin/outlets
 */
export const enforceOutletLimit = async (context: any) => {
  const { user, body, set, request } = context;

  // Allow if creating outlet for new organization (handled by register flow)
  if (body?.organizationId) {
    await assertCanCreateOutlet(body.organizationId);
    return;
  }

  // Otherwise resolve from user
  const orgId = await resolveOrganizationId(user, request?.query?.orgId);
  if (!orgId) {
    set.status = 403;
    return { ok: false, error: 'forbidden', message: 'No organization context' };
  }

  await assertCanCreateOutlet(orgId);
};

/**
 * Elysia before-handler factory: require a specific feature.
 * Usage: requireFeature('hr_module')
 */
export function requireFeature(featureName: string) {
  return async (context: any) => {
    const { user, set, request } = context;
    const orgId = await resolveOrganizationId(user, request?.query?.orgId);
    if (!orgId) {
      set.status = 403;
      return { ok: false, error: 'forbidden', message: 'No organization context' };
    }
    await assertHasFeature(orgId, featureName);
  };
}

/**
 * Load subscription context for current user.
 * Attaches plan, subscription, org to context.
 */
export const loadSubscriptionContext = async (context: any) => {
  const { user, request } = context;
  const orgId = await resolveOrganizationId(user, request?.query?.orgId);
  if (!orgId) return;

  const plan = await getEffectivePlan(orgId);
  const outletCount = await getOutletCount(orgId);

  context.subscriptionContext = {
    organizationId: orgId,
    plan,
    outletCount,
    outletLimit: plan?.maxOutlets,
    features: (plan?.features as Record<string, boolean>) ?? {},
  };
};

/**
 * Helper: format SubscriptionError as API response.
 */
export function subscriptionErrorResponse(error: SubscriptionError) {
  return {
    ok: false,
    error: error.code,
    message: error.message,
  };
}
