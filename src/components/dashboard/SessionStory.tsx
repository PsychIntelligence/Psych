'use client';

/**
 * SessionStory — Short narrative summary computed from existing stats/signals.
 * No new API. Pure client-side computation from store data.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { labelTrades, computeTiltScore } from '@/lib/signals/labels';
import Panel, { PanelHeader, PanelTitle } from '@/components/ui/Panel';
import { hudSpring, press } from '@/lib/motion';
import { BookOpen, ChevronDown } from 'lucide-react';

export default function SessionStory() {
  const { trades, pnlWindows, activeWindow, signals } = useAppStore();
  const [open, setOpen] = useState(false);

  const story = useMemo(() => {
    if (trades.length === 0) return null;

    const pnl = pnlWindows[activeWindow];
    const labeled = labelTrades(trades);
    const tilt = computeTiltScore(labeled);

    const DEX_NAMES: Record<string, string> = {
      jupiter: 'Jupiter', raydium: 'Raydium', orca: 'Orca',
      meteora: 'Meteora', pumpfun: 'Pump.fun', other: 'Other',
    };
    const sources = new Map<string, number>();
    for (const t of trades) sources.set(t.source, (sources.get(t.source) ?? 0) + 1);
    const topDexEntry = Array.from(sources.entries()).sort((a, b) => b[1] - a[1])[0];
    const topDex: [string, number] | undefined = topDexEntry
      ? [DEX_NAMES[topDexEntry[0]] ?? topDexEntry[0], topDexEntry[1]]
      : undefined;

    // Count labels
    const labels = new Map<string, number>();
    for (const t of labeled) labels.set(t.label, (labels.get(t.label) ?? 0) + 1);
    const topBehavior = Array.from(labels.entries()).sort((a, b) => b[1] - a[1])[0];

    const criticals = signals.filter(s => s.severity === 'critical').length;

    // Build narrative
    const lines: string[] = [];

    lines.push(`You made ${trades.length} swaps${topDex ? `, mostly on ${topDex[0]}` : ''}.`);

    if (pnl) {
      const dir = pnl.totalPnlUsd >= 0 ? 'positive' : 'negative';
      lines.push(`Overall P&L was ${dir}: $${pnl.totalPnlUsd.toFixed(2)} (${pnl.winRate.toFixed(0)}% win rate).`);
    }

    if (topBehavior && topBehavior[0] !== 'routine' && topBehavior[0] !== 'discipline') {
      lines.push(`Your dominant pattern was "${topBehavior[0].replace('_', ' ')}" (${topBehavior[1]} trades).`);
    } else if (topBehavior?.[0] === 'discipline') {
      lines.push(`Good news: your dominant pattern was disciplined trading (${topBehavior[1]} trades).`);
    }

    if (criticals > 0) {
      lines.push(`${criticals} critical behavior signal${criticals > 1 ? 's' : ''} detected — pay attention.`);
    }

    if (tilt > 40) {
      lines.push(`Tilt risk is elevated at ${tilt}%. Consider reducing size or taking a break.`);
    } else if (tilt < 15) {
      lines.push(`Tilt risk is low (${tilt}%). You're trading with clarity.`);
    }

    return lines;
  }, [trades, pnlWindows, activeWindow, signals]);

  if (!story) return null;

  return (
    <Panel>
      <motion.button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
        {...press}
      >
        <PanelTitle icon={<BookOpen className="w-3.5 h-3.5" />}>Session Story</PanelTitle>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
          <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={hudSpring}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-1.5">
              {story.map((line, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="text-[11px] leading-relaxed"
                  style={{ color: 'var(--text2)' }}
                >
                  {line}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
