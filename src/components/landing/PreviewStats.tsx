'use client';

/**
 * PreviewStats — "What you'll get in 30 seconds" strip.
 * 4 mini stat cards with animated counters showing example values.
 * Numbers tween from 0 to target on mount.
 */

import React, { useEffect, useRef, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { stagger, staggerItem } from '@/lib/motion';
import { Activity, AlertTriangle, Target, Layers } from 'lucide-react';

interface MiniStatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
  color: string;
}

const MiniStat = memo(function MiniStat({ icon, label, value, suffix, color }: MiniStatProps) {
  const ref = useRef<HTMLSpanElement>(null);

  const animate = useCallback(() => {
    const t0 = performance.now();
    const dur = 800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      if (ref.current) ref.current.textContent = Math.round(value * ease) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, suffix]);

  useEffect(() => { animate(); }, [animate]);

  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2.5"
      style={{ background: 'var(--surface)', border: '1px solid var(--stroke)', borderRadius: 'var(--r)' }}>
      <div style={{ color }}>{icon}</div>
      <span ref={ref} className="text-[16px] font-semibold tabular-nums" style={{ color }}>0{suffix}</span>
      <span className="text-[8px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>{label}</span>
    </div>
  );
});

const STATS = [
  { icon: <Activity className="w-3.5 h-3.5" />, label: 'Behavior Score', value: 72, suffix: '', color: 'var(--success)' },
  { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Tilt Risk', value: 28, suffix: '%', color: 'var(--warning)' },
  { icon: <Target className="w-3.5 h-3.5" />, label: 'Discipline', value: 65, suffix: '%', color: 'var(--text)' },
  { icon: <Layers className="w-3.5 h-3.5" />, label: 'DEX Footprint', value: 5, suffix: '', color: 'var(--text2)' },
];

export default function PreviewStats() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="w-full">
      <p className="text-[9px] uppercase tracking-widest font-medium text-center mb-3" style={{ color: 'var(--ghost)' }}>
        What you'll see in 30 seconds
      </p>
      <div className="grid grid-cols-4 gap-2">
        {STATS.map((s) => (
          <motion.div key={s.label} variants={staggerItem}>
            <MiniStat {...s} />
          </motion.div>
        ))}
      </div>
      <p className="text-[8px] text-center mt-2" style={{ color: 'var(--ghost)', opacity: 0.6 }}>
        Example values — paste your wallet to see real data
      </p>
    </motion.div>
  );
}
