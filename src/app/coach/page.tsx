'use client';

/**
 * Coach page — Single immersive coaching console. No tabs.
 */

import React, { useMemo } from 'react';
import AppShell from '@/components/shell/AppShell';
import DialogueConsole from '@/components/chat/DialogueConsole';
import Panel, { PanelHeader, PanelTitle } from '@/components/ui/Panel';
import HUDStat from '@/components/ui/HUDStat';
import { useChat } from '@/hooks/useChat';
import { useAppStore } from '@/stores/app-store';
import { formatPercent, formatUsd } from '@/lib/utils/format';
import { labelTrades, computeTiltScore } from '@/lib/signals/labels';
import { Shield, Activity, AlertTriangle } from 'lucide-react';
import type { TradingRule } from '@/types';

const QUICK = [
  'Analyze my worst trade',
  'Am I revenge trading?',
  'Show my tilt pattern',
  'Rate my discipline',
  'What should I improve?',
];

function CoachHUD() {
  const { pnlWindows, activeWindow, signals, rules, trades } = useAppStore();
  const pnl = pnlWindows[activeWindow];
  const crit = signals.filter(s => s.severity === 'critical').length;
  const activeRules = rules.filter((r: TradingRule) => r.enabled);

  const tiltScore = useMemo(() => {
    if (trades.length === 0) return 0;
    return computeTiltScore(labelTrades(trades));
  }, [trades]);

  return (
    <>
      <Panel padding="sm">
        <PanelHeader>
          <PanelTitle icon={<Activity className="w-3.5 h-3.5" />}>Session</PanelTitle>
        </PanelHeader>
        <div className="space-y-2">
          <HUDStat label="Win Rate" value={pnl?.winRate ?? 0} format={v => formatPercent(v)}
            status={(pnl?.winRate ?? 0) >= 50 ? 'positive' : 'negative'} bar={pnl?.winRate ?? 0} />
          <HUDStat label="Expectancy" value={pnl?.expectancy ?? 0} format={v => formatUsd(v, { signed: true })}
            status={(pnl?.expectancy ?? 0) >= 0 ? 'positive' : 'negative'} />
        </div>
      </Panel>

      <Panel padding="sm" rail={tiltScore > 50 ? 'danger' : tiltScore > 25 ? 'warning' : 'none'}>
        <PanelHeader>
          <PanelTitle icon={<AlertTriangle className="w-3.5 h-3.5" />}>Tilt Risk</PanelTitle>
        </PanelHeader>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px]" style={{ color: 'var(--text2)' }}>Score</span>
          <span className="text-[11px] font-semibold tabular-nums"
            style={{ color: tiltScore > 50 ? 'var(--accent)' : tiltScore > 25 ? 'var(--warning)' : 'var(--success)' }}>
            {tiltScore}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--stroke)' }}>
          <div className="h-full rounded-full" style={{
            width: `${tiltScore}%`,
            background: tiltScore > 50 ? 'var(--accent)' : tiltScore > 25 ? 'var(--warning)' : 'var(--success)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </Panel>

      <Panel padding="sm">
        <PanelHeader>
          <PanelTitle icon={<Shield className="w-3.5 h-3.5" />}>Active Rules</PanelTitle>
        </PanelHeader>
        <div className="space-y-1">
          {activeRules.length === 0 ? (
            <p className="text-[10px]" style={{ color: 'var(--ghost)' }}>No rules set.</p>
          ) : activeRules.map((r: TradingRule) => (
            <div key={r.id} className="flex justify-between text-[10px]">
              <span style={{ color: 'var(--text2)' }}>{r.label}</span>
              <span className="tabular-nums" style={{ color: 'var(--muted)' }}>{r.value} {r.unit}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

export default function CoachPage() {
  const { messages, send, stop, isStreaming } = useChat('coach');
  return (
    <AppShell>
      <DialogueConsole mode="coach" messages={messages} isStreaming={isStreaming}
        onSend={send} onStop={stop} hudPanel={<CoachHUD />} quickActions={QUICK}
        emptyHint="I've analyzed your swaps. Ask me about patterns, habits, or what you should work on." />
    </AppShell>
  );
}
