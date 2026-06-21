/**
 * Admin user management routes — owner manages staff (kasir, admin_gudang) in their org.
 *
 * Scenarios supported:
 * - 1. Single manager (default): owner adds kasir/gudang to their outlets
 * - 2. Multi-outlet assignment: 1 staff can work at multiple outlets
 *
 * Endpoints (require role: manager or super_admin):
 * - GET    /api/admin/users                  List users in org
 * - GET    /api/admin/users/:id              Get user detail (with outlet assignments)
 * - POST   /api/admin/users                  Create new staff (kasir, admin_gudang, manager)
 * - PATCH  /api/admin/users/:id              Update user (role, full_name, is_active, password)
 * - POST   /api/admin/users/:id/reset-password  Reset password (owner sets new)
 * - GET    /api/admin/users/:id/outlets      List outlet assignments for user
 * - POST   /api/admin/users/:id/outlets      Assign user to outlet
 * - DELETE /api/admin/users/:id/outlets/:outletId  Remove outlet assignment
 *
 * Permission:
 * - manager: can manage users in their own org only
 * - super_admin: can manage users in any org (use X-Org-Id header)
 */

import { Elysia, t } from 'elysia';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../config/database.js';
import {
  users,
  outlets,
  organizations,
  outletUsers,
} from '../../db/schema/index.js';
import { getAuthUser, requireRole } from '../../lib/auth-helper.js';
import { hashPassword } from '../../lib/password.js';
import { logger } from '../../config/logger.js';

