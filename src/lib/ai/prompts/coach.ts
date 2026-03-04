/**
 * System prompts for the Trading Psychology Coach — Solana-focused.
 */

import type { BehaviorSignal, PnLSummary, TradingRule } from '@/types';

export function buildCoachSystemPrompt(context: {
  pnlSummary?: PnLSummary;
  signals?: BehaviorSignal[];
  rules?: TradingRule[];
  memoryContext?: string;
  recentTrades?: { pair: string; side: string; source: string; priceUsd: number; timestamp: number }[];
  dexBreakdown?: Record<string, number>;
}): string {
  const { pnlSummary, signals, rules, memoryContext, recentTrades, dexBreakdown } = context;

  let prompt = `You are a trading psychology coach embedded in a Solana on-chain analytics companion app. Your persona is minimal, sharp, and protective.

CONTEXT: The user's trading data comes from on-chain Solana DEX swaps (Jupiter, Raydium, Orca, Meteora, Pump.fun, etc.). You are analyzing their actual swap history, not hypotheticals.

PERSONALITY RULES:
- Short, direct sentences. No fluff.
- Never give buy/sell advice. Focus only on behavior, psychology, and risk management.
- When disciplined, give rare praise.
- When tilting or revenge trading, be stern: "Step away." "This isn't your edge speaking."
- Reference their actual on-chain data when possible.
- End responses with 1-3 actionable items.
- Never use excessive crypto slang.
- Include a SENTIMENT tag at the end: [SENTIMENT: supportive|strict|disappointed|playful|angry]

NOT FINANCIAL ADVICE: You are a behavioral coach analyzing on-chain Solana trading patterns. You do not provide investment advice.`;

  if (pnlSummary) {
    prompt += `\n\nUSER'S SOLANA TRADING STATS (${pnlSummary.window}-day window):
- Total P&L: $${pnlSummary.totalPnlUsd.toFixed(2)} (${pnlSummary.totalPnlPercent.toFixed(1)}%)
- Win Rate: ${pnlSummary.winRate.toFixed(1)}%
- Profit Factor: ${pnlSummary.profitFactor === Infinity ? '∞' : pnlSummary.profitFactor.toFixed(2)}
- Max Drawdown: ${pnlSummary.maxDrawdownPercent.toFixed(1)}%
- Avg Win: $${pnlSummary.avgWin.toFixed(2)} | Avg Loss: $${pnlSummary.avgLoss.toFixed(2)}
- Total Trades: ${pnlSummary.totalTrades} (on-chain swaps)
- Expectancy: $${pnlSummary.expectancy.toFixed(2)} per trade`;
  }

  if (signals && signals.length > 0) {
    prompt += `\n\nDETECTED BEHAVIOR PATTERNS (from on-chain swaps):`;
    for (const signal of signals) {
      prompt += `\n- [${signal.severity.toUpperCase()}] ${signal.label}: ${signal.description}`;
    }
  }

  if (rules && rules.length > 0) {
    prompt += `\n\nUSER'S TRADING RULES:`;
    for (const rule of rules) {
      prompt += `\n- ${rule.label}: ${rule.value} ${rule.unit} (${rule.enabled ? 'Active' : 'Disabled'})`;
    }
  }

  if (dexBreakdown && Object.keys(dexBreakdown).length > 0) {
    const DEX_NAMES: Record<string, string> = {
      jupiter: 'Jupiter', raydium: 'Raydium', orca: 'Orca',
      meteora: 'Meteora', pumpfun: 'Pump.fun', other: 'Other',
    };
    const entries = Object.entries(dexBreakdown).sort((a, b) => b[1] - a[1]);
    prompt += `\n\nDEX USAGE:`;
    for (const [dex, count] of entries) {
      prompt += `\n- ${DEX_NAMES[dex] ?? dex}: ${count} swaps`;
    }
  }

  if (recentTrades && recentTrades.length > 0) {
    prompt += `\n\nRECENT TRADES (last ${recentTrades.length}):`;
    for (const t of recentTrades.slice(0, 10)) {
      const ago = Math.round((Date.now() - t.timestamp) / 60000);
      const time = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
      prompt += `\n- ${t.side.toUpperCase()} ${t.pair} on ${t.source} — $${t.priceUsd.toFixed(2)} (${time})`;
    }
  }

  if (memoryContext) {
    prompt += `\n\nPREVIOUS COACHING CONTEXT:\n${memoryContext}`;
  }

  return prompt;
}

export function buildSessionSummaryPrompt(): string {
  return `Based on our conversation, provide a structured session summary in JSON:
{"actionItems":["item1","item2","item3"],"ruleUpdateSuggestions":["suggestion1"],"keyInsight":"single most important insight","catMood":"happy|disappointed|supportive|strict"}`;
}
