/**
 * Apply migrations to the TEST database.
 * Same logic as db:migrate but targets DATABASE_URL_TEST.
 * Used by: integration tests, CI test job.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from 'dotenv';
import { z } from 'zod';

// Load .env from apps/api/.env
config({ path: `${import.meta.dir}/../.env` });

const EnvSchema = z.object({
  DATABASE_URL_TEST: z.string().min(10),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success || !parsed.data) {
  console.error('❌ DATABASE_URL_TEST env var is required');
  console.error(parsed.success ? 'Unexpected: no data after successful parse' : parsed.error.format());
  process.exit(1);
}

const testUrl = parsed.data.DATABASE_URL_TEST;
const sql = postgres(testUrl, { max: 1 });
const db = drizzle(sql);

async function main() {
  console.log('Applying migrations to TEST DB...');
  console.log('  URL:', testUrl.replace(/:[^:@]+@/, ':***@'));
  await migrate(db, { migrationsFolder: '/home/wpx-elfaent/HEKAS-POS-JOSJIS/apps/api/drizzle' });
  console.log('✅ Test DB migrations applied');
  await sql.end();
}

main().catch((err) => {
  console.error('❌ Test DB migration failed:', err);
  process.exit(1);
});