/**
 * Backfill drizzle.__drizzle_migrations with the migrations that were
 * applied via `db:push` originally (no migration history was tracked).
 *
 * Inserts:
 *   1. 20260620074656_conscious_bloodstorm (initial schema)
 *   2. 20260620213039_whole_toad_men (is_primary column)
 *
 * Idempotent: only inserts if not already there.
 *
 * Run: bun run scripts/backfill-migrations.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: `${import.meta.dir}/../.env` });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client);

// Migration journal entries
const MIGRATIONS = [
  { id: 1, hash: 'b35a4c6533c324008328be0b6eb5424f7bcce023ee28ccf2ec16669fc470d2d7', when: 1781941616356 },
  { id: 2, hash: '0b1e7b9c95c2acf21b3aaf0e440a11c4e0439c284115e73392cb9457a5a16c16', when: 1781991039638 },
];

// Ensure drizzle schema exists (in case it doesn't)
await client`CREATE SCHEMA IF NOT EXISTS drizzle`;

// Create migrations table if not exists
await db.execute(sql`
  CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
    id SERIAL PRIMARY KEY,
    hash TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )
`);

// Insert each migration (idempotent)
for (const m of MIGRATIONS) {
  const existing = await client`
    SELECT id FROM drizzle."__drizzle_migrations" WHERE id = ${m.id}
  `;
  if (existing.length > 0) {
    console.log(`⏭️  Migration #${m.id} already tracked`);
  } else {
    await client`
      INSERT INTO drizzle."__drizzle_migrations" (id, hash, created_at)
      VALUES (${m.id}, ${m.hash}, ${m.when})
    `;
    console.log(`✅ Inserted migration #${m.id}`);
  }
}

// Verify
const all = await client`SELECT id, hash FROM drizzle."__drizzle_migrations" ORDER BY id`;
console.log('\n📋 Current migration tracking:');
for (const m of all) {
  console.log(`  #${m.id}: ${m.hash.substring(0, 16)}...`);
}

await client.end();
console.log('\n✅ Backfill complete');