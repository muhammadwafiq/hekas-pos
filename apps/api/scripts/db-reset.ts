/**
 * Drop & recreate database schema, then re-apply migrations.
 * USE WITH CAUTION — destroys all data.
 */

import postgres from 'postgres';
import { env } from '../config/env.js';

const sql = postgres(env.DATABASE_URL, { max: 1 });

console.log('⚠️  Dropping public schema in', env.DATABASE_URL);
await sql`DROP SCHEMA public CASCADE`;
await sql`CREATE SCHEMA public`;
await sql`GRANT ALL ON SCHEMA public TO ${sql(env.PGUSER)}`;
await sql`GRANT ALL ON SCHEMA public TO public`;

console.log('✅ Schema reset. Now run: bun db:migrate && bun db:seed');
await sql.end();
