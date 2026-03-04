'use client';

/**
 * ShellLayout — THE single wrapper for all pages.
 *
 * Renders the canonical background, grain overlay, vignette,
 * and optionally the header. No page is allowed to set its own
 * body background. All pages inherit from here.
 */

import React from 'react';
import GrainOverlay from '@/components/shared/GrainOverlay';

interface ShellLayoutProps {
  children: React.ReactNode;
}

export default function ShellLayout({ children }: ShellLayoutProps) {
  return (
    <div className="shell-root relative min-h-screen">
      {/* Canonical background — set once, inherited by all pages */}
      <div className="fixed inset-0 -z-20" style={{ background: 'var(--bg-primary)' }} />

      {/* Subtle top vignette warmth — consistent across all routes */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, var(--bg-warm-glow) 0%, transparent 60%)',
        }}
      />

      {/* Grain + vignette overlay (from GrainOverlay) */}
      <GrainOverlay />

      {/* Page content */}
      {children}
    </div>
  );
}
