/**
 * Subscription plan seed data.
 * 6 tiers: trial (free), starter, basic, standard, pro, enterprise.
 *
 * Run: `bun src/db/seed-subscriptions.ts` (or include in main seed.ts)
 *
 * Prices in IDR (Indonesian Rupiah). Adjust to your market.
 */

import { sql } from '../config/database.js';
import { logger } from '../config/logger.js';

const PLANS = [
  {
    code: 'trial',
    name: 'Trial (30 Hari)',
    description: 'Coba semua fitur gratis selama 30 hari. Cocok untuk testing.',
    maxOutlets: 1,
    maxUsersPerOutlet: 3,
    maxProducts: 100,
    maxTransactionsPerMonth: 500,
    maxStorageMb: 100,
    features: {
      hr_module: true,
      members: true,
      multi_outlet: true,
      stock_transfer: true,
      basic_reports: true,
      email_support: true,
    },
    priceMonthlyIdr: 0,
    priceYearlyIdr: 0,
    sortOrder: 0,
    isActive: true,
    isPublic: true,
  },
  {
    code: 'starter',
    name: 'Starter',
    description: 'Untuk warung / toko kecil dengan 1 outlet.',
    maxOutlets: 1,
    maxUsersPerOutlet: 3,
    maxProducts: 500,
    maxTransactionsPerMonth: 2000,
    maxStorageMb: 500,
    features: {
      hr_module: false,
      members: false,
      multi_outlet: false,
      stock_transfer: false,
      basic_reports: true,
      email_support: true,
    },
    priceMonthlyIdr: 99000,        // Rp 99K
    priceYearlyIdr: 990000,        // Rp 990K (save ~17%)
    sortOrder: 1,
    isActive: true,
    isPublic: true,
  },
  {
    code: 'basic',
    name: 'Basic (2 Outlet)',
    description: 'Untuk toko dengan 2 cabang. Sudah termasuk HR module.',
    maxOutlets: 2,
    maxUsersPerOutlet: 5,
    maxProducts: 1000,
    maxTransactionsPerMonth: 5000,
    maxStorageMb: 1000,
    features: {
      hr_module: true,
      members: false,
      multi_outlet: true,
      stock_transfer: false,
      basic_reports: true,
      email_support: true,
    },
    priceMonthlyIdr: 179000,       // Rp 179K
    priceYearlyIdr: 1790000,
    sortOrder: 2,
    isActive: true,
    isPublic: true,
  },
  {
    code: 'standard',
    name: 'Standard (5 Outlet)',
    description: 'Untuk bisnis retail dengan 5 cabang. Lengkap dengan member loyalty.',
    maxOutlets: 5,
    maxUsersPerOutlet: 10,
    maxProducts: 5000,
    maxTransactionsPerMonth: 20000,
    maxStorageMb: 5000,
    features: {
      hr_module: true,
      members: true,
      multi_outlet: true,
      stock_transfer: false,
      basic_reports: true,
      advanced_reports: true,
      email_support: true,
    },
    priceMonthlyIdr: 399000,       // Rp 399K
    priceYearlyIdr: 3990000,
    sortOrder: 3,
    isActive: true,
    isPublic: true,
  },
  {
    code: 'pro',
    name: 'Pro (10 Outlet)',
    description: 'Untuk bisnis menengah dengan 10 cabang. Stock transfer + API access.',
    maxOutlets: 10,
    maxUsersPerOutlet: 20,
    maxProducts: 20000,
    maxTransactionsPerMonth: 50000,
    maxStorageMb: 20000,
    features: {
      hr_module: true,
      members: true,
      multi_outlet: true,
      stock_transfer: true,
      basic_reports: true,
      advanced_reports: true,
      api_access: true,
      priority_support: true,
    },
    priceMonthlyIdr: 699000,       // Rp 699K
    priceYearlyIdr: 6990000,
    sortOrder: 4,
    isActive: true,
    isPublic: true,
  },
  {
    code: 'enterprise',
    name: 'Enterprise (Custom)',
    description: 'Untuk franchise / bisnis besar. Custom pricing, white-label, dedicated support.',
    maxOutlets: null,              // unlimited
    maxUsersPerOutlet: null,       // unlimited
    maxProducts: null,             // unlimited
    maxTransactionsPerMonth: null, // unlimited
    maxStorageMb: null,            // unlimited
    features: {
      hr_module: true,
      members: true,
      multi_outlet: true,
      stock_transfer: true,
      basic_reports: true,
      advanced_reports: true,
      custom_reports: true,
      api_access: true,
      white_label: true,
      priority_support: true,
      dedicated_account_manager: true,
      custom_integrations: true,
    },
    priceMonthlyIdr: 1500000,      // Rp 1.5jt (starting price, negotiable)
    priceYearlyIdr: 15000000,      // Rp 15jt (save ~17%)
    sortOrder: 5,
    isActive: true,
    isPublic: true,                // shown but with "Contact Sales" CTA
  },
];

export async function seedSubscriptionPlans() {
  const startTime = Date.now();
  logger.info('🌱 Seeding subscription plans...');

  for (const plan of PLANS) {
    await sql`
      INSERT INTO subscription_plans ${sql({
        code: plan.code,
        name: plan.name,
        description: plan.description,
        max_outlets: plan.maxOutlets,
        max_users_per_outlet: plan.maxUsersPerOutlet,
        max_products: plan.maxProducts,
        max_transactions_per_month: plan.maxTransactionsPerMonth,
        max_storage_mb: plan.maxStorageMb,
        features: JSON.stringify(plan.features),
        price_monthly_idr: plan.priceMonthlyIdr,
        price_yearly_idr: plan.priceYearlyIdr,
        sort_order: plan.sortOrder,
        is_active: plan.isActive,
        is_public: plan.isPublic,
      })}
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        max_outlets = EXCLUDED.max_outlets,
        max_users_per_outlet = EXCLUDED.max_users_per_outlet,
        max_products = EXCLUDED.max_products,
        max_transactions_per_month = EXCLUDED.max_transactions_per_month,
        max_storage_mb = EXCLUDED.max_storage_mb,
        features = EXCLUDED.features,
        price_monthly_idr = EXCLUDED.price_monthly_idr,
        price_yearly_idr = EXCLUDED.price_yearly_idr,
        sort_order = EXCLUDED.sort_order,
        is_active = EXCLUDED.is_active,
        is_public = EXCLUDED.is_public,
        updated_at = NOW()
    `;
    logger.info({ plan: plan.code, name: plan.name }, '  ✅ Plan upserted');
  }

  const duration = Date.now() - startTime;
  logger.info({ duration, count: PLANS.length }, '✅ Subscription plans seeded');
}

// Run if executed directly
if (import.meta.main) {
  await seedSubscriptionPlans();
  process.exit(0);
}
