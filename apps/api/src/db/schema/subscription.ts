/**
 * Subscription domain — multi-tenant SaaS billing.
 *
 * Tables:
 * - organizations: top-level customer (1 customer = 1 organization)
 * - outlets: physical stores (1+ outlet per organization)
 * - outlet_users: multi-outlet user mapping (manager bisa akses >1 outlet)
 * - subscription_plans: static plan definitions (trial, starter, basic, ...)
 * - subscriptions: customer's active plan (1 active per organization)
 * - subscription_payments: payment history (for Midtrans integration in Phase 2)
 *
 * Migration strategy:
 * - New tables, no breaking changes
 * - Existing outlet_id references stay as-is (no FK enforcement)
 * - Dev seed creates a default organization + outlet matching existing UUID
 */

import { pgTable, uuid, varchar, text, integer, numeric, boolean, timestamp, jsonb, date, index, unique, primaryKey, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth.js';

// ====== ENUMS ======

export const subscriptionPlanEnum = pgEnum('subscription_plan_code', [
  'trial',
  'starter',
  'basic',
  'standard',
  'pro',
  'enterprise',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trial',
  'active',
  'past_due',
  'cancelled',
  'expired',
]);

export const billingCycleEnum = pgEnum('billing_cycle', [
  'monthly',
  'yearly',
]);

export const organizationStatusEnum = pgEnum('organization_status', [
  'active',
  'suspended',
  'cancelled',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'refunded',
]);

// ====== TABLES ======

/**
 * Organizations — top-level customer.
 * 1 organization = 1 customer (e.g., "PT Toko Budi Jaya")
 */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    code: varchar('code', { length: 50 }).notNull().unique(),  // 'toko-budi-jaya'
    email: varchar('email', { length: 150 }),
    phone: varchar('phone', { length: 20 }),
    address: text('address'),
    businessType: varchar('business_type', { length: 50 }),  // 'retail', 'fnb', 'mixed'
    
    status: organizationStatusEnum('status').notNull().default('active'),
    
    // Audit
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: index('organizations_code_idx').on(t.code),
    statusIdx: index('organizations_status_idx').on(t.status),
  })
);

/**
 * Outlets — physical stores belonging to an organization.
 * Each outlet has its own data (products, orders, staff) but bounded by parent's plan limit.
 */
export const outlets = pgTable(
  'outlets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    
    name: varchar('name', { length: 150 }).notNull(),
    code: varchar('code', { length: 50 }).notNull(),  // 'JKT-01', 'BDG-01'
    address: text('address'),
    phone: varchar('phone', { length: 20 }),
    
    // Hierarchy (optional, for future use)
    parentOutletId: uuid('parent_outlet_id'),
    
    status: organizationStatusEnum('status').notNull().default('active'),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('outlets_org_idx').on(t.organizationId),
    codeIdx: unique('outlets_org_code_unique').on(t.organizationId, t.code),
    statusIdx: index('outlets_status_idx').on(t.status),
  })
);

/**
 * Outlet-User junction — many-to-many for multi-outlet users.
 * Allows a manager to access >1 outlet in the same organization.
 */
export const outletUsers = pgTable(
  'outlet_users',
  {
    outletId: uuid('outlet_id').notNull().references(() => outlets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(),  // 'manager', 'cashier', 'warehouse'
    isPrimary: boolean('is_primary').notNull().default(false),  // default outlet user
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.outletId, t.userId] }),
    userIdx: index('outlet_users_user_idx').on(t.userId),
    primaryIdx: index('outlet_users_primary_idx').on(t.userId, t.isPrimary),
  })
);

/**
 * Subscription plans — static, defined in code/seeded.
 * Features stored as JSONB for flexibility.
 */
export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    code: subscriptionPlanEnum('code').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    
    // Limits (null = unlimited)
    maxOutlets: integer('max_outlets'),
    maxUsersPerOutlet: integer('max_users_per_outlet'),
    maxProducts: integer('max_products'),
    maxTransactionsPerMonth: integer('max_transactions_per_month'),
    maxStorageMb: integer('max_storage_mb'),
    
    // Feature flags (flexible JSON)
    features: jsonb('features').notNull().default({}),
    
    // Pricing (rupiah)
    priceMonthlyIdr: integer('price_monthly_idr').notNull().default(0),
    priceYearlyIdr: integer('price_yearly_idr'),
    
    // Display
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    isPublic: boolean('is_public').notNull().default(true),  // shown on pricing page
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index('subscription_plans_active_idx').on(t.isActive, t.isPublic),
    sortIdx: index('subscription_plans_sort_idx').on(t.sortOrder),
  })
);

/**
 * Subscriptions — customer's current plan.
 * 1 active subscription per organization (enforced at app level).
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    planCode: subscriptionPlanEnum('plan_code').notNull().references(() => subscriptionPlans.code),
    
    status: subscriptionStatusEnum('status').notNull().default('active'),
    
    // Time periods
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    
    // Cancellation
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    
    // Billing
    billingCycle: billingCycleEnum('billing_cycle').notNull().default('monthly'),
    autoRenew: boolean('auto_renew').notNull().default(true),
    
    // Custom overrides (Wafiq can grant)
    customMaxOutlets: integer('custom_max_outlets'),
    customMaxUsers: integer('custom_max_users'),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index('subscriptions_org_idx').on(t.organizationId),
    statusIdx: index('subscriptions_status_idx').on(t.status),
    periodEndIdx: index('subscriptions_period_end_idx').on(t.currentPeriodEnd),
  })
);

/**
 * Subscription payments — billing history (Phase 2 will use Midtrans).
 * For now, manual payments are recorded here.
 */
export const subscriptionPayments = pgTable(
  'subscription_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    
    amountIdr: integer('amount_idr').notNull(),
    paymentMethod: varchar('payment_method', { length: 50 }),  // 'qris', 'transfer', 'manual', 'cc'
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    
    // Midtrans integration (Phase 2)
    midtransTransactionId: varchar('midtrans_transaction_id', { length: 100 }),
    midtransPaymentType: varchar('midtrans_payment_type', { length: 50 }),
    midtransResponse: jsonb('midtrans_response'),
    
    // Period this payment covers
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    
    // Manual payment tracking
    manualReference: text('manual_reference'),  // 'Transfer BCA 12345'
    manualNotes: text('manual_notes'),
    
    paidAt: timestamp('paid_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
    
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    subIdx: index('subscription_payments_sub_idx').on(t.subscriptionId),
    orgIdx: index('subscription_payments_org_idx').on(t.organizationId),
    statusIdx: index('subscription_payments_status_idx').on(t.paymentStatus),
    midtransIdx: index('subscription_payments_midtrans_idx').on(t.midtransTransactionId),
  })
);
