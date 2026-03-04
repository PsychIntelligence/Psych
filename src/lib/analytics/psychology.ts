/**
 * Behavioral Psychology Detection Engine — Solana trades.
 *
 * Analyzes trade history for psychological patterns and biases.
 * Every detection includes evidence (specific trade IDs and metrics).
 *
 * Removed: gas_panic (EVM-specific), leverage_spike (CEX-specific).
 * Kept: all on-chain-detectable behavioral patterns.
 */

import type { Trade, BehaviorSignal, SignalType, SignalSeverity } from '@/types';
import { SOL_MINT, STABLECOIN_MINTS } from '@/lib/solana/constants';

interface TradeContext {
  trade: Trade;
  prevTrades: Trade[];
  timeSinceLast: number;
  isWin: boolean;
  pnl: number;
  consecutiveLosses: number;
  consecutiveWins: number;
  dailyTradeCount: number;
  dailyPnl: number;
}

/**
 * Compute realized PnL for a sell trade using FIFO cost basis.
 * Tracks position entries (buys) per mint and consumes them on sells.
 */
interface CostBasisEntry {
  pricePerUnit: number;
  amount: number;
}

const positionMap = new Map<string, CostBasisEntry[]>();

function resetPositionTracking() {
  positionMap.clear();
}

function computeTradePnl(trade: Trade): number {
  if (trade.priceUsd === 0) return 0;

  if (trade.side === 'buy') {
    const mint = trade.tokenOutMint;
    if (!positionMap.has(mint)) positionMap.set(mint, []);
    const entries = positionMap.get(mint)!;
    const perUnit = trade.tokenOutAmount > 0 ? trade.priceUsd / trade.tokenOutAmount : 0;
    entries.push({ pricePerUnit: perUnit, amount: trade.tokenOutAmount });
    return 0;
  }

  // Sell: consume FIFO entries for the mint being sold
  const mint = trade.tokenInMint;
  const entries = positionMap.get(mint);
  if (!entries || entries.length === 0) return 0;

  const sellPerUnit = trade.tokenInAmount > 0 ? trade.priceUsd / trade.tokenInAmount : 0;
  let remaining = trade.tokenInAmount;
  let realizedPnl = 0;

  while (remaining > 0 && entries.length > 0) {
    const entry = entries[0];
    const consumed = Math.min(remaining, entry.amount);
    realizedPnl += consumed * (sellPerUnit - entry.pricePerUnit);
    entry.amount -= consumed;
    remaining -= consumed;
    if (entry.amount <= 0) entries.shift();
  }

  return realizedPnl - trade.feeUsd;
}

type Detector = (ctx: TradeContext, allContexts: TradeContext[]) => BehaviorSignal | null;

function makeSignal(
  type: SignalType, severity: SignalSeverity, label: string,
  description: string, evidence: string[], tradeIds: string[], score: number
): BehaviorSignal {
  return { type, severity, label, description, evidence, tradeIds, score, detectedAt: Date.now() };
}

function severityRank(s: SignalSeverity): number {
  return s === 'critical' ? 3 : s === 'warning' ? 2 : 1;
}

// ── Detectors ───────────────────────────────────────────────────

function detectRevengeTrade(ctx: TradeContext): BehaviorSignal | null {
  if (ctx.consecutiveLosses < 1 || ctx.timeSinceLast > 300_000) return null;
  if (ctx.prevTrades.length === 0) return null;
  const lastTrade = ctx.prevTrades[ctx.prevTrades.length - 1];
  const currentSize = ctx.trade.priceUsd;
  const lastSize = lastTrade.priceUsd;
  const sizeIncrease = lastSize > 0 ? currentSize / lastSize : 1;
  if (sizeIncrease > 1.3 && ctx.timeSinceLast < 300_000) {
    return makeSignal('revenge_trading', 'warning', 'Revenge Trading Detected',
      'You opened a larger position within 5 minutes of a loss. This pattern suggests emotional reaction rather than disciplined entry.',
      [`Trade placed ${Math.round(ctx.timeSinceLast / 1000)}s after loss`, `Position size ${Math.round((sizeIncrease - 1) * 100)}% larger than previous`, `${ctx.consecutiveLosses} consecutive loss(es) before this trade`],
      [ctx.trade.id, lastTrade.id], Math.min(100, Math.round(sizeIncrease * 40)));
  }
  return null;
}

function detectTilt(ctx: TradeContext): BehaviorSignal | null {
  if (ctx.consecutiveLosses < 3) return null;
  return makeSignal('tilt', ctx.consecutiveLosses >= 5 ? 'critical' : 'warning', 'Tilt Warning',
    `You have ${ctx.consecutiveLosses} consecutive losses. Trading while tilted compounds losses.`,
    [`${ctx.consecutiveLosses} consecutive losing trades`, `Daily P&L: $${ctx.dailyPnl.toFixed(2)}`, `Consider taking a break before the next trade`],
    [ctx.trade.id], Math.min(100, ctx.consecutiveLosses * 20));
}

