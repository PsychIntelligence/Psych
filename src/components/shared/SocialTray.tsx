'use client';

/**
 * SocialTray — Animated dropdown tray with social links.
 *
 * Trigger icon in top-right → tray drops down with spring animation.
 * Close on outside click + Esc.
 * Larger buttons (40px), panel-like surface.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hudSpring, press } from '@/lib/motion';
import Link from 'next/link';
import { Link2, FileText, Twitter, Github, X } from 'lucide-react';

const LINKS = [
  { href: '/docs', icon: FileText, label: 'Docs', ext: false },
  { href: 'https://x.com', icon: Twitter, label: 'X', ext: true },
  { href: 'https://github.com', icon: Github, label: 'GitHub', ext: true },
];

export default function SocialTray() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  return (
    <div ref={ref} className="fixed top-4 right-4 z-50">
      {/* Trigger */}
      <motion.button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-9 h-9 rounded"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--stroke)',
          boxShadow: 'var(--sh-surface)',
          color: open ? 'var(--text)' : 'var(--muted)',
        }}
        aria-label={open ? 'Close links' : 'Open links'}
        {...press}
      >
        {open ? <X className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
      </motion.button>

      {/* Tray */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={hudSpring}
            className="absolute top-12 right-0 flex flex-col gap-2.5 p-3"
            style={{
              background: `linear-gradient(180deg, var(--surface-hl), transparent 40%), var(--surface)`,
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--r)',
              boxShadow: 'var(--sh-inset), var(--sh-deep)',
              minWidth: 52,
            }}
          >
            {LINKS.map(({ href, icon: Icon, label, ext }) => (
              <motion.div key={label} {...press}>
                {ext ? (
                  <a href={href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center w-10 h-10 rounded"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--stroke2)', color: 'var(--text2)' }}
                    aria-label={label} title={label}>
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                  </a>
                ) : (
                  <Link href={href}
                    className="flex items-center justify-center w-10 h-10 rounded"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--stroke2)', color: 'var(--text2)' }}
                    aria-label={label} title={label}
                    onClick={close}>
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                  </Link>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


