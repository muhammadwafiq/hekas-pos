/**
 * One-off migration: add is_primary column to product_images.
 * Generated SQL file: drizzle/20260620213039_whole_toad_men.sql
 * Run: bun run scripts/apply-is-primary.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { env } from '../src/config/env.js';

const client = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(client);

await db.execute(sql`
  ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false NOT NULL;
`);
console.log('✅ is_primary column added to product_images');

const result = await client`
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'product_images' AND column_name = 'is_primary'
`;
console.log('Verified:', result);

await client.end();