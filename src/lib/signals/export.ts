/**
 * Export Pack — one-click CSV + JSON export of trades + behavior labels.
 */

import type { Trade } from '@/types';
import type { LabeledTrade } from './labels';
import { labelTrades } from './labels';

/**
 * Export trades as CSV.
 */
export function exportTradesCSV(trades: Trade[]): string {
  const headers = ['timestamp', 'pair', 'side', 'source', 'tokenIn', 'amountIn', 'tokenOut', 'amountOut', 'priceUsd', 'feeUsd', 'signature'];
  const rows = trades.map(t => [
    new Date(t.timestamp).toISOString(),
    t.pair, t.side, t.source,
    t.tokenInSymbol, t.tokenInAmount.toFixed(6),
    t.tokenOutSymbol, t.tokenOutAmount.toFixed(6),
    t.priceUsd.toFixed(2), t.feeUsd.toFixed(4),
    t.signature,
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export behavior labels as JSON.
 */
export function exportBehaviorJSON(trades: Trade[]): string {
  const labeled = labelTrades(trades);
  return JSON.stringify(labeled.map(t => ({
    id: t.id,
    timestamp: new Date(t.timestamp).toISOString(),
    pair: t.pair,
    side: t.side,
    priceUsd: t.priceUsd,
    label: t.label,
    reason: t.labelReason,
  })), null, 2);
}

/**
 * Trigger browser download.
 */
export function downloadFile(content: string, filename: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
