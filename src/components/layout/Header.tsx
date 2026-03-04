'use client';

/**
 * Header — Floating nav with social links. Consistent across all app pages.
 * Uses unified motion system.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import CatCompanion from '@/components/cat/CatCompanion';
import { formatAddress } from '@/lib/utils/format';
import { layoutSpring, press } from '@/lib/motion';
import { LayoutDashboard, MessageCircle, Globe, Settings, FileText, Twitter, Github } from 'lucide-react';

const NAV_ITEMS = [
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

export default function Header() {
  const pathname = usePathname();
  const wallet = useAppStore((s) => s.wallet);

  return (
    <header className="sticky top-0 z-50 w-full"
      style={{
        background: 'color-mix(in srgb, var(--bg-primary) 85%, transparent)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
      <div className="max-w-[1400px] mx-auto px-5 flex items-center justify-between h-12">
        {/* Logo + cat */}
        <Link href="/" className="flex items-center gap-2.5">
          <CatCompanion size="sm" />
          <span className="text-sm font-semibold tracking-tight text-primary">psych</span>
        </Link>

        {/* Center nav */}
        {wallet && (
          <nav className="hidden sm:flex items-center gap-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href}>
                  <motion.div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded"
                    style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }} {...press}>
                    <Icon className="w-3.5 h-3.5" strokeWidth={active ? 2.2 : 1.8} />
                    <span className="text-[11px] font-medium">{label}</span>
                    {active && (
                      <motion.div layoutId="nav-pill" className="absolute inset-0 rounded -z-10"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}
                        transition={layoutSpring} />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right: social + wallet */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-0.5">
            {SOCIAL.map(({ href, icon: Icon, label, ext }) => (
              <motion.div key={label} {...press}>
                {ext ? (
                  <a href={href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center w-7 h-7 rounded-md text-ghost" aria-label={label}>
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </a>
                ) : (
                  <Link href={href} className="flex items-center justify-center w-7 h-7 rounded-md text-ghost" aria-label={label}>
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </Link>
                )}
              </motion.div>
            ))}
          </div>

          {wallet && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-success)' }} />
              <span className="font-mono text-muted" style={{ fontSize: '0.65rem' }}>
                {wallet.solDomain ?? formatAddress(wallet.address, 4)}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