export const adminUserRoutes = new Elysia({ prefix: '/api/admin/users', tags: ['Admin - Users'] })

  /**
   * GET /api/admin/users
   * List all users in the org (manager) or all orgs (super_admin)
   */
  .get('/', async ({ jwt, headers, set }: any) => {
    const me = await requireRole(jwt, headers, ["manager", "super_admin"]);
    if (!me) {
      set.status = 401;
      return { ok: false, error: 'unauthorized' };
    }

    let orgId: string;
    if (me.role === 'super_admin') {
      orgId = headers['x-org-id'];
      if (!orgId) {
        // No org filter → return all users across all orgs
        const allUsers = await db
          .select({
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            role: users.role,
            isActive: users.isActive,
            outletId: users.outletId,
            createdAt: users.createdAt,
            organizationId: outlets.organizationId,
            organizationName: organizations.name,
            outletName: outlets.name,
          })
          .from(users)
          .leftJoin(outlets, eq(users.outletId, outlets.id))
          .leftJoin(organizations, eq(outlets.organizationId, organizations.id))
          .orderBy(desc(users.createdAt));
        return { ok: true, data: allUsers };
      }
    } else {
      // Manager: auto-resolve from their outlet
      if (!me.outletId) {
        set.status = 400;
        return { ok: false, error: 'no_outlet' };
      }
      const [myOutlet] = await db
        .select()
        .from(outlets)
        .where(eq(outlets.id, me.outletId))
        .limit(1);
      orgId = myOutlet.organizationId;
    }

    // List users in this org (by outlet.organizationId)
    const orgUsers = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        outletId: users.outletId,
        outletName: outlets.name,
        outletCode: outlets.code,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .innerJoin(outlets, eq(users.outletId, outlets.id))
      .where(eq(outlets.organizationId, orgId))
      .orderBy(desc(users.createdAt));

    return { ok: true, data: orgUsers };
  })

  /**
   * GET /api/admin/users/:id
   * Get user detail with all outlet assignments
   */
  .get('/:id', async ({ params, jwt, headers, set }: any) => {
    const me = await requireRole(jwt, headers, ["manager", "super_admin"]);
    if (!me) {
      set.status = 401;
      return { ok: false, error: 'unauthorized' };
    }

    const [target] = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        outletId: users.outletId,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, params.id))
      .limit(1);

    if (!target) {
      set.status = 404;
      return { ok: false, error: 'user_not_found' };
    }

    // Permission: manager can only see users in their org
    if (me.role !== 'super_admin') {
      if (!me.outletId || !target.outletId) {
        set.status = 400;
        return { ok: false, error: 'no_outlet' };
      }
      const [targetOutlet] = await db
        .select()
        .from(outlets)
        .where(eq(outlets.id, target.outletId))
        .limit(1);
      const [myOutlet] = await db
        .select()
        .from(outlets)
        .where(eq(outlets.id, me.outletId))
        .limit(1);

      if (targetOutlet?.organizationId !== myOutlet?.organizationId) {
        set.status = 403;
        return { ok: false, error: 'forbidden' };
      }
    }

    // Fetch outlet assignments (multi-outlet support)
    const assignments = await db
      .select({
        outletId: outletUsers.outletId,
        outletName: outlets.name,
        outletCode: outlets.code,
        role: outletUsers.role,
        isPrimary: outletUsers.isPrimary,
        createdAt: outletUsers.createdAt,
      })
      .from(outletUsers)
      .innerJoin(outlets, eq(outletUsers.outletId, outlets.id))
      .where(eq(outletUsers.userId, target.id));

    return { ok: true, data: { ...target, outletAssignments: assignments } };
  })

  /**
   * POST /api/admin/users
   * Create new staff (kasir, admin_gudang, or another manager)
   * Auto-assigns to the org via primary outlet.
   */
  .post(
    '/',
    async ({ body, jwt, headers, set }: any) => {
      const me = await requireRole(jwt, headers, ["manager", "super_admin"]);
      if (!me) {
        set.status = 401;
        return { ok: false, error: 'unauthorized' };
      }

      // Resolve orgId
      let orgId: string;
      if (me.role === 'super_admin') {
        orgId = body.organizationId ?? headers['x-org-id'];
        if (!orgId) {
          set.status = 400;
          return { ok: false, error: 'organizationId_required' };
        }
      } else {
        if (!me.outletId) {
          set.status = 400;
          return { ok: false, error: 'no_outlet' };
        }
        const [myOutlet] = await db
          .select()
          .from(outlets)
          .where(eq(outlets.id, me.outletId))
          .limit(1);
        orgId = myOutlet.organizationId;
      }

      // Validate: outlet (if provided) must be in this org
      if (body.outletId) {
        const [targetOutlet] = await db
          .select()
          .from(outlets)
          .where(eq(outlets.id, body.outletId))
          .limit(1);
        if (!targetOutlet || targetOutlet.organizationId !== orgId) {
          set.status = 400;
          return { ok: false, error: 'outlet_not_in_org' };
        }
      } else {
        // No outletId provided → use first active outlet in org
        const [firstOutlet] = await db
          .select()
          .from(outlets)
          .where(and(eq(outlets.organizationId, orgId), eq(outlets.status, 'active')))
          .orderBy(outlets.createdAt)
          .limit(1);
        if (!firstOutlet) {
          set.status = 400;
          return { ok: false, error: 'no_active_outlet' };
        }
        body.outletId = firstOutlet.id;
      }

      // Validate role (manager or super_admin can only be created by super_admin)
      const role = body.role ?? 'kasir';
      if (role === 'super_admin' && me.role !== 'super_admin') {
        set.status = 403;
        return { ok: false, error: 'cannot_create_super_admin' };
      }

      // Check username uniqueness
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.username, body.username))
        .limit(1);
      if (existing) {
        set.status = 409;
        return { ok: false, error: 'username_taken' };
      }

      // Hash password
      const passwordHash = await hashPassword(body.password);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          username: body.username,
          passwordHash,
          fullName: body.fullName,
          role,
          outletId: body.outletId,
          isActive: true,
          ...(body.pin ? { pinHash: await hashPassword(body.pin) } : {}),
        })
        .returning();

      logger.info({ userId: newUser.id, username: newUser.username, role, orgId }, 'Staff user created');

      return {
        ok: true,
        data: {
          id: newUser.id,
          username: newUser.username,
          fullName: newUser.fullName,
          role: newUser.role,
          outletId: newUser.outletId,
          isActive: newUser.isActive,
        },
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 3, maxLength: 50 }),
        password: t.String({ minLength: 6 }),
        fullName: t.String({ minLength: 2, maxLength: 150 }),
        role: t.Optional(t.Union([
          t.Literal('manager'),
          t.Literal('admin_gudang'),
          t.Literal('kasir'),
          t.Literal('super_admin'),
        ])),
        outletId: t.Optional(t.String()),
        pin: t.Optional(t.String({ minLength: 4, maxLength: 6 })),
        organizationId: t.Optional(t.String()),
      }),
    }
  )

  /**
   * PATCH /api/admin/users/:id
   * Update user (role, full_name, is_active, primary outlet)
   */
  .patch(
    '/:id',
    async ({ params, body, jwt, headers, set }: any) => {
      const me = await requireRole(jwt, headers, ["manager", "super_admin"]);
      if (!me) {
        set.status = 401;
        return { ok: false, error: 'unauthorized' };
      }

      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, params.id))
        .limit(1);
      if (!target) {
        set.status = 404;
        return { ok: false, error: 'user_not_found' };
      }

      // Permission: manager can only edit users in their org
      if (me.role !== 'super_admin') {
        if (!me.outletId || !target.outletId) {
          set.status = 400;
          return { ok: false, error: 'no_outlet' };
        }
        const [targetOutlet] = await db
          .select()
          .from(outlets)
          .where(eq(outlets.id, target.outletId))
          .limit(1);
        const [myOutlet] = await db
          .select()
          .from(outlets)
          .where(eq(outlets.id, me.outletId))
          .limit(1);
        if (targetOutlet?.organizationId !== myOutlet?.organizationId) {
          set.status = 403;
          return { ok: false, error: 'forbidden' };
        }
      }

      // Manager can't promote to super_admin
      if (body.role === 'super_admin' && me.role !== 'super_admin') {
        set.status = 403;
        return { ok: false, error: 'cannot_promote_to_super_admin' };
      }

      // Build update
      const updates: any = {};
      if (body.fullName !== undefined) updates.fullName = body.fullName;
      if (body.role !== undefined) updates.role = body.role;
      if (body.isActive !== undefined) updates.isActive = body.isActive;
      if (body.outletId !== undefined) {
        if (!target.outletId) {
          set.status = 400;
          return { ok: false, error: 'target_no_outlet' };
        }
        // Validate outlet in same org
        const [newOutlet] = await db
          .select()
          .from(outlets)
          .where(eq(outlets.id, body.outletId))
          .limit(1);
        if (!newOutlet) {
          set.status = 400;
          return { ok: false, error: 'outlet_not_found' };
        }
        const [targetOutlet] = await db
          .select()
          .from(outlets)
          .where(eq(outlets.id, target.outletId))
          .limit(1);
        if (newOutlet.organizationId !== targetOutlet?.organizationId) {
          set.status = 400;
          return { ok: false, error: 'outlet_not_in_same_org' };
        }
        updates.outletId = body.outletId;
      }
      if (body.password !== undefined) {
        updates.passwordHash = await hashPassword(body.password);
      }

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, params.id))
        .returning();

      return { ok: true, data: { id: updated.id, username: updated.username, fullName: updated.fullName, role: updated.role, isActive: updated.isActive, outletId: updated.outletId } };
    },
    {
      body: t.Object({
        fullName: t.Optional(t.String({ minLength: 2, maxLength: 150 })),
        role: t.Optional(t.Union([
          t.Literal('manager'),
          t.Literal('admin_gudang'),
          t.Literal('kasir'),
          t.Literal('super_admin'),
        ])),
        isActive: t.Optional(t.Boolean()),
        outletId: t.Optional(t.String()),
        password: t.Optional(t.String({ minLength: 6 })),
      }),
    }
  )

  /**
   * POST /api/admin/users/:id/reset-password
   * Reset user's password (owner sets new one)
   */
  .post(
    '/:id/reset-password',
    async ({ params, body, jwt, headers, set }: any) => {
      const me = await requireRole(jwt, headers, ["manager", "super_admin"]);
      if (!me) {
        set.status = 401;
        return { ok: false, error: 'unauthorized' };
      }

      const [target] = await db.select().from(users).where(eq(users.id, params.id)).limit(1);
      if (!target) {
        set.status = 404;
        return { ok: false, error: 'user_not_found' };
      }

      // Permission: manager can only reset in their org
      if (me.role !== 'super_admin') {
        if (!me.outletId || !target.outletId) {
          set.status = 400;
          return { ok: false, error: 'no_outlet' };
        }
        const [targetOutlet] = await db.select().from(outlets).where(eq(outlets.id, target.outletId)).limit(1);
        const [myOutlet] = await db.select().from(outlets).where(eq(outlets.id, me.outletId)).limit(1);
        if (targetOutlet?.organizationId !== myOutlet?.organizationId) {
          set.status = 403;
          return { ok: false, error: 'forbidden' };
        }
      }

      const passwordHash = await hashPassword(body.newPassword);
      await db.update(users).set({ passwordHash }).where(eq(users.id, params.id));

      return { ok: true, message: 'Password reset' };
    },
    {
      body: t.Object({
        newPassword: t.String({ minLength: 6 }),
      }),
    }
  )

  /**
   * GET /api/admin/users/:id/outlets
   * List all outlet assignments for this user
   */
  .get('/:id/outlets', async ({ params, set }: any) => {
    const assignments = await db
      .select({
        outletId: outletUsers.outletId,
        outletName: outlets.name,
        outletCode: outlets.code,
        outletStatus: outlets.status,
        role: outletUsers.role,
        isPrimary: outletUsers.isPrimary,
        createdAt: outletUsers.createdAt,
      })
      .from(outletUsers)
      .innerJoin(outlets, eq(outletUsers.outletId, outlets.id))
      .where(eq(outletUsers.userId, params.id));

    return { ok: true, data: assignments };
  })

  /**
   * POST /api/admin/users/:id/outlets
   * Assign user to additional outlet (multi-outlet access)
   */
  .post(
    '/:id/outlets',
    async ({ params, body, jwt, headers, set }: any) => {
      const me = await requireRole(jwt, headers, ["manager", "super_admin"]);
      if (!me) {
        set.status = 401;
        return { ok: false, error: 'unauthorized' };
      }

      const [target] = await db.select().from(users).where(eq(users.id, params.id)).limit(1);
      if (!target) {
        set.status = 404;
        return { ok: false, error: 'user_not_found' };
      }

      // Permission check
      if (me.role !== 'super_admin') {
        if (!me.outletId || !target.outletId) {
          set.status = 400;
          return { ok: false, error: 'no_outlet' };
        }
        const [targetOutlet] = await db.select().from(outlets).where(eq(outlets.id, target.outletId)).limit(1);
        const [myOutlet] = await db.select().from(outlets).where(eq(outlets.id, me.outletId)).limit(1);
        if (targetOutlet?.organizationId !== myOutlet?.organizationId) {
          set.status = 403;
          return { ok: false, error: 'forbidden' };
        }
        // Validate outlet in same org
        const [newOutlet] = await db.select().from(outlets).where(eq(outlets.id, body.outletId)).limit(1);
        if (!newOutlet || newOutlet.organizationId !== myOutlet?.organizationId) {
          set.status = 400;
          return { ok: false, error: 'outlet_not_in_same_org' };
        }
      }

      // Check if already assigned
      const [existing] = await db
        .select()
        .from(outletUsers)
        .where(and(eq(outletUsers.userId, params.id), eq(outletUsers.outletId, body.outletId)))
        .limit(1);
      if (existing) {
        set.status = 409;
        return { ok: false, error: 'already_assigned' };
      }

      await db.insert(outletUsers).values({
        userId: params.id,
        outletId: body.outletId,
        role: body.role ?? target.role,
        isPrimary: body.isPrimary ?? false,
      });

      // If this is the only assignment, also update users.outletId
      const userAssignments = await db
        .select()
        .from(outletUsers)
        .where(eq(outletUsers.userId, params.id));
      if (userAssignments.length === 1 && body.isPrimary) {
        await db.update(users).set({ outletId: body.outletId }).where(eq(users.id, params.id));
      }

      return { ok: true, message: 'User assigned to outlet' };
    },
    {
      body: t.Object({
        outletId: t.String(),
        role: t.Optional(t.String()),
        isPrimary: t.Optional(t.Boolean()),
      }),
    }
  )

  /**
   * DELETE /api/admin/users/:id/outlets/:outletId
   * Remove user from outlet assignment
   */
  .delete('/:id/outlets/:outletId', async ({ params, jwt, headers, set }: any) => {
    const me = await requireRole(jwt, headers, ["manager", "super_admin"]);
    if (!me) {
      set.status = 401;
      return { ok: false, error: 'unauthorized' };
    }

    await db
      .delete(outletUsers)
      .where(and(eq(outletUsers.userId, params.id), eq(outletUsers.outletId, params.outletId)));

    return { ok: true, message: 'Assignment removed' };
  });
