'use client';

/**
 * Dashboard — Signature panels, HUDStats, cat companion near insights.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import AppShell from '@/components/shell/AppShell';
import PnLChart from '@/components/charts/PnLChart';
import BehaviorSignals from '@/components/dashboard/BehaviorSignals';
import BehaviorTimeline from '@/components/dashboard/BehaviorTimeline';
import SessionStory from '@/components/dashboard/SessionStory';
import GuardrailImpact from '@/components/dashboard/GuardrailImpact';
import InterventionOverlay from '@/components/dashboard/InterventionOverlay';
import SessionWidget from '@/components/dashboard/SessionWidget';
import AchievementToast from '@/components/shared/AchievementToast';
import CatCompanion from '@/components/cat/CatCompanion';
import Panel, { PanelHeader, PanelTitle } from '@/components/ui/Panel';
import { labelTrades } from '@/lib/signals/labels';
import { checkAchievements, unlockAchievement, type Achievement } from '@/lib/signals/achievements';
import HUDStat from '@/components/ui/HUDStat';
import { useRouter } from 'next/navigation';
import { formatUsd, formatPercent, formatDuration, formatAddress } from '@/lib/utils/format';
import { stagger, staggerItem, press, hudSpring } from '@/lib/motion';
import { MessageCircle, Shield, TrendingUp, TrendingDown, Target, Activity, Clock, BarChart3 } from 'lucide-react';
import type { TradingRule } from '@/types';

function KPIGrid() {
  const { pnlWindows, activeWindow } = useAppStore();
  const p = pnlWindows[activeWindow];
  if (!p) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[84px] shimmer" style={{ border: '1px solid var(--stroke2)', borderRadius: 'var(--r)' }} />)}
    </div>
  );
  const pos = p.totalPnlUsd >= 0;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      <HUDStat label="Return" value={p.totalPnlUsd} format={v => formatUsd(v, { signed: true })}
        icon={pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        status={pos ? 'positive' : 'negative'} subtext={formatPercent(p.totalPnlPercent, { signed: true })} />
      <HUDStat label="Win Rate" value={p.winRate} format={v => formatPercent(v)}
        icon={<Target className="w-3 h-3" />} status={p.winRate >= 50 ? 'positive' : 'negative'}
        subtext={`${p.winningTrades}W / ${p.losingTrades}L`} bar={p.winRate} />
      <HUDStat label="Expectancy" value={p.expectancy} format={v => formatUsd(v, { signed: true })}
        icon={<Activity className="w-3 h-3" />} status={p.expectancy >= 0 ? 'positive' : 'negative'} />
      <HUDStat label="PF" value={p.profitFactor === Infinity ? 99 : p.profitFactor}
        format={v => v >= 99 ? '∞' : v.toFixed(2)} icon={<BarChart3 className="w-3 h-3" />}
        status={p.profitFactor >= 1.5 ? 'positive' : p.profitFactor >= 1 ? 'neutral' : 'negative'} />
      <HUDStat label="Drawdown" value={p.maxDrawdownPercent} format={v => formatPercent(v)}
        icon={<TrendingDown className="w-3 h-3" />} status={p.maxDrawdownPercent > 20 ? 'negative' : 'neutral'} />
      <HUDStat label="Avg Hold" value={p.avgHoldTimeMs} format={v => formatDuration(v)}
        icon={<Clock className="w-3 h-3" />} subtext={`${p.totalTrades} swaps`} />
    </div>
  );
}

function Rules() {
  const { rules, setRules } = useAppStore();
  return (
    <Panel>
      <PanelHeader><PanelTitle icon={<Shield className="w-3.5 h-3.5" />}>Guardrails</PanelTitle></PanelHeader>
      <div className="space-y-1.5">
        {rules.map((r: TradingRule) => (
          <div key={r.id} className="flex items-center justify-between py-1.5 px-2.5 rounded"
            style={{ background: 'var(--bg2)', border: '1px solid var(--stroke2)' }}>
            <div>
              <p className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>{r.label}</p>
              <p className="text-[9px]" style={{ color: 'var(--ghost)' }}>{r.value} {r.unit}</p>
            </div>
            <button onClick={() => setRules(rules.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x))}
              className="relative w-7 h-4 rounded-full"
              style={{ background: r.enabled ? 'var(--success)' : 'var(--stroke)', transition: 'background 0.15s' }}>
              <motion.div animate={{ x: r.enabled ? 12 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-[2px] w-3 h-3 rounded-full bg-white" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
            </button>
          </div>
        ))}
      </div>
      {/* Impact preview */}
      <GuardrailImpact />
    </Panel>
  );
}

const DEX_LABELS: Record<string, string> = {
  jupiter: 'Jupiter',
  raydium: 'Raydium',
  orca: 'Orca',
  meteora: 'Meteora',
  pumpfun: 'Pump.fun',
  other: 'Other',
};

