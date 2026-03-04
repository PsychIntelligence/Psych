/**
 * Real market mood derived from SOL price data.
 *
 * Computes:
 * - SOL price + 24h change
 * - Volatility level from 24h change magnitude
 * - Market regime from price action
 * - Fear/greed index approximation from volatility + direction
 *
 * Uses Jupiter Price API (free) for SOL price.
 * Uses Birdeye for historical data when available, degrades gracefully without it.
 */

import type { MarketMood, MarketRegime } from '@/types';
import { getSolPrice, getHistoricalPrices } from './birdeye';
import { SOL_MINT } from './constants';
import { isBirdeyeConfigured } from '@/lib/utils/env';

let _moodCache: { mood: MarketMood; expiresAt: number } | null = null;

/**
 * Fetch real market mood. Returns null only if SOL price cannot be fetched.
 * Works without Birdeye — falls back to basic SOL price from Jupiter.
 */
export async function fetchMarketMood(): Promise<MarketMood | null> {
  if (_moodCache && Date.now() < _moodCache.expiresAt) {
    return _moodCache.mood;
  }

  try {
    const solPrice = await getSolPrice();
    if (solPrice === 0) return null;

    // Try to get historical data for richer analysis
    let history: { close: number }[] = [];
    if (isBirdeyeConfigured()) {
      try {
        history = await getHistoricalPrices(SOL_MINT, 7);
      } catch { /* degrade gracefully */ }
    }

    let solChange24h = 0;
    if (history.length >= 2) {
      const prev = history[history.length - 2]?.close ?? solPrice;
      solChange24h = prev > 0 ? ((solPrice - prev) / prev) * 100 : 0;
    }

    const absChange = Math.abs(solChange24h);
    const volatilityLevel = absChange > 8 ? 'extreme' as const
      : absChange > 5 ? 'high' as const
      : absChange > 2 ? 'medium' as const
      : 'low' as const;

    let regime: MarketRegime;
    if (history.length >= 3) {
      const closes = history.slice(-5).map(h => h.close);
      const trend = closes.length > 1 ? (closes[closes.length - 1] - closes[0]) / closes[0] * 100 : 0;

      if (trend > 5) regime = 'trending_up';
      else if (trend < -5) regime = 'trending_down';
      else if (absChange > 5 && solChange24h > 0) regime = 'risk_on';
      else if (absChange > 5 && solChange24h < 0) regime = 'risk_off';
      else regime = 'choppy';
    } else {
      regime = solChange24h > 2 ? 'risk_on' : solChange24h < -2 ? 'risk_off' : 'choppy';
    }

    let fearGreedIndex: number;
    if (solChange24h > 5) fearGreedIndex = 70 + Math.min(absChange * 2, 25);
    else if (solChange24h > 0) fearGreedIndex = 50 + solChange24h * 4;
    else if (solChange24h > -5) fearGreedIndex = 50 + solChange24h * 4;
    else fearGreedIndex = Math.max(5, 30 - absChange * 2);

    fearGreedIndex = Math.round(Math.max(0, Math.min(100, fearGreedIndex)));

    const narrativeSummary = buildNarrative(regime, solChange24h, volatilityLevel, solPrice);

    const mood: MarketMood = {
      regime,
      fearGreedIndex,
      volatilityLevel,
      solPrice,
      solChange24h: Math.round(solChange24h * 100) / 100,
      dominanceSol: 0,
      defiTvlSolana: 0,
      narrativeSummary,
      updatedAt: Date.now(),
    };

    _moodCache = { mood, expiresAt: Date.now() + 5 * 60_000 };
    return mood;
  } catch (err) {
    console.warn('[market] Failed to fetch market mood:', err);
    return null;
  }
}

function buildNarrative(
  regime: MarketRegime,
  change24h: number,
  volatility: string,
  price: number,
): string {
  const direction = change24h > 0 ? 'up' : change24h < 0 ? 'down' : 'flat';
  const priceStr = `$${price.toFixed(0)}`;

  switch (regime) {
    case 'trending_up':
      return `SOL trending higher at ${priceStr}, ${direction} ${Math.abs(change24h).toFixed(1)}% in 24h. Multi-day uptrend intact with ${volatility} volatility.`;
    case 'trending_down':
      return `SOL under pressure at ${priceStr}, ${direction} ${Math.abs(change24h).toFixed(1)}% in 24h. Selling pressure persists with ${volatility} volatility.`;
    case 'risk_on':
      return `Risk-on environment. SOL at ${priceStr} with positive momentum. DEX volumes likely expanding across Jupiter and Raydium.`;
    case 'risk_off':
      return `Defensive positioning on Solana. SOL at ${priceStr}, ${direction} ${Math.abs(change24h).toFixed(1)}%. Traders may be rotating to stablecoins.`;
    case 'choppy':
      return `Range-bound SOL at ${priceStr}. Low directional conviction with ${volatility} volatility. Patience may be rewarded.`;
    case 'capitulation':
      return `Heavy selling across Solana. SOL at ${priceStr} with extreme downside. Capitulation events can mark bottoms.`;
    case 'euphoria':
      return `Euphoric conditions. SOL at ${priceStr} with extended gains. Historically, extreme greed precedes corrections.`;
    default:
      return `SOL at ${priceStr}, ${direction} ${Math.abs(change24h).toFixed(1)}% in 24h.`;
  }
}
