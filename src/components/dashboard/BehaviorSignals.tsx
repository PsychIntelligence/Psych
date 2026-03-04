'use client';

/**
 * BehaviorSignals — Detected psychological patterns.
 * Uses Panel system. Signals slide in, expand with spring height.
 */

import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { useCatEmotion } from '@/components/cat/CatEmotionProvider';
import Panel, { PanelHeader, PanelTitle } from '@/components/ui/Panel';
import { hudSpring, fastSpring, slideIn, press } from '@/lib/motion';
import type { BehaviorSignal, SignalSeverity } from '@/types';
import { AlertTriangle, AlertCircle, Info, ChevronDown, Brain } from 'lucide-react';

const SEV: Record<SignalSeverity, { icon: React.ReactNode; color: string; bg: string }> = {
  critical: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'var(--accent-danger)', bg: 'var(--accent-danger-soft)' },
  warning: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'var(--accent-warning)', bg: 'var(--accent-warning-soft)' },
  info: { icon: <Info className="w-3.5 h-3.5" />, color: 'var(--text-muted)', bg: 'var(--bg-sunken)' },
};

const SignalCard = memo(function SignalCard({ signal }: { signal: BehaviorSignal }) {
  const [open, setOpen] = useState(false);
  const { trigger } = useCatEmotion();
  const s = SEV[signal.severity];

  return (
    <motion.div variants={slideIn}
      className="cursor-pointer overflow-hidden"
      style={{ borderRadius: 'var(--r-sm)', background: s.bg, border: `1px solid color-mix(in srgb, ${s.color} 12%, transparent)` }}
      onClick={() => { setOpen(!open); if (!open) trigger({ type: 'behavior_signal', signal }); }}
      {...press}>
      <div className="p-3 flex items-start gap-2.5">
        <span style={{ color: s.color }} className="mt-0.5">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-primary">{signal.label}</h4>
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={fastSpring}>
              <ChevronDown className="w-3 h-3 text-ghost" />
            </motion.div>
          </div>
          <p className="text-[10px] mt-0.5 text-muted line-clamp-2">{signal.description}</p>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={hudSpring} className="overflow-hidden">
            <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid color-mix(in srgb, ${s.color} 8%, transparent)` }}>
              <p className="text-[9px] font-medium uppercase tracking-wider text-ghost mb-1">Evidence</p>
              <ul className="space-y-0.5">
                {signal.evidence.map((e, i) => (
                  <li key={i} className="text-[10px] text-secondary flex items-start gap-1.5">
                    <span style={{ color: s.color, opacity: 0.5 }}>›</span>{e}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                  <motion.div className="h-full rounded-full" style={{ background: s.color }}
                    initial={{ width: 0 }} animate={{ width: `${signal.score}%` }} transition={hudSpring} />
                </div>
                <span className="text-[9px] tabular-nums text-ghost">{signal.score}/100</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default function BehaviorSignals() {
  const { signals } = useAppStore();
  const critical = signals.filter(s => s.severity === 'critical').length;

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle icon={<Brain className="w-3.5 h-3.5" />}>Behavior Signals</PanelTitle>
        {critical > 0 && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--accent-danger-soft)', color: 'var(--accent-danger)' }}>
            {critical} critical
          </span>
        )}
      </PanelHeader>

      {signals.length === 0 ? (
        <div className="text-center py-8">
          <Brain className="w-6 h-6 mx-auto mb-2 text-ghost" style={{ opacity: 0.3 }} />
          <p className="text-[11px] text-ghost">No patterns detected yet.</p>
        </div>
      ) : (
        <motion.div initial="hidden" animate="show"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } }}
          className="space-y-2">
          {signals.map((s, i) => <SignalCard key={`${s.type}-${i}`} signal={s} />)}
        </motion.div>
      )}
    </Panel>
  );
}
