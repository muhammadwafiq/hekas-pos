import { defineConfig } from 'drizzle-kit';
import { env } from './src/config/env.js';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
  // Penting: pgEnum terdistribusi via file schema, jangan auto-rename
  schemaFilter: ['public'],
  tablesFilter: ['*'],
  // Prefix migrations folder biar gampang di-track
  migrations: {
    table: '__drizzle_migrations',
    schema: 'public',
    prefix: 'timestamp',
  },
});