function detectFOMO(ctx: TradeContext): BehaviorSignal | null {
  if (ctx.trade.side !== 'buy') return null;
  if (ctx.prevTrades.length < 2) return null;
  const recentSells = ctx.prevTrades.filter(t => t.side === 'sell' && t.pair === ctx.trade.pair);
  if (recentSells.length === 0) return null;
  const lastSellPrice = recentSells[recentSells.length - 1].priceUsd;
  if (lastSellPrice === 0) return null;
  const priceChange = ((ctx.trade.priceUsd - lastSellPrice) / lastSellPrice) * 100;
  if (priceChange > 5) {
    return makeSignal('fomo_chasing', 'warning', 'FOMO Chase Detected',
      `You bought ${ctx.trade.pair} after a ${priceChange.toFixed(1)}% price increase. Chasing pumps often leads to buying tops.`,
      [`Price up ${priceChange.toFixed(1)}% since your last sell`, `Previous sell at $${lastSellPrice.toFixed(2)}, buying back at $${ctx.trade.priceUsd.toFixed(2)}`],
      [ctx.trade.id], Math.min(100, Math.round(priceChange * 8)));
  }
  return null;
}

function detectOvertrading(ctx: TradeContext): BehaviorSignal | null {
  if (ctx.dailyTradeCount < 10) return null;
  return makeSignal('overtrading', ctx.dailyTradeCount > 20 ? 'critical' : 'warning', 'Overtrading',
    `${ctx.dailyTradeCount} trades today. High frequency often signals impulsive behavior.`,
    [`${ctx.dailyTradeCount} trades on ${new Date(ctx.trade.timestamp).toLocaleDateString()}`, `Daily P&L: $${ctx.dailyPnl.toFixed(2)}`],
    [ctx.trade.id], Math.min(100, ctx.dailyTradeCount * 4));
}

function detectLossAversion(ctx: TradeContext, all: TradeContext[]): BehaviorSignal | null {
  const sells = all.filter(c => c.trade.side === 'sell');
  if (sells.length < 5 || ctx !== sells[sells.length - 1]) return null;
  const winAmts = sells.filter(s => s.isWin).map(s => s.pnl);
  const lossAmts = sells.filter(s => !s.isWin).map(s => Math.abs(s.pnl));
  if (winAmts.length === 0 || lossAmts.length === 0) return null;
  const avgWin = winAmts.reduce((a, b) => a + b, 0) / winAmts.length;
  const avgLoss = lossAmts.reduce((a, b) => a + b, 0) / lossAmts.length;
  if (avgLoss > avgWin * 2) {
    return makeSignal('loss_aversion', 'warning', 'Loss Aversion Pattern',
      'Your average loss is significantly larger than your average win.',
      [`Avg win: $${avgWin.toFixed(2)}`, `Avg loss: $${avgLoss.toFixed(2)}`, `Ratio: ${(avgLoss / avgWin).toFixed(1)}x`],
      sells.slice(-5).map(s => s.trade.id), Math.min(100, Math.round((avgLoss / avgWin) * 30)));
  }
  return null;
}

function detectRiskEscalation(ctx: TradeContext): BehaviorSignal | null {
  if (ctx.prevTrades.length < 3) return null;
  const recentSizes = ctx.prevTrades.slice(-3).map(t => t.priceUsd);
  const avg = recentSizes.reduce((a, b) => a + b, 0) / recentSizes.length;
  const current = ctx.trade.priceUsd;
  if (current > avg * 2.5 && ctx.consecutiveLosses > 0) {
    return makeSignal('risk_escalation', 'critical', 'Risk Escalation',
      'Position size jumped significantly after losses. Martingale behavior destroys capital.',
      [`Current position ${Math.round((current / avg) * 100)}% of recent average`, `Follows ${ctx.consecutiveLosses} loss(es)`],
      [ctx.trade.id], Math.min(100, Math.round((current / avg) * 25)));
  }
  return null;
}

function detectMeanReversionBias(ctx: TradeContext): BehaviorSignal | null {
  if (ctx.trade.side !== 'buy' || ctx.prevTrades.length < 3) return null;
  const recent = ctx.prevTrades.filter(t => t.pair === ctx.trade.pair).map(t => t.priceUsd);
  if (recent.length < 2) return null;
  const change = ((ctx.trade.priceUsd - recent[recent.length - 1]) / recent[recent.length - 1]) * 100;
  if (change < -8) {
    return makeSignal('mean_reversion_bias', 'info', 'Mean Reversion Tendency',
      'You tend to buy after significant drops.',
      [`Bought after ${Math.abs(change).toFixed(1)}% drop`],
      [ctx.trade.id], 40);
  }
  return null;
}

