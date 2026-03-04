/**
 * Intervention Engine — Solana trades.
 *
 * Monitors trading behavior and triggers soft interventions
 * when risk rules are broken. Delivered through the cat companion.
 */

import type { BehaviorSignal, TradingRule, Intervention, CatEmotion, Trade } from '@/types';
import { nanoid } from 'nanoid';

interface InterventionContext {
  signals: BehaviorSignal[];
  rules: TradingRule[];
  recentTrades: Trade[];
  dailyPnl: number;
  consecutiveLosses: number;
}

export function evaluateInterventions(ctx: InterventionContext): Intervention[] {
  const interventions: Intervention[] = [];

  for (const rule of ctx.rules) {
    if (!rule.enabled) continue;
    const violation = checkRuleViolation(rule, ctx);
    if (violation) interventions.push(violation);
  }

  for (const signal of ctx.signals) {
    if (signal.severity === 'critical') {
      interventions.push(signalToIntervention(signal));
    }
  }

  if (ctx.consecutiveLosses >= 3) {
    interventions.push({
      id: nanoid(), type: 'cooldown',
      trigger: `${ctx.consecutiveLosses} consecutive losses`,
      message: ctx.consecutiveLosses >= 5
        ? 'Five losses in a row. Close your charts. Come back tomorrow.'
        : 'Three losses. Take a 15-minute break.',
      catEmotion: ctx.consecutiveLosses >= 5 ? 'angry' : 'warning',
      severity: ctx.consecutiveLosses >= 5 ? 'critical' : 'warning',
      actionLabel: 'Start cooldown timer', dismissable: true, createdAt: Date.now(),
    });
  }

  if (ctx.dailyPnl < -500) {
    interventions.push({
      id: nanoid(), type: 'break_suggestion',
      trigger: `Daily loss exceeds $${Math.abs(ctx.dailyPnl).toFixed(0)}`,
      message: 'Significant daily loss. Stop swapping for today.',
      catEmotion: 'disappointed', severity: 'critical',
      actionLabel: 'End trading day', dismissable: true, createdAt: Date.now(),
    });
  }

  return interventions;
}

function checkRuleViolation(rule: TradingRule, ctx: InterventionContext): Intervention | null {
  switch (rule.type) {
    case 'max_daily_loss': {
      if (Math.abs(ctx.dailyPnl) > rule.value) {
        return {
          id: nanoid(), type: 'rule_reminder',
          trigger: `Daily loss ($${Math.abs(ctx.dailyPnl).toFixed(0)}) exceeds limit ($${rule.value})`,
          message: `You've hit your daily loss limit of $${rule.value}.`,
          catEmotion: 'angry', severity: 'critical',
          actionLabel: 'Acknowledge and stop', dismissable: true, createdAt: Date.now(),
        };
      }
      break;
    }
    case 'max_trades_per_day': {
      const today = new Date().toISOString().split('T')[0];
      const todayTrades = ctx.recentTrades.filter(t => new Date(t.timestamp).toISOString().split('T')[0] === today);
      if (todayTrades.length >= rule.value) {
        return {
          id: nanoid(), type: 'rule_reminder',
          trigger: `${todayTrades.length} swaps today (limit: ${rule.value})`,
          message: `Daily swap limit reached. More trades doesn't mean more profit.`,
          catEmotion: 'warning', severity: 'warning',
          actionLabel: 'Stop for today', dismissable: true, createdAt: Date.now(),
        };
      }
      break;
    }
    case 'cooldown_after_loss': {
      if (ctx.consecutiveLosses > 0 && ctx.recentTrades.length > 0) {
        const timeSince = Date.now() - ctx.recentTrades[0].timestamp;
        if (timeSince < rule.value * 60000) {
          const remaining = Math.ceil((rule.value * 60000 - timeSince) / 60000);
          return {
            id: nanoid(), type: 'cooldown',
            trigger: `Cooldown active (${remaining}min remaining)`,
            message: `Cooldown: ${remaining} minutes left. Journal instead.`,
            catEmotion: 'alert', severity: 'warning',
            actionLabel: `Wait ${remaining}m`, dismissable: false, createdAt: Date.now(),
          };
        }
      }
      break;
    }
    case 'max_position_size': {
      const lastTrade = ctx.recentTrades[0];
      if (lastTrade && lastTrade.priceUsd > rule.value) {
        return {
          id: nanoid(), type: 'position_warning',
          trigger: `Swap size $${lastTrade.priceUsd.toFixed(0)} exceeds limit $${rule.value}`,
          message: `Swap larger than your limit. Deliberate or impulsive?`,
          catEmotion: 'alert', severity: 'warning',
          actionLabel: 'Review position', dismissable: true, createdAt: Date.now(),
        };
      }
      break;
    }
  }
  return null;
}

function signalToIntervention(signal: BehaviorSignal): Intervention {
  const emotionMap: Record<string, CatEmotion> = {
    revenge_trading: 'angry', tilt: 'angry', overtrading: 'warning',
    risk_escalation: 'angry', position_size_spike: 'alert',
  };
  return {
    id: nanoid(), type: 'journal_prompt',
    trigger: signal.label, message: signal.description,
    catEmotion: emotionMap[signal.type] ?? 'warning',
    severity: signal.severity,
    actionLabel: 'Acknowledge', dismissable: true, createdAt: Date.now(),
  };
}

export function generateJournalPrompt(ctx: InterventionContext): string {
  if (ctx.consecutiveLosses >= 3) return 'Before your next swap: What emotion am I feeling? Is this about making money or recovering a loss?';
  if (ctx.dailyPnl > 500) return 'Good day. Write: What went right? Am I tempted to push my luck?';
  if (ctx.signals.some(s => s.type === 'revenge_trading')) return 'Pause. What triggered this impulse? Can this wait 30 minutes?';
  return 'Quick check: Rate your emotional state 1-10. Are you following your plan?';
}
