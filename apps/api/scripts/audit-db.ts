/**
 * Database audit script — comprehensive state check.
 */
import postgres from 'postgres';

const url = process.env.DATABASE_URL || 'postgres://hekas:hekas@localhost:5432/hekas_pos';

const sql = postgres(url, { max: 1, idle_timeout: 1 });

console.log('━'.repeat(60));
console.log('PRODUCTION DB:', url.replace(/:[^:@]+@/, ':***@'));
console.log('━'.repeat(60));

// 1. Migrations tracking (note: actual schema is `drizzle`, not `public`)
const migrations = await sql`
  SELECT id, hash, created_at
  FROM drizzle."__drizzle_migrations"
  ORDER BY id
`;
console.log('\n📋 Applied migrations:');
  for (const m of migrations) {
    const created = typeof m.created_at === 'string' ? m.created_at : m.created_at.toISOString();
    console.log(`  #${m.id}: ${m.hash} (${created})`);
  }

// 2. Tables count
const tables = await sql`
  SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
`;
console.log(`\n📊 Tables: ${tables.length}`);

// 3. Specific column check
const isPrimaryCol = await sql`
  SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'product_images' AND column_name = 'is_primary'
`;
console.log('\n🔍 is_primary column check:');
console.log(JSON.stringify(isPrimaryCol, null, 2));

// 4. Test DB
console.log('\n' + '━'.repeat(60));
const testUrl = (process.env.DATABASE_URL_TEST || 'postgres://hekas:hekas@localhost:5432/hekas_pos_test');
console.log('TEST DB:', testUrl.replace(/:[^:@]+@/, ':***@'));
console.log('━'.repeat(60));

try {
  const testSql = postgres(testUrl, { max: 1, idle_timeout: 1 });
  const testTables = await testSql`
    SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename
  `;
  console.log(`\n📊 Test tables: ${testTables.length}`);
  if (testTables.length === 0) {
    console.log('  ⚠️  EMPTY — test DB has no schema!');
  } else {
    console.log('  Tables:', testTables.map(t => t.tablename).slice(0, 5).join(', '), '...');
  }
  await testSql.end();
} catch (e) {
  console.log('  ❌ Cannot connect:', (e as Error).message);
}

// 5. Check for pg-boss schema
console.log('\n' + '━'.repeat(60));
console.log('pg-boss SCHEMA:');
console.log('━'.repeat(60));
const pgbossTables = await sql`
  SELECT tablename FROM pg_tables WHERE schemaname='pgboss' ORDER BY tablename
`;
console.log(`\n📊 pg-boss tables: ${pgbossTables.length}`);
for (const t of pgbossTables) {
  console.log(`  - ${t.tablename}`);
}

// 6. Check audit_logs has data
const auditCount = await sql`SELECT COUNT(*) as cnt FROM audit_logs`;
console.log(`\n📝 audit_logs: ${auditCount[0].cnt} rows`);

// 7. Check users (default creds)
const users = await sql`
  SELECT username, role, is_active FROM users
  WHERE username IN ('kasir1', 'gudang1', 'manager1')
  ORDER BY username
`;
console.log('\n👤 Default users:');
for (const u of users) {
  console.log(`  ${u.username} (${u.role}) active=${u.is_active}`);
}

// 8. Check daily_reports
const reports = await sql`SELECT COUNT(*) as cnt FROM daily_reports`;
console.log(`\n📅 daily_reports: ${reports[0].cnt} rows`);

await sql.end();
console.log('\n✅ Audit complete');
