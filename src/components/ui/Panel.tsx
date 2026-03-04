'use client';

/**
 * Panel — Signature framed surface.
 *
 * Identity:
 *   - Double border: outer hairline + inner inset ring
 *   - Soft directional gradient (top-light)
 *   - Unified radius var(--r) matching search bar
 *   - Hover: lift 2px, brighten inner border, soft specular sweep
 *   - Optional left accent rail for status
 *   - Header inlay strip via PanelHeader sub-component
 */

import React, { memo } from 'react';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rail?: 'danger' | 'success' | 'warning' | 'none';
}

const PAD = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' } as const;

const RAIL = {
  danger: 'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  none: 'transparent',
} as const;

const Panel = memo(function Panel({
  children, className = '', hover = false, onClick, padding = 'md', rail = 'none',
}: PanelProps) {
  const interactive = hover || !!onClick;

  return (
    <div
      className={`
        relative overflow-hidden ${PAD[padding]} ${className}
        ${interactive ? 'cursor-pointer group transition-all duration-150 hover:-translate-y-[2px]' : ''}
      `}
      style={{
        background: `linear-gradient(180deg, var(--surface-hl) 0%, transparent 50%), var(--surface)`,
        border: '1px solid var(--stroke)',
        borderRadius: 'var(--r)',
        boxShadow: interactive
          ? undefined // controlled by hover state below
          : 'var(--sh-inset), var(--sh-surface)',
      }}
      // Use CSS for hover shadow transition (no JS needed)
      data-interactive={interactive ? '' : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      {/* Left accent rail */}
      {rail !== 'none' && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
          style={{ background: RAIL[rail] }} />
      )}

      {/* Specular sweep on hover */}
      {interactive && (
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.006) 45%, rgba(255,255,255,0.012) 50%, rgba(255,255,255,0.006) 55%, transparent 70%)',
          }} />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>

      <style jsx>{`
        div[data-interactive] {
          box-shadow: var(--sh-inset), var(--sh-surface);
        }
        div[data-interactive]:hover {
          box-shadow: var(--sh-inset-hover), var(--sh-lift);
        }
      `}</style>
    </div>
  );
});

export default Panel;

/* ── Header inlay strip ────────────────────────────────────── */

export function PanelHeader({
  children, className = '', actions,
}: {
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  return (
    <>
      <div className={`flex items-center justify-between pb-2.5 ${className}`}>
        <div className="flex items-center min-w-0">{children}</div>
        {actions && <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>}
      </div>
      {/* Inlay divider */}
      <div className="divider-gradient mb-3" />
    </>
  );
}

export function PanelTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon ? (
        <span style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>{icon}</span>
      ) : (
        /* Fallback dot when no icon */
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--muted)', opacity: 0.5 }} />
      )}
      <h3 className="text-[11px] font-semibold uppercase tracking-wider leading-none" style={{ color: 'var(--text)' }}>
        {children}
      </h3>
    </div>
  );
}
