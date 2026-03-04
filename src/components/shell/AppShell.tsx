'use client';

/**
 * AppShell — Top navigation bar. NO cat in header.
 *
 * Clean wordmark + nav links + social + wallet badge.
 * Rendered by pages that need the nav (dashboard, coach, market, settings).
 * Homepage renders its own hero layout without this.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import { formatAddress } from '@/lib/utils/format';
import { layoutSpring, press } from '@/lib/motion';
import {
  LayoutDashboard, MessageCircle, Globe, Settings,
  FileText, Twitter, Github,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/coach', label: 'Coach', icon: MessageCircle },
  { href: '/market', label: 'Market', icon: Globe },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const SOCIAL = [
  { href: '/docs', icon: FileText, label: 'Docs', ext: false },
  { href: 'https://x.com', icon: Twitter, label: 'X', ext: true },
  { href: 'https://github.com', icon: Github, label: 'GitHub', ext: true },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wallet = useAppStore((s) => s.wallet);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top bar ────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 w-full h-11 flex items-center px-5"
        style={{
          background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
          backdropFilter: 'blur(16px) saturate(1.3)',
          borderBottom: '1px solid var(--stroke2)',
        }}
      >
        {/* Wordmark — NO cat */}
        <Link href="/" className="font-serif text-xl tracking-tight" style={{ color: 'var(--text)' }}>
          psych
        </Link>

        {/* Center nav */}
        {wallet && (
          <nav className="hidden sm:flex items-center gap-0.5 ml-8">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href}>
                  <motion.div
                    className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                    style={{ color: active ? 'var(--text)' : 'var(--muted)' }}
                    {...press}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={active ? 2 : 1.6} />
                    <span className="text-[11px] font-medium">{label}</span>
                    {active && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-md -z-10"
                        style={{ background: 'var(--surface)', border: '1px solid var(--stroke2)', boxShadow: 'var(--sh-surface)' }}
                        transition={layoutSpring}
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Social links */}
        <div className="hidden md:flex items-center gap-0.5 mr-3">
          {SOCIAL.map(({ href, icon: Icon, label, ext }) => (
            <motion.div key={label} {...press}>
              {ext ? (
                <a href={href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center w-6 h-6 rounded-md"
                  style={{ color: 'var(--ghost)' }} aria-label={label}>
                  <Icon className="w-3 h-3" strokeWidth={1.4} />
                </a>
              ) : (
                <Link href={href}
                  className="flex items-center justify-center w-6 h-6 rounded-md"
                  style={{ color: 'var(--ghost)' }} aria-label={label}>
                  <Icon className="w-3 h-3" strokeWidth={1.4} />
                </Link>
              )}
            </motion.div>
          ))}
        </div>

        {/* Wallet badge */}
        {wallet && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md"
            style={{ background: 'var(--surface)', border: '1px solid var(--stroke2)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
            <span className="font-mono" style={{ fontSize: '0.6rem', color: 'var(--text2)' }}>
              {wallet.solDomain ?? formatAddress(wallet.address, 4)}
            </span>
          </div>
        )}
      </header>

      {/* ── Page content ────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}

