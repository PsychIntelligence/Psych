/**
 * PnL Calculation Engine — Solana trades.
 *
 * Computes:
 * - Realized PnL per trade (FIFO cost basis per token mint)
 * - Daily return series
 * - Aggregate statistics for any time window
 * - Equity curve with drawdown tracking
 *
 * All calculations use priceUsd which is set by the enrichment step.
 * Trades with priceUsd=0 are tracked but produce zero PnL — they don't
 * corrupt statistics because they contribute 0 to realized PnL.
 */

import type { Trade, DailyReturn, PnLSummary, TimeWindow, EquityCurvePoint } from '@/types';
import { SOL_MINT, STABLECOIN_MINTS } from '@/lib/solana/constants';

// ── Position tracker (FIFO cost basis) ──────────────────────────

interface PositionEntry {
  price: number;       // per-token price in USD
  amount: number;      // token amount
  timestamp: number;
}

interface PositionTracker {
  mint: string;
  entries: PositionEntry[];
  totalAmount: number;
  realizedPnl: number;
}

function createTracker(mint: string): PositionTracker {
  return { mint, entries: [], totalAmount: 0, realizedPnl: 0 };
}

interface TradeWithPnl extends Trade {
  realizedPnl: number;
  holdTimeMs: number;
  isWin: boolean;
  returnPercent: number;
  costBasis: number;
}

function processTradeForPnl(
  trade: Trade,
  positions: Map<string, PositionTracker>
): TradeWithPnl {
  const isPriced = trade.priceUsd > 0;

  let realizedPnl = 0;
  let holdTimeMs = 0;
  let costBasis = 0;

  if (trade.side === 'buy') {
    const mint = trade.tokenOutMint;
    if (!positions.has(mint)) positions.set(mint, createTracker(mint));
    const pos = positions.get(mint)!;

    if (isPriced && trade.tokenOutAmount > 0) {
      const perTokenPrice = trade.priceUsd / trade.tokenOutAmount;
      pos.entries.push({
        price: perTokenPrice,
        amount: trade.tokenOutAmount,
        timestamp: trade.timestamp,
      });
      pos.totalAmount += trade.tokenOutAmount;
      costBasis = trade.priceUsd;
    }
  } else {
    // Sell
    const mint = trade.tokenInMint;
    if (!positions.has(mint)) positions.set(mint, createTracker(mint));
    const pos = positions.get(mint)!;

    if (isPriced && trade.tokenInAmount > 0) {
      const sellPricePerToken = trade.priceUsd / trade.tokenInAmount;
      let remaining = trade.tokenInAmount;
      let totalCostBasis = 0;

      while (remaining > 0 && pos.entries.length > 0) {
        const entry = pos.entries[0];
        const consumed = Math.min(remaining, entry.amount);

        totalCostBasis += consumed * entry.price;
        realizedPnl += consumed * (sellPricePerToken - entry.price);
        holdTimeMs = Math.max(holdTimeMs, trade.timestamp - entry.timestamp);

        entry.amount -= consumed;
        remaining -= consumed;

        if (entry.amount <= 1e-12) pos.entries.shift();
      }

      // If we sold tokens we never tracked a buy for, the cost basis is unknown
      // but we still have a sell value — treat the sell revenue as profit from 0 cost
      if (remaining > 0 && pos.entries.length === 0) {
        realizedPnl += remaining * sellPricePerToken;
      }

      costBasis = totalCostBasis;
      pos.totalAmount = Math.max(0, pos.totalAmount - trade.tokenInAmount);
      pos.realizedPnl += realizedPnl;
    }
  }

  const netPnl = realizedPnl - trade.feeUsd;
  const returnPercent = costBasis > 0 ? (netPnl / costBasis) * 100 : 0;

  return {
    ...trade,
    realizedPnl: netPnl,
    holdTimeMs: Math.max(0, holdTimeMs),
    isWin: netPnl > 0,
    returnPercent,
    costBasis,
  };
}

// ── Daily aggregation ──────────────────────────────────────────

interface DailyAgg {
  date: string;
  trades: TradeWithPnl[];
  pnlUsd: number;
  volume: number;
  tradeCount: number;
}

