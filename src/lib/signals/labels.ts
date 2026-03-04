/**
 * Behavioral label engine — tags each trade with a psychological label.
 *
 * Labels: discipline, chase, revenge, hesitation, overconfidence,
 *         panic_exit, fomo, routine, size_spike
 *
 * Runs over the full trade list and returns a labeled copy.
 */

import type { Trade } from '@/types';

export type BehaviorLabel =
  | 'discipline'
  | 'chase'
  | 'revenge'
  | 'hesitation'
  | 'overconfidence'
  | 'panic_exit'
  | 'fomo'
  | 'routine'
  | 'size_spike';

export interface LabeledTrade extends Trade {
  label: BehaviorLabel;
  labelReason: string;
}

/**
 * Label each trade with a behavioral tag based on context.
 */
export function labelTrades(trades: Trade[]): LabeledTrade[] {
  if (trades.length === 0) return [];

  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
  const labeled: LabeledTrade[] = [];

  let consecutiveLosses = 0;
  let lastTradeTime = 0;
  const recentSizes: number[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const gap = lastTradeTime ? t.timestamp - lastTradeTime : Infinity;
    const avgSize = recentSizes.length > 0
      ? recentSizes.reduce((a, b) => a + b, 0) / recentSizes.length
      : t.priceUsd;

    let label: BehaviorLabel = 'routine';
    let reason = 'Standard swap within normal parameters.';

    // Revenge: rapid trade (<5min) after loss, bigger size
    if (consecutiveLosses >= 1 && gap < 300_000 && t.priceUsd > avgSize * 1.3) {
      label = 'revenge';
      reason = `Traded ${Math.round(gap / 1000)}s after a loss with ${Math.round((t.priceUsd / avgSize - 1) * 100)}% larger size.`;
    }
    // Chase/FOMO: buying after price ran up (heuristic: buying, short gap, larger size)
    else if (t.side === 'buy' && gap < 600_000 && t.priceUsd > avgSize * 1.2 && i > 0) {
      label = 'chase';
      reason = 'Quick buy after recent activity with above-average size suggests chasing.';
    }
    // Panic exit: rapid sell after buy (held < 2min)
    else if (t.side === 'sell' && gap < 120_000 && i > 0 && sorted[i - 1].side === 'buy') {
      label = 'panic_exit';
      reason = `Sold ${Math.round(gap / 1000)}s after buying — panic exit.`;
    }
    // Size spike: >2.5x average
    else if (t.priceUsd > avgSize * 2.5 && recentSizes.length >= 3) {
      label = 'size_spike';
      reason = `Position ${(t.priceUsd / avgSize).toFixed(1)}x your recent average.`;
    }
    // Overconfidence: 3+ consecutive wins and size increasing
    else if (consecutiveLosses <= -3 && t.priceUsd > avgSize * 1.2) {
      label = 'overconfidence';
      reason = 'Size increasing during a win streak — overconfidence risk.';
    }
    // Hesitation: large gap (>6h) after losses
    else if (gap > 21600_000 && consecutiveLosses >= 2) {
      label = 'hesitation';
      reason = 'Long pause after losses — possible hesitation or avoidance.';
    }
    // Discipline: normal size, reasonable gap, follows rules
    else if (t.priceUsd <= avgSize * 1.2 && gap > 300_000) {
      label = 'discipline';
      reason = 'Measured entry with appropriate sizing and timing.';
    }

    labeled.push({ ...t, label, labelReason: reason });

    // Track state: approximate win/loss by comparing sell price to recent avg buy price
    if (t.side === 'sell') {
      const recentBuys = sorted.slice(Math.max(0, i - 5), i).filter(x => x.side === 'buy' && x.pair === t.pair);
      const avgBuyPrice = recentBuys.length > 0
        ? recentBuys.reduce((s, b) => s + b.priceUsd, 0) / recentBuys.length
        : t.priceUsd;
      const isLoss = t.priceUsd < avgBuyPrice;
      consecutiveLosses = isLoss ? consecutiveLosses + 1 : 0;
    }
    recentSizes.push(t.priceUsd);
    if (recentSizes.length > 5) recentSizes.shift();
    lastTradeTime = t.timestamp;
  }

  return labeled;
}

/**
 * Compute tilt score (0-100) from recent behavioral labels.
 * Higher = more tilted.
 */
export function computeTiltScore(labeled: LabeledTrade[], windowMs = 3600_000): number {
  const now = Date.now();
  const recent = labeled.filter(t => now - t.timestamp < windowMs);
  if (recent.length === 0) return 0;

  const weights: Record<BehaviorLabel, number> = {
    revenge: 30, chase: 20, panic_exit: 25, size_spike: 20,
    overconfidence: 15, fomo: 18, hesitation: 5, routine: 0, discipline: -10,
  };

  let score = 0;
  for (const t of recent) {
    score += weights[t.label] ?? 0;
  }

  return Math.min(100, Math.max(0, score));
}
