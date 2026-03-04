'use client';

/**
 * BehaviorTimeline — Scrollable list of recent trades with behavioral labels.
 * Each trade is tagged: discipline / chase / revenge / panic_exit / etc.
 * Clicking opens a replay narration.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { labelTrades, type LabeledTrade, type BehaviorLabel } from '@/lib/signals/labels';
import Panel, { PanelHeader, PanelTitle } from '@/components/ui/Panel';
import { hudSpring, press } from '@/lib/motion';
import { Clock, ChevronRight, X } from 'lucide-react';

const LABEL_COLORS: Record<BehaviorLabel, string> = {
  discipline: 'var(--success)',
  chase: 'var(--warning)',
  revenge: 'var(--accent)',
  hesitation: 'var(--muted)',
  overconfidence: 'var(--warning)',
  panic_exit: 'var(--accent)',
  fomo: 'var(--warning)',
  routine: 'var(--ghost)',
  size_spike: 'var(--accent)',
};

const DEX_DISPLAY: Record<string, string> = {
  jupiter: 'Jupiter',
  raydium: 'Raydium',
  orca: 'Orca',
  meteora: 'Meteora',
  pumpfun: 'Pump.fun',
  other: 'Other',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BehaviorTimeline() {
  const trades = useAppStore(s => s.trades);
  const [selected, setSelected] = useState<LabeledTrade | null>(null);

  const labeled = useMemo(() => {
    return labelTrades(trades).sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  }, [trades]);

  if (trades.length === 0) return null;

  return (
    <>
      <Panel>
        <PanelHeader>
          <PanelTitle icon={<Clock className="w-3.5 h-3.5" />}>Behavior Timeline</PanelTitle>
        </PanelHeader>

        <div className="space-y-1 max-h-[280px] overflow-y-auto custom-scroll">
          {labeled.map((t) => (
            <motion.div
              key={t.id}
              className="flex items-center gap-3 py-2 px-2.5 cursor-pointer"
              style={{ borderRadius: 'var(--r-xs)' }}
              onClick={() => setSelected(t)}
              whileHover={{ background: 'var(--surface2)', scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Label dot */}
              <div className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: LABEL_COLORS[t.label] }} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium capitalize"
                    style={{ color: LABEL_COLORS[t.label] }}>
                    {t.label.replace('_', ' ')}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--ghost)' }}>
                    {t.pair}
                  </span>
                </div>
                <span className="text-[9px]" style={{ color: 'var(--ghost)' }}>
                  {formatDate(t.timestamp)} {formatTime(t.timestamp)} · {DEX_DISPLAY[t.source] ?? t.source}
                </span>
              </div>

              {/* Amount */}
              <span className="text-[10px] tabular-nums font-medium flex-shrink-0"
                style={{ color: t.side === 'buy' ? 'var(--success)' : 'var(--accent)' }}>
                ${t.priceUsd.toFixed(0)}
              </span>

              <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--ghost)' }} />
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* Replay drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={hudSpring}
            className="fixed top-16 right-4 bottom-4 w-[320px] z-50 overflow-y-auto custom-scroll"
            style={{
              background: `linear-gradient(180deg, var(--surface-hl), transparent 40%), var(--surface)`,
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--r)',
              boxShadow: 'var(--sh-deep)',
              padding: 20,
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: LABEL_COLORS[selected.label] }}>
                {selected.label.replace('_', ' ')}
              </span>
              <motion.button onClick={() => setSelected(null)} {...press}>
                <X className="w-4 h-4" style={{ color: 'var(--muted)' }} />
              </motion.button>
            </div>

            {/* Trade details */}
            <div className="space-y-3 text-[12px]" style={{ color: 'var(--text2)' }}>
              <div className="flex justify-between">
                <span>Pair</span>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{selected.pair}</span>
              </div>
              <div className="flex justify-between">
                <span>Side</span>
                <span className="font-medium capitalize" style={{ color: selected.side === 'buy' ? 'var(--success)' : 'var(--accent)' }}>
                  {selected.side}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Amount</span>
                <span className="font-mono" style={{ color: 'var(--text)' }}>${selected.priceUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>DEX</span>
                <span style={{ color: 'var(--text)' }}>{DEX_DISPLAY[selected.source] ?? selected.source}</span>
              </div>
              <div className="flex justify-between">
                <span>Time</span>
                <span style={{ color: 'var(--text)' }}>{formatDate(selected.timestamp)} {formatTime(selected.timestamp)}</span>
              </div>

              <div className="divider-gradient my-3" />

              <div>
                <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>
                  Behavioral narration
                </span>
                <p className="mt-2 text-[12px] leading-relaxed" style={{ color: 'var(--text)' }}>
                  {selected.labelReason}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
