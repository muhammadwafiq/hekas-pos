/**
 * Apply Drizzle migrations to the database.
 * Reads SQL files from /drizzle folder in lexicographic order.
 * Tracks applied migrations in __drizzle_migrations table.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../config/env.js';

const connectionString = env.DATABASE_URL;
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function main() {
  console.log('Applying migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✅ Migrations applied');
  await sql.end();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});