'use client';

/**
 * Divider — Gradient divider that fades at edges.
 * Optional center label with dots.
 */

import React from 'react';

interface DividerProps {
  label?: string;
  className?: string;
}

export default function Divider({ label, className = '' }: DividerProps) {
  if (label) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex-1 divider-gradient" />
        <span className="text-[9px] uppercase tracking-[0.15em] font-medium flex items-center gap-2"
          style={{ color: 'var(--ghost)' }}>
          <span className="w-1 h-1 rounded-full" style={{ background: 'var(--accent)', opacity: 0.4 }} />
          {label}
          <span className="w-1 h-1 rounded-full" style={{ background: 'var(--accent)', opacity: 0.4 }} />
        </span>
        <div className="flex-1 divider-gradient" />
      </div>
    );
  }

  return <div className={`divider-gradient ${className}`} />;
}