function aggregateByDay(trades: TradeWithPnl[]): DailyAgg[] {
  const dayMap = new Map<string, DailyAgg>();

  for (const trade of trades) {
    const date = new Date(trade.timestamp).toISOString().split('T')[0];
    if (!dayMap.has(date)) {
      dayMap.set(date, { date, trades: [], pnlUsd: 0, volume: 0, tradeCount: 0 });
    }
    const day = dayMap.get(date)!;
    day.trades.push(trade);
    day.pnlUsd += trade.realizedPnl;
    day.volume += trade.priceUsd;
    day.tradeCount++;
  }

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Main PnL computation ───────────────────────────────────────

export function computePnL(trades: Trade[], window: TimeWindow): PnLSummary {
  const cutoff = Date.now() - window * 86400000;

  // Sort chronologically for FIFO processing
  const windowTrades = trades
    .filter(t => t.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp);

  const positions = new Map<string, PositionTracker>();
  const processed = windowTrades.map(t => processTradeForPnl(t, positions));

  // Only count sells for win/loss statistics (buys have realizedPnl=0)
  const closed = processed.filter(t => t.side === 'sell' && t.priceUsd > 0);

  const dailyAggs = aggregateByDay(processed);

  let cumPnl = 0;
  const dailyReturns: DailyReturn[] = dailyAggs.map(day => {
    cumPnl += day.pnlUsd;
    return {
      date: day.date,
      pnlUsd: day.pnlUsd,
      pnlPercent: day.volume > 0 ? (day.pnlUsd / day.volume) * 100 : 0,
      cumulativePnl: cumPnl,
      tradeCount: day.tradeCount,
      volume: day.volume,
    };
  });

  const wins = closed.filter(t => t.isWin);
  const losses = closed.filter(t => !t.isWin && t.realizedPnl !== 0);

  const totalPnl = closed.reduce((sum, t) => sum + t.realizedPnl, 0);
  const grossWins = wins.reduce((sum, t) => sum + t.realizedPnl, 0);
  const grossLosses = Math.abs(losses.reduce((sum, t) => sum + t.realizedPnl, 0));

  const totalClosed = wins.length + losses.length;
  const winRate = totalClosed > 0 ? (wins.length / totalClosed) * 100 : 0;
  const avgWin = wins.length > 0 ? grossWins / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLosses / losses.length : 0;
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;
  const expectancy = totalClosed > 0
    ? (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss
    : 0;

  // Max drawdown from cumulative PnL
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let runningPnl = 0;

  for (const day of dailyReturns) {
    runningPnl += day.pnlUsd;
    if (runningPnl > peak) peak = runningPnl;
    const dd = peak - runningPnl;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      maxDrawdownPercent = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }

  // Volatility of daily returns
  const returns = dailyReturns.filter(d => d.volume > 0).map(d => d.pnlPercent);
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const variance = returns.length > 1
    ? returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1)
    : 0;
  const volatility = Math.sqrt(variance);

  const sharpeRatio = volatility > 0 ? meanReturn / volatility : 0;

  const holdTimeTrades = closed.filter(t => t.holdTimeMs > 0);
  const avgHoldTime = holdTimeTrades.length > 0
    ? holdTimeTrades.reduce((sum, t) => sum + t.holdTimeMs, 0) / holdTimeTrades.length
    : 0;

  const totalVolume = dailyReturns.reduce((sum, d) => sum + d.volume, 0);

  return {
    window,
    totalPnlUsd: totalPnl,
    totalPnlPercent: totalVolume > 0 ? (totalPnl / totalVolume) * 100 : 0,
    winRate,
    expectancy,
    avgWin,
    avgLoss,
    profitFactor,
    maxDrawdown,
    maxDrawdownPercent,
    volatilityOfReturns: volatility,
    sharpeRatio,
    avgHoldTimeMs: avgHoldTime,
    totalTrades: totalClosed,
    winningTrades: wins.length,
    losingTrades: losses.length,
    bestTrade: closed.length > 0 ? Math.max(...closed.map(t => t.realizedPnl)) : 0,
    worstTrade: closed.length > 0 ? Math.min(...closed.map(t => t.realizedPnl)) : 0,
    dailyReturns,
  };
}

export function computeEquityCurve(trades: Trade[], initialEquity = 0): EquityCurvePoint[] {
  const sorted = [...trades]
    .filter(t => t.priceUsd > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length === 0) return [];

  const positions = new Map<string, PositionTracker>();
  let equity = initialEquity;
  let peak = equity;

  const curve: EquityCurvePoint[] = [{ timestamp: sorted[0].timestamp, equity, drawdown: 0 }];

  for (const trade of sorted) {
    const processed = processTradeForPnl(trade, positions);
    equity += processed.realizedPnl;
    if (equity > peak) peak = equity;
    const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    curve.push({ timestamp: trade.timestamp, equity, drawdown });
  }

  return curve;
}

export function computeAllWindows(trades: Trade[]): Record<TimeWindow, PnLSummary> {
  const windows: TimeWindow[] = [1, 7, 30, 90, 180, 365];
  const result = {} as Record<TimeWindow, PnLSummary>;
  for (const w of windows) {
    result[w] = computePnL(trades, w);
  }
  return result;
}
