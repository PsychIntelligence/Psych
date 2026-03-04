/**
 * GET /api/wallet/:address/summary?range=30
 *
 * Returns computed trading statistics for a given time window.
 * Reads from DB cache if available, otherwise computes from stored swaps.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { SOLANA_ADDRESS_REGEX } from '@/lib/solana/constants';
import { applyRateLimit } from '@/lib/security/rate-limit';
import { isDbConfigured } from '@/lib/db';
import { computePnL } from '@/lib/analytics/pnl';
import { analyzeTradesPsychology } from '@/lib/analytics/psychology';
import type { TimeWindow } from '@/types';

export const runtime = 'nodejs';

const VALID_RANGES = new Set([1, 7, 30, 90, 180, 365]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const rateLimited = applyRateLimit(request);
  if (rateLimited) return rateLimited;

  const { address } = await params;

  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    return NextResponse.json({ error: 'Invalid Solana address.' }, { status: 400 });
  }

  const rangeStr = request.nextUrl.searchParams.get('range') ?? '30';
  const range = parseInt(rangeStr, 10);
  if (!VALID_RANGES.has(range)) {
    return NextResponse.json({ error: 'Invalid range. Use 1, 7, 30, 90, 180, or 365.' }, { status: 400 });
  }

  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database not configured. Run /api/wallet/sync first.' }, { status: 503 });
    }

    const { getWalletByAddress, getSwaps } = await import('@/lib/db/queries');
    const wallet = await getWalletByAddress(address);
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found. Sync first via POST /api/wallet/sync.' }, { status: 404 });
    }

    const trades = await getSwaps(wallet.id, { limit: 500 });
    const pnl = computePnL(trades, range as TimeWindow);
    const signals = analyzeTradesPsychology(trades);

    // DEX breakdown
    const dexCounts: Record<string, number> = {};
    for (const t of trades) {
      dexCounts[t.source] = (dexCounts[t.source] ?? 0) + 1;
    }

    return NextResponse.json({
      range,
      pnl,
      signals,
      dexBreakdown: dexCounts,
      totalSwaps: trades.length,
    });
  } catch (error) {
    console.error('[wallet/summary] Error:', error);
    return NextResponse.json({ error: 'Failed to compute summary.' }, { status: 500 });
  }
}
