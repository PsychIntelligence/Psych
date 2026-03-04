/**
 * Token pricing for Solana trades.
 *
 * Price sources (priority order):
 * 1. Jupiter Price API v3 — requires JUPITER_API_KEY, 60 RPM
 * 2. Birdeye API — requires BIRDEYE_API_KEY, broader token coverage
 *
 * Critical: SOL price MUST always resolve. Without it, all SOL-denominated
 * trades (99%+ of Pump.fun, most Jupiter) get priceUsd=0 and the entire
 * analytics pipeline (PnL, win rate, drawdown, chart) breaks.
 */

import { isBirdeyeConfigured, isJupiterConfigured } from '@/lib/utils/env';
import { SOL_MINT, STABLECOIN_MINTS } from './constants';

const BIRDEYE_BASE = 'https://public-api.birdeye.so';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v3';

// ── Cache ───────────────────────────────────────────────────────

const priceCache = new Map<string, { value: number; expiresAt: number }>();
const historyCache = new Map<string, { value: HistoricalPrice[]; expiresAt: number }>();

function cacheGet<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ── Types ───────────────────────────────────────────────────────

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Jupiter Price API v3 (60 RPM ≈ 1 RPS) ──────────────────────
// Max 50 ids per request. Throttled to 1 call/sec to stay within limits.

let _lastJupiterCallMs = 0;
const JUPITER_MIN_INTERVAL_MS = 1050;
const JUPITER_MAX_IDS_PER_REQUEST = 50;

async function jupiterThrottle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - _lastJupiterCallMs;
  if (elapsed < JUPITER_MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, JUPITER_MIN_INTERVAL_MS - elapsed));
  }
  _lastJupiterCallMs = Date.now();
}

async function fetchJupiterPrices(mints: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (mints.length === 0) return result;

  const apiKey = process.env.JUPITER_API_KEY;
  if (!apiKey) return result;

  // Chunk into batches of 50 (API limit)
  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += JUPITER_MAX_IDS_PER_REQUEST) {
    chunks.push(mints.slice(i, i + JUPITER_MAX_IDS_PER_REQUEST));
  }

  for (const chunk of chunks) {
    try {
      await jupiterThrottle();

      const ids = chunk.join(',');
      const res = await fetch(`${JUPITER_PRICE_API}?ids=${ids}`, {
        headers: {
          'Accept': 'application/json',
          'x-api-key': apiKey,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (res.status === 429) {
        console.warn('[jupiter-price] Rate limited. Will retry on next call.');
        continue;
      }

      if (!res.ok) {
        console.warn(`[jupiter-price] API returned ${res.status}`);
        continue;
      }

      // V3 response is flat: { "mintAddress": { usdPrice, blockId, decimals } }
      const data = await res.json();
      if (!data || typeof data !== 'object') continue;

      for (const mint of chunk) {
        const entry = data[mint];
        if (entry?.usdPrice) {
          const price = typeof entry.usdPrice === 'string' ? parseFloat(entry.usdPrice) : entry.usdPrice;
          if (price > 0) {
            result.set(mint, price);
            cacheSet(priceCache, mint, price, 30_000);
          }
        }
      }
    } catch (err) {
      console.warn('[jupiter-price] Failed:', err instanceof Error ? err.message : err);
    }
  }

  return result;
}

/**
 * Get SOL price in USD. Tries Jupiter first, then Birdeye.
 * This MUST succeed for analytics to work.
 */
export async function getSolPrice(): Promise<number> {
  const cached = cacheGet(priceCache, SOL_MINT);
  if (cached !== null && cached > 0) return cached;

  // Try Jupiter
  if (isJupiterConfigured()) {
    const jupPrices = await fetchJupiterPrices([SOL_MINT]);
    const jupSol = jupPrices.get(SOL_MINT);
    if (jupSol && jupSol > 0) return jupSol;
  }

  // Try Birdeye
  if (isBirdeyeConfigured()) {
    try {
      const price = await birdeyeFetchPrice(SOL_MINT);
      if (price > 0) return price;
    } catch { /* continue */ }
  }

  console.error('[pricing] Could not fetch SOL price — check JUPITER_API_KEY or BIRDEYE_API_KEY');
  return 0;
}

// ── Birdeye API ─────────────────────────────────────────────────

async function birdeyeFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.BIRDEYE_API_KEY;
  if (!key) throw new Error('BIRDEYE_API_KEY not configured');

  const url = new URL(`${BIRDEYE_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      'X-API-KEY': key,
      'x-chain': 'solana',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Birdeye API error ${res.status}: ${await res.text().catch(() => '')}`);
  }

  const json = await res.json();
  return json.data;
}