function DexPanel() {
  const dexBreakdown = useAppStore(s => s.dexBreakdown);
  const totalTradeCount = useAppStore(s => s.totalTradeCount);
  const pricedSwapCount = useAppStore(s => s.pricedSwapCount);
  const sorted = Object.entries(dexBreakdown).sort((a, b) => b[1] - a[1]);
  const total = totalTradeCount || 1;
  return (
    <Panel>
      <PanelHeader><PanelTitle>DEX Sources</PanelTitle></PanelHeader>
      {sorted.length === 0 ? <p className="text-[10px]" style={{ color: 'var(--ghost)' }}>No swaps.</p> : (
        <div className="space-y-2">
          {sorted.map(([src, n]) => (
            <div key={src}>
              <div className="flex justify-between mb-0.5">
                <span className="text-[10px] font-medium" style={{ color: 'var(--text2)' }}>{DEX_LABELS[src] ?? src}</span>
                <span className="text-[9px] tabular-nums" style={{ color: 'var(--muted)' }}>{n}</span>
              </div>
              <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--stroke)' }}>
                <motion.div className="h-full rounded-full" style={{ background: 'var(--accent)' }}
                  initial={{ width: 0 }} animate={{ width: `${(n / total) * 100}%` }} transition={hudSpring} />
              </div>
            </div>
          ))}
          {pricedSwapCount < totalTradeCount && (
            <p className="text-[8px] pt-1" style={{ color: 'var(--ghost)' }}>
              Metrics based on {pricedSwapCount} priced swaps of {totalTradeCount} total
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const wallet = useAppStore(s => s.wallet);

  if (!wallet) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <CatCompanion size="lg" />
      <p className="text-sm" style={{ color: 'var(--muted)' }}>No wallet loaded.</p>
      <motion.button onClick={() => router.push('/')} className="px-4 py-2 rounded text-xs font-medium"
        style={{ background: 'var(--accent)', color: '#fff' }} {...press}>Go Home</motion.button>
    </div>
  );

  // Achievement checking
  const [toast, setToast] = useState<Achievement | null>(null);
  const trades = useAppStore(s => s.trades);
  const rules = useAppStore(s => s.rules);
  const activeRuleCount = rules.filter((r: TradingRule) => r.enabled).length;

  useEffect(() => {
    if (trades.length === 0) return;
    const labeled = labelTrades(trades);
    const unlocks = checkAchievements(labeled, activeRuleCount);
    for (const id of unlocks) {
      const a = unlockAchievement(id);
      if (a) { setToast(a); break; } // show first new one
    }
  }, [trades, activeRuleCount]);

  const dismissToast = useCallback(() => setToast(null), []);

  return (
    <AppShell>
      <motion.div variants={stagger} initial="hidden" animate="show"
        className="max-w-[1400px] mx-auto px-4 py-4 space-y-4">

        {/* Wallet row */}
        <motion.div variants={staggerItem} className="flex items-center gap-3">
          <span className="text-[11px] font-mono" style={{ color: 'var(--muted)' }}>{wallet.solDomain ?? formatAddress(wallet.address, 6)}</span>
          <span className="text-[9px] font-medium px-2 py-0.5 rounded-md"
            style={{ background: 'var(--surface)', border: '1px solid var(--stroke2)', color: 'var(--text2)' }}>
            {wallet.solBalance.toFixed(2)} SOL
          </span>
        </motion.div>

        <motion.div variants={staggerItem}><KPIGrid /></motion.div>

        {/* Session story */}
        <motion.div variants={staggerItem}><SessionStory /></motion.div>

        {/* Chart + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
          <motion.div variants={staggerItem}><PnLChart /></motion.div>
          <div className="flex flex-col gap-2.5">
            <motion.div variants={staggerItem}>
              <Panel hover onClick={() => router.push('/coach')}>
                <div className="flex items-center gap-3">
                  <CatCompanion size="sm" />
                  <div className="flex-1">
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--text)' }}>Talk to your coach</p>
                    <p className="text-[9px]" style={{ color: 'var(--muted)' }}>AI analyzes your swaps</p>
                  </div>
                  <MessageCircle className="w-4 h-4" style={{ color: 'var(--muted)' }} />
                </div>
              </Panel>
            </motion.div>
            <motion.div variants={staggerItem}><DexPanel /></motion.div>
          </div>
        </div>

        {/* Behavior Timeline */}
        <motion.div variants={staggerItem}><BehaviorTimeline /></motion.div>

        {/* Signals + Rules */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <motion.div variants={staggerItem}><BehaviorSignals /></motion.div>
          <motion.div variants={staggerItem}><Rules /></motion.div>
        </div>
      </motion.div>

      <SessionWidget />
      <InterventionOverlay />
      <AchievementToast achievement={toast} onDismiss={dismissToast} />
    </AppShell>
  );
}