function detectMomentumBias(ctx: TradeContext): BehaviorSignal | null {
  if (ctx.trade.side !== 'buy' || ctx.prevTrades.length < 2) return null;
  const buys = ctx.prevTrades.filter(t => t.pair === ctx.trade.pair && t.side === 'buy');
  if (buys.length < 2) return null;
  const rising = buys.every((t, i) => i === 0 || t.priceUsd > buys[i - 1].priceUsd);
  if (rising && ctx.trade.priceUsd > buys[buys.length - 1].priceUsd) {
    return makeSignal('momentum_bias', 'info', 'Momentum Chasing',
      'Consecutive buys at increasing prices.',
      [`${buys.length + 1} buys at rising prices`],
      [ctx.trade.id], 35);
  }
  return null;
}

function detectLateEntry(ctx: TradeContext): BehaviorSignal | null {
  if (ctx.trade.side !== 'buy') return null;
  const same = ctx.prevTrades.filter(t => t.pair === ctx.trade.pair);
  if (same.length === 0 && ctx.prevTrades.length > 5) {
    return makeSignal('late_entry', 'info', 'Late Entry Syndrome',
      'First trade in this pair after extended observation period.',
      ['No prior history in this pair despite active trading elsewhere'],
      [ctx.trade.id], 30);
  }
  return null;
}

function detectPaperHands(_ctx: TradeContext, all: TradeContext[]): BehaviorSignal | null {
  const sells = all.filter(c => c.trade.side === 'sell' && c.isWin);
  if (sells.length < 3 || _ctx !== sells[sells.length - 1]) return null;
  const small = sells.filter(s => s.pnl > 0 && s.pnl < 50);
  if (small.length > sells.length * 0.7) {
    return makeSignal('paper_hands', 'warning', 'Paper Hands',
      'Most of your wins are tiny. Let winners run.',
      [`${small.length}/${sells.length} wins under $50`],
      small.slice(-3).map(s => s.trade.id), Math.min(100, Math.round((small.length / sells.length) * 80)));
  }
  return null;
}

function detectDiamondHands(_ctx: TradeContext, all: TradeContext[]): BehaviorSignal | null {
  const sells = all.filter(c => c.trade.side === 'sell');
  if (sells.length < 3 || _ctx !== sells[sells.length - 1]) return null;
  const bigLosses = sells.filter(s => s.pnl < -100);
  if (bigLosses.length > sells.filter(s => !s.isWin).length * 0.5) {
    return makeSignal('diamond_hands', 'warning', 'Stubborn Holding',
      'You hold losing positions too long.',
      [`${bigLosses.length} trades with losses over $100`],
      bigLosses.slice(-3).map(s => s.trade.id), 60);
  }
  return null;
}

function detectStopLoss(_ctx: TradeContext, all: TradeContext[]): BehaviorSignal | null {
  const losses = all.filter(c => c.trade.side === 'sell' && !c.isWin);
  if (losses.length < 3 || _ctx !== losses[losses.length - 1]) return null;
  const amounts = losses.map(l => Math.abs(l.pnl));
  const max = Math.max(...amounts);
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  if (max > avg * 3) {
    return makeSignal('stop_loss_discipline', 'warning', 'Inconsistent Stop Losses',
      'Loss sizes vary wildly.',
      [`Max loss: $${max.toFixed(2)}`, `Avg loss: $${avg.toFixed(2)}`],
      losses.slice(-3).map(l => l.trade.id), 50);
  }
  return null;
}

function detectClustering(ctx: TradeContext): BehaviorSignal | null {
  if (ctx.prevTrades.length < 5) return null;
  const times = ctx.prevTrades.slice(-5).map(t => t.timestamp);
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (avg < 120_000 && gaps.length >= 4) {
    return makeSignal('trade_clustering', 'warning', 'Trade Clustering',
      'Multiple rapid-fire trades detected.',
      [`${gaps.length + 1} trades in ${Math.round((times[times.length - 1] - times[0]) / 60000)}min`, `Avg gap: ${Math.round(avg / 1000)}s`],
      ctx.prevTrades.slice(-5).map(t => t.id), 55);
  }
  return null;
}

