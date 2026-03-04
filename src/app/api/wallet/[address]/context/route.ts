/**
 * GET /api/wallet/:address/context
 *
 * Returns a compact JSON "wallet behavior summary" for chat context.
 * Derived from computed metrics + recent swaps — only public chain data.
 * Used by coach/market chat to inject real context into AI prompts.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { SOLANA_ADDRESS_REGEX } from '@/lib/solana/constants';
import { applyRateLimit } from '@/lib/security/rate-limit';
import { isDbConfigured } from '@/lib/db';
import { computePnL } from '@/lib/analytics/pnl';
import { analyzeTradesPsychology } from '@/lib/analytics/psychology';
import type { TimeWindow } from '@/types';

export const runtime = 'nodejs';

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

  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const { getWalletByAddress, getSwaps } = await import('@/lib/db/queries');
    const wallet = await getWalletByAddress(address);
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found. Sync first.' }, { status: 404 });
    }

    const trades = await getSwaps(wallet.id, { limit: 500 });

    if (trades.length === 0) {
      return NextResponse.json({
        status: 'ok',
        context: {
          wallet: address,
          totalSwaps: 0,
          summary: 'No swap activity found for this wallet.',
        },
      });
    }

    const pnl30 = computePnL(trades, 30 as TimeWindow);
    const signals = analyzeTradesPsychology(trades);
    const pricedSwaps = trades.filter(t => t.priceUsd > 0).length;

    // DEX breakdown
    const dexCounts: Record<string, number> = {};
    for (const t of trades) {
      dexCounts[t.source] = (dexCounts[t.source] ?? 0) + 1;
    }

    // Recent swaps summary (last 5)
    const recentSwaps = trades.slice(0, 5).map(t => ({
      pair: t.pair,
      side: t.side,
      source: t.source,
      usdValue: t.priceUsd > 0 ? `$${t.priceUsd.toFixed(2)}` : 'unpriced',
      ago: formatTimeAgo(t.timestamp),
    }));

    const context = {
      wallet: address,
      domain: wallet.solDomain ?? undefined,
      totalSwaps: trades.length,
      pricedSwaps,
      dataNote: pricedSwaps < trades.length
        ? `Metrics based on ${pricedSwaps} priced swaps out of ${trades.length} total.`
        : undefined,
      pnl30d: {
        totalReturn: `$${pnl30.totalPnlUsd.toFixed(2)}`,
        winRate: `${pnl30.winRate.toFixed(1)}%`,
        profitFactor: pnl30.profitFactor === Infinity ? 'Infinity' : pnl30.profitFactor.toFixed(2),
        maxDrawdown: `${pnl30.maxDrawdownPercent.toFixed(1)}%`,
        expectancy: `$${pnl30.expectancy.toFixed(2)}`,
        totalTrades: pnl30.totalTrades,
      },
      behaviorSignals: signals.slice(0, 5).map(s => ({
        type: s.type,
        severity: s.severity,
        label: s.label,
        description: s.description,
      })),
      dexBreakdown: dexCounts,
      recentSwaps,
    };

    return NextResponse.json({
      status: 'ok',
      context,
    }, {
      headers: {
        'Cache-Control': 's-maxage=30, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[wallet/context] Error:', error);
    return NextResponse.json({ error: 'Failed to build context.' }, { status: 500 });
  }
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
