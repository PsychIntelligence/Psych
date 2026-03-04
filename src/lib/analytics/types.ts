/**
 * Types specific to the analytics engine.
 */

import type { Trade } from '@/types';

export interface PositionTracker {
  token: string;
  side: 'long' | 'short';
  entries: { price: number; amount: number; timestamp: number }[];
  totalAmount: number;
  avgEntryPrice: number;
  realizedPnl: number;
  fees: number;
}

export interface TradeWithPnl extends Trade {
  realizedPnl: number;
  holdTimeMs: number;
  isWin: boolean;
  returnPercent: number;
}

export interface DailyAggregation {
  date: string;
  trades: TradeWithPnl[];
  pnlUsd: number;
  volume: number;
  tradeCount: number;
}
