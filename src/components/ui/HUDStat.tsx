'use client';

/**
 * HUDStat — KPI module with rAF number tween, micro bar, status glow.
 */

import React, { useEffect, useRef, memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { fastSpring } from '@/lib/motion';

interface HUDStatProps {
  label: string;
  value: number;
  format: (v: number) => string;
  icon?: React.ReactNode;
  status?: 'positive' | 'negative' | 'neutral';
  subtext?: string;
  bar?: number;
}

const COLOR = {
  positive: 'var(--success)',
  negative: 'var(--accent)',
  neutral: 'var(--text)',
};

const HUDStat = memo(function HUDStat({ label, value, format, icon, status = 'neutral', subtext, bar }: HUDStatProps) {
  const displayRef = useRef<HTMLSpanElement>(null);
  const currentRef = useRef(0);
  const rafRef = useRef(0);
  const [glowing, setGlowing] = useState(false);

  const animate = useCallback((target: number) => {
    const start = currentRef.current;
    const diff = target - start;
    if (Math.abs(diff) < 0.01) {
      currentRef.current = target;
      if (displayRef.current) displayRef.current.textContent = format(target);
      return;
    }
    const t0 = performance.now();
    const dur = 400;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      const v = start + diff * ease;
      currentRef.current = v;
      if (displayRef.current) displayRef.current.textContent = format(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else { currentRef.current = target; if (displayRef.current) displayRef.current.textContent = format(target); }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [format]);

  useEffect(() => {
    const prev = currentRef.current;
    animate(value);
    if (prev !== 0 && Math.abs(prev - value) > 0.01) {
      setGlowing(true);
      const t = setTimeout(() => setGlowing(false), 600);
      return () => clearTimeout(t);
    }
  }, [value, animate]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(180deg, var(--surface-hl), transparent 40%), var(--surface)`,
        border: '1px solid var(--stroke)',
        borderRadius: 'var(--r)',
        boxShadow: glowing
          ? `var(--sh-inset), var(--sh-surface), 0 0 20px -4px ${COLOR[status]}30`
          : 'var(--sh-inset), var(--sh-surface)',
        padding: '14px 16px',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        {icon && <span style={{ color: 'var(--muted)', fontSize: 12 }}>{icon}</span>}
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</span>
      </div>
      <span ref={displayRef} className="block text-xl font-semibold tabular-nums tracking-tight" style={{ color: COLOR[status] }}>
        {format(value)}
      </span>
      {subtext && <span className="block text-[10px] mt-1" style={{ color: 'var(--ghost)' }}>{subtext}</span>}
      {bar !== undefined && (
        <div className="mt-2.5 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--stroke)' }}>
          <motion.div className="h-full rounded-full" style={{ background: COLOR[status] }}
            initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, bar))}%` }} transition={fastSpring} />
        </div>
      )}
    </div>
  );
});

export default HUDStat;

