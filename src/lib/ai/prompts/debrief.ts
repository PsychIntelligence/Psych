/**
 * Debrief prompt — generates a structured behavioral review.
 */

import type { PnLSummary, BehaviorSignal, TradingRule } from '@/types';
import type { LabeledTrade } from '@/lib/signals/labels';

export function buildDebriefPrompt(context: {
  pnl?: PnLSummary;
  signals?: BehaviorSignal[];
  labeledTrades?: LabeledTrade[];
  rules?: TradingRule[];
  window?: string;
}): string {
  const { pnl, signals, labeledTrades, rules, window: timeWindow } = context;

  let prompt = `You are a trading psychology debrief analyst. Generate a structured behavioral debrief for the past ${timeWindow ?? '24 hours'}.

FORMAT YOUR RESPONSE EXACTLY AS:

**BEHAVIORAL MISTAKES** (up to 5)
- [mistake 1]
- [mistake 2]
...

**STRENGTHS** (up to 3)
- [strength 1]
...

**PLAN FOR NEXT SESSION**
[1-2 sentences]

**RULE SUGGESTIONS**
- [rule 1 to enable/adjust]
- [rule 2 to enable/adjust]

Be specific, reference actual patterns. Be stern but constructive. Not financial advice.

[SENTIMENT: strict]`;

  if (pnl) {
    prompt += `\n\nPERFORMANCE:
- P&L: $${pnl.totalPnlUsd.toFixed(2)} (${pnl.totalPnlPercent.toFixed(1)}%)
- Win Rate: ${pnl.winRate.toFixed(1)}%
- Trades: ${pnl.totalTrades}
- Max Drawdown: ${pnl.maxDrawdownPercent.toFixed(1)}%`;
  }

  if (signals && signals.length > 0) {
    prompt += `\n\nDETECTED PATTERNS:`;
    for (const s of signals.slice(0, 6)) {
      prompt += `\n- [${s.severity}] ${s.label}: ${s.description}`;
    }
  }

  if (labeledTrades && labeledTrades.length > 0) {
    const counts: Record<string, number> = {};
    for (const t of labeledTrades) counts[t.label] = (counts[t.label] ?? 0) + 1;
    prompt += `\n\nBEHAVIOR LABELS:`;
    for (const [label, count] of Object.entries(counts)) {
      prompt += `\n- ${label}: ${count} trades`;
    }
  }

  if (rules && rules.length > 0) {
    prompt += `\n\nCURRENT RULES:`;
    for (const r of rules) {
      prompt += `\n- ${r.label}: ${r.value} ${r.unit} (${r.enabled ? 'active' : 'inactive'})`;
    }
  }

  return prompt;
}
