'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { layoutSpring } from '@/lib/motion';

interface SegmentedControlProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

function Inner<T extends string | number>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex p-[3px] gap-[2px]"
      style={{ background: 'var(--bg2)', border: '1px solid var(--stroke2)', borderRadius: 'var(--r-sm)' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={String(o.value)} onClick={() => onChange(o.value)}
            className="relative px-2.5 py-1 text-[10px] font-medium z-10"
            style={{ color: active ? 'var(--text)' : 'var(--muted)', borderRadius: 'var(--r-xs)' }}>
            {active && (
              <motion.div layoutId="seg-pill" className="absolute inset-0 -z-10"
                style={{ background: 'var(--surface)', border: '1px solid var(--stroke)', boxShadow: 'var(--sh-surface)', borderRadius: 'var(--r-xs)' }}
                transition={layoutSpring} />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const SegmentedControl = memo(Inner) as typeof Inner;
export default SegmentedControl;
