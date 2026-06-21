/**
 * Public register endpoint — for new customers.
 *
 * Flow:
 * 1. Customer submits registration form (name, email, password, outlet info)
 * 2. BE creates:
 *    - Organization (status: active)
 *    - First Outlet
 *    - First User (manager role)
 *    - Trial subscription (30 days)
 * 3. Return success — customer can login immediately
 *
 * Phase 1: Auto-activate (no Wafiq approval)
 * Phase 2: Add Wafiq approval flow (status: 'pending' until approved)
 */

import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import {
  organizations,
  outlets,
  outletUsers,
  subscriptions,
} from '../db/schema/subscription.js';
import { users } from '../db/schema/auth.js';
import { hashPassword } from '../lib/password.js';
import { logger } from '../config/logger.js';
import { ConflictError, ValidationError } from '../lib/errors.js';

export const registerRoutes = new Elysia({ prefix: '/api/register', tags: ['Register'] })
  .post('/', async ({ body, set, request }: any) => {
    // 1. Validate
    const { fullName, username, password, email, phone,
            organizationName, outletName, businessType } = body;

    if (!fullName || !username || !password || !organizationName || !outletName) {
      throw new ValidationError('Missing required fields', {
        required: ['fullName', 'username', 'password', 'organizationName', 'outletName'],
      });
    }

    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    // 2. Check if username already exists
    const [existingUser] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existingUser) {
      throw new ConflictError('Username already taken');
    }

    if (email) {
      const [existingEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingEmail) {
        throw new ConflictError('Email already registered');
      }
    }

    // 3. Generate org code (slug from name + random suffix for uniqueness)
    const baseSlug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 40);
    const orgCode = `${baseSlug}-${Date.now().toString(36).substring(0, 6)}`;

    // 4. Create everything in a transaction
    const result = await db.transaction(async (tx) => {
      // Create organization
      const [org] = await tx.insert(organizations).values({
        name: organizationName,
        code: orgCode,
        email,
        phone,
        businessType,
        status: 'active',
      }).returning();

      // Create first outlet
      const [outlet] = await tx.insert(outlets).values({
        organizationId: org.id,
        name: outletName,
        code: 'OUTLET-01',
        address: body.outletAddress,
        phone: body.outletPhone,
        status: 'active',
      }).returning();

      // Create first user (manager)
      const passwordHash = await hashPassword(password);
      const [user] = await tx.insert(users).values({
        username,
        passwordHash,
        fullName,
        email,
        phone,
        role: 'manager',
        outletId: outlet.id,
        isActive: true,
      }).returning();

      // Link user to outlet via junction table
      await tx.insert(outletUsers).values({
        outletId: outlet.id,
        userId: user.id,
        role: 'manager',
        isPrimary: true,
      });

      // Create trial subscription (30 days)
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const [sub] = await tx.insert(subscriptions).values({
        organizationId: org.id,
        planCode: 'trial',
        status: 'trial',
        startedAt: now,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        billingCycle: 'monthly',
        autoRenew: false,
      }).returning();

      return { org, outlet, user, sub };
    });

    logger.info({
      orgId: result.org.id,
      userId: result.user.id,
      username,
    }, '✅ New customer registered');

    return {
      ok: true,
      data: {
        organization: {
          id: result.org.id,
          name: result.org.name,
        },
        outlet: {
          id: result.outlet.id,
          name: result.outlet.name,
        },
        user: {
          id: result.user.id,
          username: result.user.username,
          fullName: result.user.fullName,
        },
        subscription: {
          plan: 'trial',
          status: 'trial',
          trialEndsAt: result.sub.trialEndsAt,
        },
        message: 'Registrasi berhasil! Silakan login dengan username dan password Anda.',
      },
    };
  }, {
    body: t.Object({
      fullName: t.String({ minLength: 1, maxLength: 100 }),
      username: t.String({ minLength: 3, maxLength: 50 }),
      password: t.String({ minLength: 8, maxLength: 100 }),
      email: t.Optional(t.String({ format: 'email' })),
      phone: t.Optional(t.String({ maxLength: 20 })),
      organizationName: t.String({ minLength: 1, maxLength: 200 }),
      outletName: t.String({ minLength: 1, maxLength: 150 }),
      outletAddress: t.Optional(t.String()),
      outletPhone: t.Optional(t.String()),
      businessType: t.Optional(t.String()),
    }),
  });
