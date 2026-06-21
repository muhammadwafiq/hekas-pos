/**
 * One-shot: promote manager1 to super_admin (so we can test admin endpoints).
 * Run with: bun scripts/promote-super-admin.ts
 */
import postgres from 'postgres';
import { config } from 'dotenv';
config();

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function main() {
  const result = await sql`
    UPDATE users
    SET role = 'super_admin'
    WHERE username = 'manager1'
    RETURNING id, username, role, full_name
  `;

  if (result.length === 0) {
    console.log('❌ manager1 not found');
    process.exit(1);
  }

  console.log('✅ Promoted to super_admin:');
  console.log(result[0]);

  // Also list all users to confirm
  const all = await sql`SELECT username, role, full_name FROM users ORDER BY role, username`;
  console.log('\n📋 All users:');
  console.table(all);

  await sql.end();
}

main().catch(console.error);