async function birdeyeFetchPrice(mint: string): Promise<number> {
  const data = await birdeyeFetch<{ value: number }>('/defi/price', { address: mint });
  const price = data?.value ?? 0;
  if (price > 0) cacheSet(priceCache, mint, price, 30_000);
  return price;
}

/**
 * Get the current USD price of a Solana token by mint address.
 */
export async function getTokenPrice(mint: string): Promise<number> {
  if (STABLECOIN_MINTS.has(mint)) return 1.0;
  if (mint === SOL_MINT) return getSolPrice();

  const cached = cacheGet(priceCache, mint);
  if (cached !== null) return cached;

  // Try Jupiter first
  if (isJupiterConfigured()) {
    const jupPrices = await fetchJupiterPrices([mint]);
    const jupPrice = jupPrices.get(mint);
    if (jupPrice && jupPrice > 0) return jupPrice;
  }

  // Try Birdeye
  if (!isBirdeyeConfigured()) return 0;

  try {
    return await birdeyeFetchPrice(mint);
  } catch (err) {
    console.warn(`[birdeye] Failed to fetch price for ${mint}:`, err);
    return 0;
  }
}

/**
 * Batch-fetch prices for multiple mints.
 * Uses Jupiter as primary (1 RPS, batches mints per call),
 * Birdeye as secondary for anything Jupiter can't price.
 */
export async function getBatchPrices(mints: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const unresolved: string[] = [];

  // Phase 1: resolve stablecoins + cached
  for (const mint of mints) {
    if (STABLECOIN_MINTS.has(mint)) {
      result.set(mint, 1.0);
    } else {
      const cached = cacheGet(priceCache, mint);
      if (cached !== null && cached > 0) {
        result.set(mint, cached);
      } else {
        unresolved.push(mint);
      }
    }
  }

  if (unresolved.length === 0) return result;

  // Phase 2: Jupiter Price API (batch — single call for all mints, respects 1 RPS)
  if (isJupiterConfigured()) {
    const jupPrices = await fetchJupiterPrices(unresolved);
    const stillUnresolved: string[] = [];
    for (const mint of unresolved) {
      const price = jupPrices.get(mint);
      if (price && price > 0) {
        result.set(mint, price);
      } else {
        stillUnresolved.push(mint);
      }
    }

    if (stillUnresolved.length === 0) return result;

    // Phase 3: Birdeye for anything Jupiter couldn't price
    if (isBirdeyeConfigured()) {
      await resolveBirdeyePrices(stillUnresolved, result);
    } else {
      for (const mint of stillUnresolved) result.set(mint, 0);
    }
  } else if (isBirdeyeConfigured()) {
    // No Jupiter key — try Birdeye for everything
    await resolveBirdeyePrices(unresolved, result);
  } else {
    // No pricing providers configured
    for (const mint of unresolved) result.set(mint, 0);
  }

  return result;
}

async function resolveBirdeyePrices(mints: string[], result: Map<string, number>): Promise<void> {
  try {
    const data = await birdeyeFetch<Record<string, { value: number }>>(
      '/defi/multi_price',
      { list_address: mints.join(',') }
    );

    for (const mint of mints) {
      const price = data?.[mint]?.value ?? 0;
      result.set(mint, price);
      if (price > 0) cacheSet(priceCache, mint, price, 30_000);
    }
  } catch {
    for (const mint of mints) {
      try {
        const price = await birdeyeFetchPrice(mint);
        result.set(mint, price);
      } catch {
        result.set(mint, 0);
      }
    }
  }
}

