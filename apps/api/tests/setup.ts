/**
 * Test setup — runs before each test file.
 * Provides:
 *  - Test DB connection (uses hekas_pos_test)
 *  - Truncate helper for clean state
 *  - Auth token generator
 */

import { beforeAll, afterAll, beforeEach } from 'bun:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema/index.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://hekas:hekas_dev_password_change_me@127.0.0.1:5432/hekas_pos_test';

export const sql = postgres(TEST_DATABASE_URL, { max: 5 });
export const db = drizzle(sql, { schema });

beforeAll(async () => {
  console.log('🧪 Test DB connected:', TEST_DATABASE_URL);
});

afterAll(async () => {
  await sql.end();
});

/** Truncate all tables except drizzle metadata */
export async function truncateAll() {
  const tables = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name NOT LIKE '\_drizzle%'
  `;
  for (const { table_name } of tables) {
    await sql.unsafe(`TRUNCATE TABLE "${table_name}" CASCADE`);
  }
}

/** Insert minimum fixtures (1 outlet, 1 cashier, 1 manager) */
export async function seedFixtures() {
  const [outlet] = await sql<{ outlet_id: string }[]>`
    INSERT INTO outlet_settings (outlet_id, name, tax_rate, currency)
    VALUES (gen_random_uuid(), 'Test Outlet', 10, 'IDR')
    RETURNING outlet_id
  `;
  return { outletId: outlet.outlet_id };
}

/** Generate JWT for testing */
export async function getTestToken(
  jwt: { sign: (p: any) => Promise<string> },
  payload: { sub: string; role: string; outletId: string }
) {
  return jwt.sign(payload);
}

beforeEach(async () => {
  // Default: clean state before each test
  // await truncateAll(); // uncomment if you want clean slate per test
});
