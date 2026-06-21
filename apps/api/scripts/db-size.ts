// DB size checker (uses project's dotenv)
import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '/home/wpx-elfaent/HEKAS-POS-JOSJIS/apps/api/.env' });

const sql = postgres(process.env.DATABASE_URL!, {max: 1, idle_timeout: 1});

const dbs = await sql`SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size FROM pg_database WHERE datistemplate = false ORDER BY datname`;
console.log('=== Database sizes ===');
for (const r of dbs) {
  console.log(`  ${r.datname}: ${r.size}`);
}

const tables = await sql`
  SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(tablename::text)) AS total,
    pg_total_relation_size(tablename::text) AS bytes
  FROM pg_tables 
  WHERE schemaname='public'
  ORDER BY pg_total_relation_size(tablename::text) DESC
  LIMIT 10
`;
console.log('\n=== Top 10 largest tables in hekas_pos ===');
for (const t of tables) {
  const mb = (t.bytes / 1024 / 1024).toFixed(2);
  console.log(`  ${t.tablename.padEnd(30)} ${t.total.padEnd(12)} (${mb} MB)`);
}

const total = await sql`SELECT pg_size_pretty(pg_database_size('hekas_pos')) AS total`;
console.log(`\nTotal prod DB: ${total[0].total}`);

await sql.end();