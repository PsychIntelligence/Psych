'use client';

/**
 * NavLinks — Horizontal row of social/nav links for the homepage.
 * Sits above the cat as a minimal, always-visible bar.
 * Uses proper brand SVGs instead of generic Lucide placeholders.
 */

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { press } from '@/lib/motion';

/* ── Brand SVG icons (14×14 viewBox, currentColor) ─────────── */

function IconDocs({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 2a1 1 0 0 1 1-1h4l3.5 3.5V12a1 1 0 0 1-1 1h-6.5a1 1 0 0 1-1-1V2z" />
      <path d="M7 1v3.5h3.5" />
      <path d="M5 8h4M5 10.5h2.5" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="currentColor">
      <path d="M8.28 5.93L12.56 1h-1.01L7.84 5.28 4.98 1H1.5l4.49 6.53L1.5 13h1.01l3.93-4.57L9.52 13h3.48L8.28 5.93zm-1.39 1.62l-.46-.65L3.02 1.8h1.56l2.93 4.19.45.65 3.83 5.48h-1.56L6.89 7.55z" />
    </svg>
  );
}

function IconGitHub({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M7 .5C3.41.5.5 3.41.5 7c0 2.87 1.86 5.31 4.45 6.17.33.06.44-.14.44-.31v-1.1c-1.81.4-2.19-.87-2.19-.87-.3-.75-.72-.95-.72-.95-.59-.4.04-.39.04-.39.65.05 1 .67 1 .67.58.99 1.52.7 1.89.54.06-.42.23-.7.41-.87-1.45-.16-2.97-.72-2.97-3.22 0-.71.25-1.3.67-1.75-.07-.16-.29-.83.06-1.73 0 0 .55-.17 1.79.67a6.2 6.2 0 0 1 3.26 0c1.24-.84 1.79-.67 1.79-.67.35.9.13 1.57.06 1.73.42.45.67 1.04.67 1.75 0 2.51-1.53 3.06-2.98 3.22.23.2.44.6.44 1.21v1.8c0 .17.12.37.45.31A6.51 6.51 0 0 0 13.5 7C13.5 3.41 10.59.5 7 .5z" />
    </svg>
  );
}

/* ── Link definitions ──────────────────────────────────────── */

const LINKS = [
  { href: '/docs', icon: IconDocs, label: 'Docs', ext: false },
  { href: 'https://x.com', icon: IconX, label: 'X', ext: true },
  { href: 'https://github.com', icon: IconGitHub, label: 'GitHub', ext: true },
];

export default function NavLinks() {
  return (
    <nav className="flex items-center gap-2">
      {LINKS.map(({ href, icon: Icon, label, ext }) => {
        const inner = (
          <>
            <Icon className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium">{label}</span>
          </>
        );

        const style: React.CSSProperties = {
          color: 'var(--text2)',
          border: '1px solid var(--stroke2)',
          borderRadius: 'var(--r-sm)',
          background: 'var(--surface)',
        };

        if (ext) {
          return (
            <motion.a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 transition-colors hover:text-[var(--text)]"
              style={style}
              {...press}
            >
              {inner}
            </motion.a>
          );
        }

        return (
          <motion.div key={label} {...press}>
            <Link
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 transition-colors hover:text-[var(--text)]"
              style={style}
            >
              {inner}
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
}
