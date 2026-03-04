'use client';

/**
 * GuardrailImpact — Shows what each guardrail would have prevented.
 * Computed from existing trade data + rule config. No new APIs.
 */

import React, { useMemo } from 'react';
import { useAppStore } from '@/stores/app-store';
import { labelTrades } from '@/lib/signals/labels';
import type { TradingRule } from '@/types';

export default function GuardrailImpact() {
  const { trades, rules } = useAppStore();

  const impacts = useMemo(() => {
    if (trades.length === 0) return [];

    const labeled = labelTrades(trades);
    const results: { rule: TradingRule; impact: string }[] = [];

    for (const rule of rules) {
      switch (rule.type) {
        case 'max_daily_loss': {
          // Count days where daily total exceeded limit
          const days = new Map<string, number>();
          for (const t of trades) {
            const day = new Date(t.timestamp).toISOString().split('T')[0];
            days.set(day, (days.get(day) ?? 0) + t.priceUsd);
          }
          const overDays = Array.from(days.values()).filter(v => v > rule.value).length;
          results.push({
            rule,
            impact: overDays > 0
              ? `Would have flagged ${overDays} day${overDays > 1 ? 's' : ''} of excess volume`
              : rule.enabled ? 'No violations detected' : 'Enable to start tracking',
          });
          break;
        }
        case 'max_trades_per_day': {
          const days = new Map<string, number>();
          for (const t of trades) {
            const day = new Date(t.timestamp).toISOString().split('T')[0];
            days.set(day, (days.get(day) ?? 0) + 1);
          }
          const overDays = Array.from(days.values()).filter(v => v > rule.value).length;
          results.push({
            rule,
            impact: overDays > 0
              ? `Would have stopped you on ${overDays} day${overDays > 1 ? 's' : ''} of overtrading`
              : rule.enabled ? 'You stayed within limits' : 'Enable to start tracking',
          });
          break;
        }
        case 'cooldown_after_loss': {
          const revenge = labeled.filter(t => t.label === 'revenge').length;
          results.push({
            rule,
            impact: revenge > 0
              ? `Would have prevented ${revenge} revenge trade${revenge > 1 ? 's' : ''}`
              : rule.enabled ? 'No revenge patterns detected' : 'Enable to start tracking',
          });
          break;
        }
        case 'max_position_size': {
          const spikes = labeled.filter(t => t.label === 'size_spike').length;
          results.push({
            rule,
            impact: spikes > 0
              ? `Would have flagged ${spikes} oversized position${spikes > 1 ? 's' : ''}`
              : rule.enabled ? 'Sizing looks consistent' : 'Enable to start tracking',
          });
          break;
        }
      }
    }

    return results;
  }, [trades, rules]);

  if (impacts.length === 0) return null;

  return (
    <div className="space-y-1.5 mt-2">
      {impacts.map(({ rule, impact }) => (
        <div key={rule.id} className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full flex-shrink-0"
            style={{ background: rule.enabled ? 'var(--success)' : 'var(--ghost)', opacity: 0.6 }} />
          <span className="text-[9px]" style={{ color: 'var(--muted)' }}>{impact}</span>
        </div>
      ))}
    </div>
  );
}
