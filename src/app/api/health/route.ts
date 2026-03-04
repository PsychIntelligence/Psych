/**
 * GET /api/health
 *
 * Health check endpoint for monitoring.
 */

import { NextResponse } from 'next/server';
import { isHeliusConfigured, isBirdeyeConfigured, isJupiterConfigured } from '@/lib/utils/env';
import { isDbConfigured } from '@/lib/db';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    providers: {
      helius: isHeliusConfigured(),
      jupiter: isJupiterConfigured(),
      birdeye: isBirdeyeConfigured(),
      database: isDbConfigured(),
      openai: !!process.env.OPENAI_API_KEY,
    },
  });
}
