/**
 * POST /api/wallet/sync
 *
 * Fetches wallet swaps from Helius, enriches with prices,
 * computes PnL + psychology, stores in DB.
 *
 * Implements stale-while-revalidate:
 * - If cached data is <15 min old and force=false, returns cached.
 * - Otherwise, does a full re-sync.
 *
 * No mock data. Requires HELIUS_API_KEY.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { applyRateLimit } from '@/lib/security/rate-limit';
import { SOLANA_ADDRESS_REGEX } from '@/lib/solana/constants';
import { getWalletInfo, fetchWalletTrades } from '@/lib/solana/helius';
import { enrichTradesWithPrices } from '@/lib/solana/birdeye';
import { computeAllWindows, computeEquityCurve } from '@/lib/analytics/pnl';
import { analyzeTradesPsychology } from '@/lib/analytics/psychology';
import { fetchMarketMood } from '@/lib/solana/market';
import { isDbConfigured } from '@/lib/db';
import { isHeliusConfigured } from '@/lib/utils/env';
import { isSolDomain, resolveSolDomain, reverseResolveSol } from '@/lib/solana/sns';

const syncSchema = z.object({
  address: z.string().min(1),
  force: z.boolean().optional().default(false),
});

export const runtime = 'nodejs';
export const maxDuration = 60;

const STALE_THRESHOLD_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const rateLimited = applyRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    if (!isHeliusConfigured()) {
      return NextResponse.json(
        {
          error: 'Backend not configured',
          detail: 'HELIUS_API_KEY is required to fetch Solana data. Add it in Vercel project settings.',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = syncSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    let { address } = parsed.data;
    const { force } = parsed.data;
    let solDomain: string | undefined;

    // Resolve .sol → address (required before we can fetch data)
    if (isSolDomain(address)) {
      const resolved = await resolveSolDomain(address);
      if (!resolved) {
        return NextResponse.json({ error: `Could not resolve ${address}` }, { status: 404 });
      }
      solDomain = resolved.domain;
      address = resolved.address;
    } else if (!SOLANA_ADDRESS_REGEX.test(address)) {
      return NextResponse.json({ error: 'Invalid Solana address.' }, { status: 400 });
    }
    // Reverse SNS lookup runs later in parallel — not blocking

    // ── Check DB cache ──────────────────────────────────────
    if (isDbConfigured() && !force) {
      try {
        const { getWalletByAddress, getLastSync, getSwaps } = await import('@/lib/db/queries');

        const dbWallet = await getWalletByAddress(address);
        if (dbWallet) {
          const lastSync = await getLastSync(dbWallet.id);
          if (lastSync?.completedAt) {
            const age = Date.now() - lastSync.completedAt.getTime();
            if (age < STALE_THRESHOLD_MS) {
              const cachedSwaps = await getSwaps(dbWallet.id, { limit: 500 });
              const trades = cachedSwaps.sort((a, b) => b.timestamp - a.timestamp);
              const pnlWindows = computeAllWindows(trades);
              const equityCurve = computeEquityCurve(trades);
              const signals = analyzeTradesPsychology(trades);

              // Fetch real market mood (non-blocking, best effort)
              const marketMood = await fetchMarketMood().catch(() => null);

              // DEX breakdown
              const dexCounts: Record<string, number> = {};
              for (const t of trades) {
                dexCounts[t.source] = (dexCounts[t.source] ?? 0) + 1;
              }

              // Count priced swaps
              const pricedSwaps = trades.filter(t => t.priceUsd > 0).length;

              return NextResponse.json({
                status: 'ok',
                wallet: {
                  address: dbWallet.address,
                  solDomain: dbWallet.solDomain ?? solDomain,
                  solBalance: dbWallet.solBalance ?? 0,
                  tokenCount: dbWallet.tokenCount ?? 0,
                  firstSeen: dbWallet.firstSeen?.getTime(),
                  lastActive: dbWallet.lastActive?.getTime(),
                },
                trades: trades.slice(0, 50),
                totalTradeCount: trades.length,
                pricedSwapCount: pricedSwaps,
                pnl: pnlWindows,
                equityCurve,
                signals,
                dexBreakdown: dexCounts,
                marketMood,
                lastSyncAt: lastSync.completedAt.toISOString(),
                cached: true,
              });
            }
          }
        }
      } catch (dbError) {
        console.warn('[wallet/sync] DB cache check failed, proceeding with fresh sync:', dbError);
      }
    }

    // ── Fresh sync (parallelized where safe) ──────────────
    const startMs = Date.now();

    // Phase 1: Fetch wallet info, trades, reverse SNS, and market mood in parallel
    const [walletInfo, rawTrades, reverseDomain, marketMood] = await Promise.all([
      getWalletInfo(address),
      fetchWalletTrades(address, 300),
      !solDomain ? reverseResolveSol(address).catch(() => null) : Promise.resolve(null),
      fetchMarketMood().catch(() => null),
    ]);

    if (solDomain) walletInfo.solDomain = solDomain;
    else if (reverseDomain) walletInfo.solDomain = reverseDomain;

    // Phase 2: Price enrichment (requires raw trades)
    const { trades, pricedCount } = await enrichTradesWithPrices(rawTrades);
    trades.sort((a, b) => b.timestamp - a.timestamp);

    // Phase 3: Analytics (CPU-bound, fast)
    const pnlWindows = computeAllWindows(trades);
    const equityCurve = computeEquityCurve(trades);
    const signals = analyzeTradesPsychology(trades);

    // DEX breakdown
    const dexCounts: Record<string, number> = {};
    for (const t of trades) {
      dexCounts[t.source] = (dexCounts[t.source] ?? 0) + 1;
    }

    const durationMs = Date.now() - startMs;
    console.log(`[wallet/sync] Fresh sync for ${address}: ${trades.length} swaps, ${pricedCount} priced, ${durationMs}ms`);

    // ── Store in DB (non-blocking, best-effort) ─────────────
    if (isDbConfigured()) {
      storeInDb(address, walletInfo, trades, pnlWindows).catch(err => {
        console.error('[wallet/sync] DB storage failed:', err);
      });
    }

    return NextResponse.json({
      status: 'ok',
      wallet: walletInfo,
      trades: trades.slice(0, 50),
      totalTradeCount: trades.length,
      pricedSwapCount: pricedCount,
      pnl: pnlWindows,
      equityCurve,
      signals,
      dexBreakdown: dexCounts,
      marketMood,
      lastSyncAt: new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[wallet/sync] Error:', message);

    const isProviderError = message.includes('Helius') || message.includes('API error');
    const isRateLimit = message.includes('429') || message.includes('rate');

    return NextResponse.json(
      {
        status: 'error',
        error: isRateLimit
          ? 'Rate limited by Solana data provider. Please try again in a few seconds.'
          : isProviderError
            ? 'Solana data provider error. Please try again.'
            : 'Failed to sync wallet. Please try again.',
        detail: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}

async function storeInDb(
  address: string,
  walletInfo: { address: string; solDomain?: string; solBalance: number; tokenCount: number; firstSeen?: number; lastActive?: number },
  trades: import('@/types').Trade[],
  pnlWindows: Record<number, import('@/types').PnLSummary>
) {
  const {
    findOrCreateWallet, updateWalletInfo, createSyncRun,
    completeSyncRun, failSyncRun, upsertSwaps, upsertDailyPnl,
  } = await import('@/lib/db/queries');

  const wallet = await findOrCreateWallet(address, walletInfo.solDomain);
  const syncRun = await createSyncRun(wallet.id);

  try {
    await updateWalletInfo(wallet.id, {
      solBalance: walletInfo.solBalance,
      tokenCount: walletInfo.tokenCount,
      firstSeen: walletInfo.firstSeen ? new Date(walletInfo.firstSeen) : undefined,
      lastActive: walletInfo.lastActive ? new Date(walletInfo.lastActive) : undefined,
    });

    await upsertSwaps(wallet.id, trades);

    const fullPnl = pnlWindows[365];
    if (fullPnl?.dailyReturns?.length) {
      await upsertDailyPnl(wallet.id, fullPnl.dailyReturns);
    }

    const lastSig = trades.length > 0 ? trades[0].signature : undefined;
    await completeSyncRun(syncRun.id, trades.length, lastSig);
  } catch (err) {
    await failSyncRun(syncRun.id, err instanceof Error ? err.message : 'Unknown error');
    throw err;
  }
}
