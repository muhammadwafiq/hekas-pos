/**
 * Default organization + outlet migration.
 *
 * For existing dev data (with outlet_id `d3d1143e-984f-4185-b182-50b5dd3a3c8c`),
 * create a default organization, register the outlet in the new `outlets` table,
 * and create a default Pro subscription so all existing features continue to work.
 *
 * Idempotent: safe to run multiple times.
 *
 * Run: `bun src/db/seed-default-org.ts`
 */

import { eq, sql } from 'drizzle-orm';
import { db, sql as rawSql } from '../config/database.js';
import { organizations, outlets, outletUsers, subscriptions } from '../db/schema/subscription.js';
import { users } from '../db/schema/auth.js';
import { logger } from '../config/logger.js';

const DEFAULT_OUTLET_ID = 'd3d1143e-984f-4185-b182-50b5dd3a3c8c';  // from memory
const DEFAULT_ORG_CODE = 'default-dev';
const DEFAULT_USER = 'admin';  // Wafiq

export async function seedDefaultOrganization() {
  const startTime = Date.now();
  logger.info('🌱 Seeding default organization for existing dev data...');

  // 1. Check if default org already exists
  const [existingOrg] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.code, DEFAULT_ORG_CODE))
    .limit(1);

  let org;
  if (existingOrg) {
    org = existingOrg;
    logger.info({ orgId: org.id }, '  ↺ Default org already exists, skipping');
  } else {
    // Create default org with Pro plan
    [org] = await db.insert(organizations).values({
      name: 'HEKAS POS Dev (Default)',
      code: DEFAULT_ORG_CODE,
      email: 'dev@hekas.id',
      phone: '+62-21-12345678',
      businessType: 'retail',
      status: 'active',
    }).returning();
    logger.info({ orgId: org.id }, '  ✅ Default org created');
  }

  // 2. Check if default outlet exists in new outlets table
  const [existingOutlet] = await db
    .select()
    .from(outlets)
    .where(eq(outlets.id, DEFAULT_OUTLET_ID))
    .limit(1);

  if (!existingOutlet) {
    // Insert with the existing outlet_id (preserves all FK references)
    await db.insert(outlets).values({
      id: DEFAULT_OUTLET_ID,  // explicit ID to match existing data
      organizationId: org.id,
      name: 'Duamart Pusat (Default)',
      code: 'DEFAULT-01',
      address: 'Jl. Contoh No. 123, Jakarta',
      phone: '021-12345678',
      status: 'active',
    }).onConflictDoNothing();
    logger.info({ outletId: DEFAULT_OUTLET_ID }, '  ✅ Default outlet registered in new outlets table');
  } else {
    logger.info({ outletId: DEFAULT_OUTLET_ID }, '  ↺ Default outlet already registered');
  }

  // 3. Link existing Wafiq user to default org via outlet_users
  const [wafiq] = await db.select().from(users).where(eq(users.username, DEFAULT_USER)).limit(1);
  if (wafiq) {
    const [existingLink] = await db
      .select()
      .from(outletUsers)
      .where(eq(outletUsers.userId, wafiq.id))
      .limit(1);

    if (!existingLink) {
      await db.insert(outletUsers).values({
        outletId: DEFAULT_OUTLET_ID,
        userId: wafiq.id,
        role: 'super_admin',
        isPrimary: true,
      });
      logger.info({ userId: wafiq.id }, '  ✅ Wafiq linked to default outlet as super_admin');
    } else {
      logger.info({ userId: wafiq.id }, '  ↺ Wafiq already linked');
    }

    // Also ensure user's outletId points to the default outlet
    if (wafiq.outletId !== DEFAULT_OUTLET_ID) {
      await db.update(users)
        .set({ outletId: DEFAULT_OUTLET_ID, role: 'super_admin' })
        .where(eq(users.id, wafiq.id));
      logger.info({ userId: wafiq.id }, '  ✅ Wafiq outletId set to default');
    }
  }

  // 4. Create default Pro subscription (unlimited features for dev)
  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, org.id))
    .limit(1);

  if (!existingSub) {
    const now = new Date();
    const yearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    await db.insert(subscriptions).values({
      organizationId: org.id,
      planCode: 'enterprise',  // unlimited everything for dev
      status: 'active',
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: yearFromNow,
      billingCycle: 'yearly',
      autoRenew: true,
      customMaxOutlets: 999,
      customMaxUsers: 999,
    });
    logger.info({ orgId: org.id }, '  ✅ Default Enterprise subscription created (1 year, 999 outlet/user limit)');
  } else {
    logger.info({ orgId: org.id }, '  ↺ Default subscription already exists');
  }

  // 5. Also link all existing users to the default outlet if they don't have one
  const [result] = await rawSql`
    UPDATE users
    SET outlet_id = ${DEFAULT_OUTLET_ID}::uuid
    WHERE outlet_id IS NULL
    RETURNING id, username
  `;
  const updatedUsers = (result as any) ?? [];
  if (updatedUsers.length > 0) {
    logger.info({ count: updatedUsers.length }, `  ✅ Linked ${updatedUsers.length} orphan users to default outlet`);
  }

  const duration = Date.now() - startTime;
  logger.info({ duration }, '✅ Default organization setup complete');
}

if (import.meta.main) {
  await seedDefaultOrganization();
  process.exit(0);
}
