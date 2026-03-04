/**
 * Environment variable validation and access.
 * Solana-only configuration. No mock mode — real data or fail clearly.
 */

import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  OPENAI_MODEL: z.string().default('gpt-4o'),

  HELIUS_API_KEY: z.string().optional(),
  BIRDEYE_API_KEY: z.string().optional(),
  JUPITER_API_KEY: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(30),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Environment validation failed:', parsed.error.flatten());
    throw new Error('Invalid environment configuration');
  }
  _env = parsed.data;
  return _env;
}

/**
 * Require a specific env key. Throws with a clear message if missing.
 * No mock fallback — the caller must handle the error.
 */
export function requireKey(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Add it in Vercel project settings or .env.local.`
    );
  }
  return value;
}

/**
 * Check if Helius API key is configured.
 */
export function isHeliusConfigured(): boolean {
  return !!process.env.HELIUS_API_KEY;
}

/**
 * Check if Birdeye API key is configured.
 */
export function isBirdeyeConfigured(): boolean {
  return !!process.env.BIRDEYE_API_KEY;
}

/**
 * Check if Jupiter API key is configured.
 */
export function isJupiterConfigured(): boolean {
  return !!process.env.JUPITER_API_KEY;
}
