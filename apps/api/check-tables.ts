import { db } from './src/config/database.js';
import { sql } from 'drizzle-orm';

const r = await db.execute(sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
console.log(r.map((row: any) => row.tablename).join('\n'));

const phase4 = await db.execute(sql`SELECT count(*) as cnt FROM information_schema.columns WHERE table_name IN ('surats','surat_items','surat_approvals','telegram_links','telegram_messages','notification_queue','outgoing_goods')`);
console.log('PHASE4_TABLES_COLS:', JSON.stringify(phase4));