/**
 * Get daily OHLCV price history for a token.
 */
export async function getHistoricalPrices(mint: string, days: number): Promise<HistoricalPrice[]> {
  const cacheKey = `${mint}:${days}`;
  const cached = cacheGet(historyCache, cacheKey);
  if (cached) return cached;

  if (!isBirdeyeConfigured()) return [];

  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - days * 86400;

    const data = await birdeyeFetch<{ items: { unixTime: number; o: number; h: number; l: number; c: number; v: number }[] }>(
      '/defi/history_price',
      {
        address: mint,
        address_type: 'token',
        type: '1D',
        time_from: String(from),
        time_to: String(now),
      }
    );

    const history: HistoricalPrice[] = (data?.items ?? []).map(item => ({
      date: new Date(item.unixTime * 1000).toISOString().split('T')[0],
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v,
    }));

    const ttl = days <= 7 ? 300_000 : 3_600_000;
    cacheSet(historyCache, cacheKey, history, ttl);
    return history;
  } catch (err) {
    console.warn(`[birdeye] Failed to fetch history for ${mint}:`, err);
    return [];
  }
}

/**
 * Enrich trades with USD prices.
 *
 * For SOL-paired trades: priceUsd = solAmount x currentSolPrice
 * For stablecoin-paired: priceUsd = stablecoin amount (already set by parser)
 * For other tokens: use Jupiter/Birdeye spot prices
 *
 * Returns how many trades were successfully priced.
 */
export async function enrichTradesWithPrices(trades: import('@/types').Trade[]): Promise<{ trades: import('@/types').Trade[]; pricedCount: number; totalCount: number }> {
  if (trades.length === 0) return { trades, pricedCount: 0, totalCount: 0 };

  const mintsToPrice = new Set<string>();
  mintsToPrice.add(SOL_MINT);

  for (const t of trades) {
    if (t.priceUsd === 0) {
      if (!STABLECOIN_MINTS.has(t.tokenInMint)) mintsToPrice.add(t.tokenInMint);
      if (!STABLECOIN_MINTS.has(t.tokenOutMint)) mintsToPrice.add(t.tokenOutMint);
    }
  }

  const prices = await getBatchPrices(Array.from(mintsToPrice));
  const solPrice = prices.get(SOL_MINT) ?? 0;

  console.log(`[enrichment] SOL price: $${solPrice.toFixed(2)}, pricing ${trades.length} trades across ${mintsToPrice.size} unique mints`);

  let pricedCount = 0;

  const enriched = trades.map(t => {
    let priceUsd = t.priceUsd;

    if (priceUsd === 0) {
      const inIsSOL = t.tokenInMint === SOL_MINT;
      const outIsSOL = t.tokenOutMint === SOL_MINT;
      const inIsStable = STABLECOIN_MINTS.has(t.tokenInMint);
      const outIsStable = STABLECOIN_MINTS.has(t.tokenOutMint);

      if (inIsSOL && solPrice > 0) {
        priceUsd = t.tokenInAmount * solPrice;
      } else if (outIsSOL && solPrice > 0) {
        priceUsd = t.tokenOutAmount * solPrice;
      } else if (inIsStable) {
        priceUsd = t.tokenInAmount;
      } else if (outIsStable) {
        priceUsd = t.tokenOutAmount;
      } else {
        const inPrice = prices.get(t.tokenInMint) ?? 0;
        const outPrice = prices.get(t.tokenOutMint) ?? 0;
        if (inPrice > 0) {
          priceUsd = t.tokenInAmount * inPrice;
        } else if (outPrice > 0) {
          priceUsd = t.tokenOutAmount * outPrice;
        }
      }
    }

    if (priceUsd > 0) pricedCount++;

    return {
      ...t,
      priceUsd,
      feeUsd: solPrice > 0 ? t.feeSol * solPrice : 0,
    };
  });

  console.log(`[enrichment] Priced ${pricedCount}/${trades.length} trades`);

  return { trades: enriched, pricedCount, totalCount: trades.length };
}