function detectTimeOfDay(_ctx: TradeContext, all: TradeContext[]): BehaviorSignal | null {
  if (all.length < 20 || _ctx !== all[all.length - 1]) return null;
  const hours = new Map<number, { count: number; pnl: number }>();
  for (const c of all) {
    const h = new Date(c.trade.timestamp).getHours();
    const e = hours.get(h) ?? { count: 0, pnl: 0 };
    e.count++; e.pnl += c.pnl;
    hours.set(h, e);
  }
  let worst = -1; let worstPnl = 0;
  for (const [h, d] of hours) {
    if (d.count >= 5 && d.pnl < worstPnl) { worst = h; worstPnl = d.pnl; }
  }
  if (worst >= 0 && worstPnl < -100) {
    return makeSignal('time_of_day_pattern', 'info', 'Time-of-Day Pattern',
      `Worst trading hour: ${worst}:00 UTC.`,
      [`Combined P&L at ${worst}:00: $${worstPnl.toFixed(2)}`],
      [], 35);
  }
  return null;
}

function detectWeekend(_ctx: TradeContext, all: TradeContext[]): BehaviorSignal | null {
  if (all.length < 20 || _ctx !== all[all.length - 1]) return null;
  const weekday = all.filter(c => { const d = new Date(c.trade.timestamp).getDay(); return d >= 1 && d <= 5; }).reduce((s, c) => s + c.pnl, 0);
  const weekend = all.filter(c => { const d = new Date(c.trade.timestamp).getDay(); return d === 0 || d === 6; }).reduce((s, c) => s + c.pnl, 0);
  if (weekend < -200 && weekend < weekday * -0.5) {
    return makeSignal('weekend_effect', 'info', 'Weekend Underperformance',
      'You lose more on weekends.',
      [`Weekend P&L: $${weekend.toFixed(2)}`, `Weekday P&L: $${weekday.toFixed(2)}`],
      [], 30);
  }
  return null;
}

function detectPositionSpike(ctx: TradeContext): BehaviorSignal | null {
  if (ctx.prevTrades.length < 5) return null;
  const recent = ctx.prevTrades.slice(-5).map(t => t.priceUsd);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const current = ctx.trade.priceUsd;
  if (current > avg * 3) {
    return makeSignal('position_size_spike', 'critical', 'Position Size Spike',
      `This trade is ${(current / avg).toFixed(1)}x your recent average.`,
      [`Current: $${current.toFixed(2)}`, `Recent avg: $${avg.toFixed(2)}`],
      [ctx.trade.id], Math.min(100, Math.round((current / avg) * 20)));
  }
  return null;
}

const detectors: Record<SignalType, Detector> = {
  revenge_trading: detectRevengeTrade,
  tilt: detectTilt,
  fomo_chasing: detectFOMO,
  overtrading: detectOvertrading,
  loss_aversion: detectLossAversion,
  risk_escalation: detectRiskEscalation,
  mean_reversion_bias: detectMeanReversionBias,
  momentum_bias: detectMomentumBias,
  late_entry: detectLateEntry,
  paper_hands: detectPaperHands,
  diamond_hands: detectDiamondHands,
  stop_loss_discipline: detectStopLoss,
  trade_clustering: detectClustering,
  time_of_day_pattern: detectTimeOfDay,
  weekend_effect: detectWeekend,
  position_size_spike: detectPositionSpike,
};

// ── Main ────────────────────────────────────────────────────────

export function analyzeTradesPsychology(trades: Trade[]): BehaviorSignal[] {
  if (trades.length < 3) return [];

  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
  const signals: BehaviorSignal[] = [];
  const contexts: TradeContext[] = [];

  resetPositionTracking();

  let consecutiveLosses = 0;
  let consecutiveWins = 0;
  let dailyPnl = 0;
  let dailyCount = 0;
  let currentDay = '';

  for (let i = 0; i < sorted.length; i++) {
    const trade = sorted[i];
    const prevTrades = sorted.slice(Math.max(0, i - 10), i);
    const timeSinceLast = i > 0 ? trade.timestamp - sorted[i - 1].timestamp : Infinity;
    const pnl = computeTradePnl(trade);
    const isWin = pnl > 0;

    if (trade.side === 'sell') {
      if (isWin) { consecutiveWins++; consecutiveLosses = 0; }
      else { consecutiveLosses++; consecutiveWins = 0; }
    }

    const day = new Date(trade.timestamp).toISOString().split('T')[0];
    if (day !== currentDay) { dailyPnl = 0; dailyCount = 0; currentDay = day; }
    dailyPnl += pnl; dailyCount++;

    contexts.push({ trade, prevTrades, timeSinceLast, isWin, pnl, consecutiveLosses, consecutiveWins, dailyTradeCount: dailyCount, dailyPnl });
  }

  for (const [type, detector] of Object.entries(detectors)) {
    for (const ctx of contexts) {
      const signal = detector(ctx, contexts);
      if (signal) { signal.type = type as SignalType; signals.push(signal); }
    }
  }

  const deduped = new Map<SignalType, BehaviorSignal>();
  for (const signal of signals) {
    const existing = deduped.get(signal.type);
    if (!existing || severityRank(signal.severity) > severityRank(existing.severity)) {
      deduped.set(signal.type, signal);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}
