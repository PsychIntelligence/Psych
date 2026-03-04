/**
 * Neon Postgres connection singleton for Drizzle ORM.
 *
 * Uses @neondatabase/serverless which works in Vercel Edge & Node runtimes.
 * Singleton pattern prevents connection exhaustion in serverless.
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Connect Neon to your Vercel project or set it in .env.local.\n' +
      'See DEPLOYMENT.md for setup instructions.'
    );
  }
  return url;
}

// Singleton for the Drizzle instance
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;

  const sql = neon(getDatabaseUrl());
  _db = drizzle(sql, { schema });
  return _db;
}

/**
 * Check if the database is configured (DATABASE_URL is set).
 * Used by API routes to gracefully degrade when no DB is available.
 */
export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}
