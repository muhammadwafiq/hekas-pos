/**
 * Database seed script.
 * Creates: 1 outlet, 6 categories, 20 products, 3 users (with hashed passwords), 4 members, initial stocks.
 *
 * Run: `bun db:seed` or `bun run src/db/seed.ts`
 */

import { sql } from '../config/database.js';
import { hashPassword } from '../lib/password.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

async function seed() {
  const startTime = Date.now();
  logger.info('🌱 Starting database seed...');

  // ====== OUTLET ======
  const [outlet] = await sql`
    INSERT INTO outlet_settings (outlet_id, name, address, phone, email, tax_rate, currency, receipt_header, receipt_footer, open_time, close_time, timezone)
    VALUES (gen_random_uuid(), 'Duamart Pusat', 'Jl. Contoh No. 123, Jakarta', '021-12345678', 'pusat@duamart.id', 10, 'IDR', 'Duamart — Belanja Hemat', 'Terima kasih atas kunjungan Anda!', '07:00', '22:00', 'Asia/Jakarta')
    RETURNING outlet_id
  `;
  const outletId = outlet.outlet_id;
  logger.info({ outletId }, '✅ Outlet created');

  // ====== CATEGORIES (6) ======
  const categoryNames = [
    { name: 'Makanan & Snack', icon: '🍪' },
    { name: 'Minuman', icon: '🥤' },
    { name: 'Sabun & Kecantikan', icon: '🧼' },
    { name: 'Bumbu Dapur', icon: '🧂' },
    { name: 'Beras & Bahan Pokok', icon: '🌾' },
    { name: 'Rokok & Perlengkapan', icon: '🚬' },
  ];

  const categories = await sql`
    INSERT INTO categories ${sql(
      categoryNames.map((c) => ({
        outlet_id: outletId,
        name: c.name,
        icon_url: null,
        sort_order: 0,
        is_active: true,
      }))
    )}
    RETURNING id, name
  `;
  const catMap: Record<string, string> = {};
  for (const c of categories) {
    catMap[c.name] = c.id;
  }
  logger.info({ count: categories.length }, '✅ Categories created');

  // ====== SUPPLIER ======
  const [supplier] = await sql`
    INSERT INTO suppliers (name, contact_person, phone, email, is_active)
    VALUES ('PT Sumber Rezeki', 'Pak Joko', '0812-1111-2222', 'order@sumberrezeki.id', true)
    RETURNING id
  `;
  const supplierId = supplier.id;
  logger.info({ supplierId }, '✅ Supplier created');

  // ====== PRODUCTS (20) ======
  const productSeeds = [
    // Makanan
    { cat: 'Makanan & Snack', sku: 'MKN-001', name: 'Chitato 68g', price: 12500, min: 20 },
    { cat: 'Makanan & Snack', sku: 'MKN-002', name: 'Tango Wafer 120g', price: 9500, min: 20 },
    { cat: 'Makanan & Snack', sku: 'MKN-003', name: 'Indomie Goreng', price: 3500, min: 50 },
    { cat: 'Makanan & Snack', sku: 'MKN-004', name: 'Indomie Kuah Soto', price: 3500, min: 50 },
    // Minuman
    { cat: 'Minuman', sku: 'MNM-001', name: 'Aqua 600ml', price: 4000, min: 50 },
    { cat: 'Minuman', sku: 'MNM-002', name: 'Teh Pucuk 350ml', price: 5000, min: 30 },
    { cat: 'Minuman', sku: 'MNM-003', name: 'Coca Cola 390ml', price: 7500, min: 30 },
    { cat: 'Minuman', sku: 'MNM-004', name: 'Kopi Sachet ABC', price: 1500, min: 100 },
    // Sabun
    { cat: 'Sabun & Kecantikan', sku: 'SBN-001', name: 'Lifebuoy 80g', price: 4500, min: 20 },
    { cat: 'Sabun & Kecantikan', sku: 'SBN-002', name: 'Shampoo Sunslick 100ml', price: 18500, min: 10 },
    { cat: 'Sabun & Kecantikan', sku: 'SBN-003', name: 'Pasta Gigi Pepsodent 120g', price: 8500, min: 15 },
    // Bumbu
    { cat: 'Bumbu Dapur', sku: 'BMB-001', name: 'Garam Dapur 500g', price: 3000, min: 30 },
    { cat: 'Bumbu Dapur', sku: 'BMB-002', name: 'Minyak Goreng Bimoli 1L', price: 22000, min: 20 },
    { cat: 'Bumbu Dapur', sku: 'BMB-003', name: 'Kecap Manis ABC 275ml', price: 12000, min: 15 },
    // Beras
    { cat: 'Beras & Bahan Pokok', sku: 'BRP-001', name: 'Beras Premium 5kg', price: 78000, min: 10 },
    { cat: 'Beras & Bahan Pokok', sku: 'BRP-002', name: 'Gula Pasir 1kg', price: 16500, min: 25 },
    { cat: 'Beras & Bahan Pokok', sku: 'BRP-003', name: 'Tepung Terigu 1kg', price: 12500, min: 20 },
    // Rokok
    { cat: 'Rokok & Perlengkapan', sku: 'RK-001', name: 'Gudang Garam Surya 12', price: 25000, min: 10 },
    { cat: 'Rokok & Perlengkapan', sku: 'RK-002', name: 'Djarum Super 12', price: 22000, min: 10 },
    { cat: 'Rokok & Perlengkapan', sku: 'RK-003', name: 'Korek Api Gas', price: 3000, min: 50 },
  ];

  const products = await sql`
    INSERT INTO products ${sql(
      productSeeds.map((p) => ({
        sku: p.sku,
        barcode: p.sku,
        name: p.name,
        description: null,
        category_id: catMap[p.cat],
        supplier_id: supplierId,
        outlet_id: outletId,
        purchase_price: Math.floor(p.price * 0.7).toString(),
        selling_price: p.price.toString(),
        stock_min: p.min,
        stock_max: p.min * 10,
        unit: 'pcs',
        status: 'aktif',
      }))
    )}
    RETURNING id, sku
  `;
  logger.info({ count: products.length }, '✅ Products created');

  // ====== STOCKS ======
  await sql`
    INSERT INTO stocks ${sql(
      products.map((p) => ({
        product_id: p.id,
        outlet_id: outletId,
        quantity: 100, // initial stock
        reserved: 0,
      }))
    )}
  `;
  logger.info({ count: products.length }, '✅ Initial stocks created');

  // ====== USERS (3) ======
  const defaultPw = env.SEED_DEFAULT_PASSWORD;
  const kasirPw = await hashPassword(defaultPw);
  const adminPw = await hashPassword(defaultPw);
  const managerPw = await hashPassword(defaultPw);

  await sql`
    INSERT INTO users (username, password_hash, full_name, email, phone, role, outlet_id, pin_hash, is_active)
    VALUES
      ('kasir1', ${kasirPw}, 'Siti Aminah', 'kasir1@duamart.id', '0812-1000-0001', 'kasir', ${outletId}, ${await hashPassword('1234')}, true),
      ('gudang1', ${adminPw}, 'Pak Budi', 'gudang1@duamart.id', '0812-1000-0002', 'admin_gudang', ${outletId}, ${await hashPassword('1234')}, true),
      ('manager1', ${managerPw}, 'Bu Dewi', 'manager1@duamart.id', '0812-1000-0003', 'manager', ${outletId}, ${await hashPassword('1234')}, true)
  `;
  logger.info({ count: 3, defaultPassword: defaultPw }, '✅ Users created (default password)');

  // ====== MEMBERS (4) ======
  await sql`
    INSERT INTO members (member_code, outlet_id, name, phone, email, tier, points, total_spent, is_active)
    VALUES
      ('MBR-001', ${outletId}, 'Ibu Ratna', '0813-2000-0001', 'ratna@gmail.com', 'gold', 1200, 850000, true),
      ('MBR-002', ${outletId}, 'Pak Hartono', '0813-2000-0002', null, 'silver', 350, 250000, true),
      ('MBR-003', ${outletId}, 'Ibu Lina', '0813-2000-0003', 'lina@gmail.com', 'platinum', 5000, 3200000, true),
      ('MBR-004', ${outletId}, 'Mas Andi', '0813-2000-0004', null, 'silver', 80, 50000, true)
  `;
  logger.info({ count: 4 }, '✅ Members created');

  // ====== DONE ======
  const elapsed = Date.now() - startTime;
  logger.info({ elapsed_ms: elapsed }, '🎉 Seed complete!');
  logger.info({
    outlet_id: outletId,
    login: [
      { username: 'kasir1', password: defaultPw, role: 'kasir' },
      { username: 'gudang1', password: defaultPw, role: 'admin_gudang' },
      { username: 'manager1', password: defaultPw, role: 'manager' },
    ],
    pin: '1234',
  }, '🔐 Default credentials');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'Seed failed');
    process.exit(1);
  });
