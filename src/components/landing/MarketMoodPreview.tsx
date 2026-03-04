'use client';

/**
 * MarketMoodPreview — Compact Solana mood gauge.
 * Shows real data from store if available, or a "search to load" prompt.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { hudSpring } from '@/lib/motion';
import { useAppStore } from '@/stores/app-store';
import { Activity } from 'lucide-react';

const REGIME: Record<string, { label: string; color: string }> = {
  risk_on: { label: 'Risk On', color: 'var(--success)' },
  risk_off: { label: 'Risk Off', color: 'var(--accent)' },
  choppy: { label: 'Choppy', color: 'var(--warning)' },
  trending_up: { label: 'Trending Up', color: 'var(--success)' },
  trending_down: { label: 'Trending Down', color: 'var(--accent)' },
  capitulation: { label: 'Capitulation', color: 'var(--accent)' },
  euphoria: { label: 'Euphoria', color: 'var(--warning)' },
};

export default function MarketMoodPreview() {
  const mood = useAppStore(s => s.marketMood);

  if (!mood) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={hudSpring}
        className="inline-flex items-center gap-3.5 px-4 py-2.5"
        style={{ background: 'var(--surface)', border: '1px solid var(--stroke)', boxShadow: 'var(--sh-surface)', borderRadius: 'var(--r)' }}>
        <Activity className="w-3 h-3" style={{ color: 'var(--muted)' }} strokeWidth={1.6} />
        <div>
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Solana Mood</span>
          <p className="text-[10px]" style={{ color: 'var(--ghost)' }}>Search a wallet to load live data</p>
        </div>
      </motion.div>
    );
  }

  const r = REGIME[mood.regime] ?? { label: 'Unknown', color: 'var(--muted)' };
  const angle = (mood.fearGreedIndex / 100) * 180 - 90;
  const gaugeColor = mood.fearGreedIndex < 30 ? 'var(--accent)' : mood.fearGreedIndex < 50 ? 'var(--warning)' : mood.fearGreedIndex < 70 ? 'var(--gold)' : 'var(--success)';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={hudSpring}
      className="inline-flex items-center gap-3.5 px-4 py-2.5"
      style={{ background: 'var(--surface)', border: '1px solid var(--stroke)', boxShadow: 'var(--sh-surface)', borderRadius: 'var(--r)' }}>

      {/* Gauge icon */}
      <div className="relative w-12 h-6 overflow-hidden">
        <svg viewBox="0 0 48 24" className="w-full h-full">
          <path d="M4 24 A20 20 0 0 1 44 24" fill="none" stroke="var(--stroke)" strokeWidth="3" />
          <path d="M4 24 A20 20 0 0 1 44 24" fill="none" strokeWidth="3" strokeLinecap="round"
            style={{ stroke: gaugeColor, strokeDasharray: '62.8', strokeDashoffset: `${62.8 * (1 - mood.fearGreedIndex / 100)}` }} />
          <motion.line x1="24" y1="24" x2="24" y2="8" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round"
            initial={{ rotate: -90 }} animate={{ rotate: angle }} transition={{ type: 'spring', stiffness: 60, damping: 12 }}
            style={{ transformOrigin: '24px 24px' }} />
        </svg>
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3" style={{ color: 'var(--muted)' }} strokeWidth={1.6} />
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>Solana Mood</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[13px] font-semibold" style={{ color: r.color }}>{r.label}</span>
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--ghost)' }}>{mood.fearGreedIndex}/100</span>
        </div>
        <div className="text-[9px] tabular-nums" style={{ color: 'var(--ghost)' }}>
          SOL ${mood.solPrice.toFixed(0)} ({mood.solChange24h >= 0 ? '+' : ''}{mood.solChange24h.toFixed(1)}%)
        </div>
      </div>
    </motion.div>
  );
}
