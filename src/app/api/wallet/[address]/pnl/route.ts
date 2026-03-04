/**
 * GET /api/wallet/:address/pnl?range=30
 *
 * Returns daily PnL series for charting.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { SOLANA_ADDRESS_REGEX } from '@/lib/solana/constants';
import { applyRateLimit } from '@/lib/security/rate-limit';
import { isDbConfigured } from '@/lib/db';
import { computePnL } from '@/lib/analytics/pnl';
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
    return NextResponse.json({ error: 'Invalid range.' }, { status: 400 });
  }

  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const { getWalletByAddress, getSwaps } = await import('@/lib/db/queries');
    const wallet = await getWalletByAddress(address);
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found.' }, { status: 404 });
    }

    const trades = await getSwaps(wallet.id, { limit: 500 });
    const pnl = computePnL(trades, range as TimeWindow);

    return NextResponse.json({
      range,
      currency: 'USD',
      approx: false,
      points: pnl.dailyReturns.map(d => ({
        t: d.date,
        v: d.cumulativePnl,
        pnl: d.pnlUsd,
        trades: d.tradeCount,
        vol: d.volume,
      })),
    });
  } catch (error) {
    console.error('[wallet/pnl] Error:', error);
    return NextResponse.json({ error: 'Failed to compute PnL.' }, { status: 500 });
  }
}
