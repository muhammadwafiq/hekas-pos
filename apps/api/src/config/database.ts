/**
 * Database connection (postgres-js + Drizzle ORM).
 * Single shared client across the app, with pool tuning.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env.js';
import * as schema from '../db/schema/index.js';

const isTest = env.NODE_ENV === 'test';
const connectionString = isTest && env.DATABASE_URL_TEST
  ? env.DATABASE_URL_TEST
  : env.DATABASE_URL;

/** postgres-js client (raw query access) */
export const sql = postgres(connectionString, {
  max: env.DATABASE_POOL_MAX,
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: false, // disable prepared statements for pgbouncer compatibility
  onnotice: () => {}, // suppress notices
});

/** Drizzle ORM client (typed query builder) */
export const db = drizzle(sql, {
  schema,
});

/** Drizzle transaction handle — used by repos that accept an optional tx. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export type DbOrTx = Database | Tx;

/** Close all connections (graceful shutdown) */
export async function closeDb(): Promise<void> {
  await sql.end({ timeout: 5 });
}

/** Health check — verify DB reachable */
export async function pingDb(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export { schema };
export type Database = typeof db;