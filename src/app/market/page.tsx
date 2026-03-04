'use client';

/**
 * Market page — "Radar Room" for Solana crowd psychology.
 *
 * Features:
 * - Mood radar widget (real data from store)
 * - Chat for asking about market sentiment
 */

import React from 'react';
import AppShell from '@/components/shell/AppShell';
import DialogueConsole from '@/components/chat/DialogueConsole';
import Panel, { PanelHeader, PanelTitle } from '@/components/ui/Panel';
import HUDStat from '@/components/ui/HUDStat';
import { useChat } from '@/hooks/useChat';
import { useAppStore } from '@/stores/app-store';
import type { MarketMood } from '@/types';
import { TrendingUp, BarChart3, Radio } from 'lucide-react';

const QUICK = [
  "Explain today's chop",
  'Where is crowd trapped?',
  'Is this distribution?',
  'What is the market mood?',
  'Is this fear or greed?',
];

const REGIME_LABELS: Record<string, string> = {
  risk_on: 'Risk On', risk_off: 'Risk Off', choppy: 'Choppy',
  trending_up: 'Trending Up', trending_down: 'Trending Down',
  capitulation: 'Capitulation', euphoria: 'Euphoria',
};

function MarketHUD() {
  const mood = useAppStore(s => s.marketMood);

  if (!mood) return (
    <Panel padding="sm">
      <PanelHeader>
        <PanelTitle icon={<Radio className="w-3.5 h-3.5" />}>Mood Radar</PanelTitle>
      </PanelHeader>
      <p className="text-[10px] py-4 text-center" style={{ color: 'var(--ghost)' }}>
        Market mood unavailable. Search a wallet to load data.
      </p>
    </Panel>
  );

  return (
    <>
      {/* Mood Radar — circular indicator */}
      <Panel padding="sm">
        <PanelHeader>
          <PanelTitle icon={<Radio className="w-3.5 h-3.5" />}>Mood Radar</PanelTitle>
        </PanelHeader>

        {/* Quadrant visualization */}
        <div className="relative w-full aspect-square max-w-[200px] mx-auto my-2">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <line x1="100" y1="10" x2="100" y2="190" stroke="var(--stroke)" strokeWidth="1" />
            <line x1="10" y1="100" x2="190" y2="100" stroke="var(--stroke)" strokeWidth="1" />
            <text x="50" y="45" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="500">FOMO</text>
            <text x="150" y="45" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="500">EUPHORIA</text>
            <text x="50" y="165" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="500">FEAR</text>
            <text x="150" y="165" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="500">CHOP</text>
            <circle cx="100" cy="100" r="35" fill="none" stroke="var(--stroke2)" strokeWidth="1" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="var(--stroke2)" strokeWidth="1" />
            <circle
              cx={100 + (mood.fearGreedIndex - 50) * 1.5}
              cy={100 - (mood.regime.includes('up') || mood.regime === 'risk_on' ? 30 : mood.regime.includes('down') ? -30 : 0)}
              r="6"
              fill="var(--accent)"
              opacity="0.8"
            />
            <circle
              cx={100 + (mood.fearGreedIndex - 50) * 1.5}
              cy={100 - (mood.regime.includes('up') || mood.regime === 'risk_on' ? 30 : mood.regime.includes('down') ? -30 : 0)}
              r="12"
              fill="var(--accent)"
              opacity="0.15"
            />
          </svg>
        </div>

        <div className="text-center">
          <span className="text-[13px] font-semibold" style={{ color: mood.fearGreedIndex < 30 ? 'var(--accent)' : mood.fearGreedIndex > 70 ? 'var(--success)' : 'var(--warning)' }}>
            {REGIME_LABELS[mood.regime] ?? mood.regime}
          </span>
          <span className="text-[10px] ml-2 tabular-nums" style={{ color: 'var(--ghost)' }}>{mood.fearGreedIndex}/100</span>
        </div>
      </Panel>

      {/* SOL stats */}
      <Panel padding="sm">
        <PanelHeader>
          <PanelTitle icon={<TrendingUp className="w-3.5 h-3.5" />}>SOL</PanelTitle>
        </PanelHeader>
        <div className="space-y-2">
          <HUDStat label="Price" value={mood.solPrice} format={v => `$${v.toFixed(0)}`}
            status={mood.solChange24h >= 0 ? 'positive' : 'negative'}
            subtext={`${mood.solChange24h >= 0 ? '+' : ''}${mood.solChange24h.toFixed(1)}% 24h`} />
          <HUDStat label="Volatility" value={0} format={() => mood.volatilityLevel}
            icon={<BarChart3 className="w-3 h-3" />}
            status={mood.volatilityLevel === 'high' || mood.volatilityLevel === 'extreme' ? 'negative' : 'neutral'} />
        </div>
      </Panel>

      {/* Narrative */}
      {mood.narrativeSummary && (
        <Panel padding="sm">
          <PanelHeader>
            <PanelTitle>Market Narrative</PanelTitle>
          </PanelHeader>
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text2)' }}>
            {mood.narrativeSummary}
          </p>
          <p className="text-[8px] mt-2" style={{ color: 'var(--ghost)' }}>
            Based on SOL price data from Birdeye
          </p>
        </Panel>
      )}
    </>
  );
}

export default function MarketPage() {
  const { messages, send, stop, isStreaming } = useChat('market');
  return (
    <AppShell>
      <DialogueConsole mode="market" messages={messages} isStreaming={isStreaming}
        onSend={send} onStop={stop} hudPanel={<MarketHUD />} quickActions={QUICK}
        emptyHint="Ask about Solana crowd psychology, sentiment shifts, or what the market mood is." />
    </AppShell>
  );
}
