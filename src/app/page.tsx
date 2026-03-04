'use client';

import React from 'react';
import { motion } from 'framer-motion';
import CatCompanion from '@/components/cat/CatCompanion';
import WalletSearch from '@/components/landing/WalletSearch';
import MarketMoodPreview from '@/components/landing/MarketMoodPreview';
import NavLinks from '@/components/shared/NavLinks';
import { stagger, staggerItem } from '@/lib/motion';

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Nav pinned to top */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full flex justify-center pt-4 pb-2"
      >
        <NavLinks />
      </motion.div>

      {/* Main content centered in remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-16">
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="w-full max-w-[580px] mx-auto flex flex-col items-center text-center">

          <motion.div variants={staggerItem}>
            <CatCompanion size="hero" />
          </motion.div>

          <motion.h1
            variants={staggerItem}
            className="mt-8 font-serif text-6xl sm:text-7xl tracking-tight"
            style={{ color: 'var(--text)' }}
            initial={{ letterSpacing: '0.05em', opacity: 0 }}
            animate={{ letterSpacing: '-0.02em', opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          >
            psych
          </motion.h1>

          <motion.p variants={staggerItem} className="mt-4 text-[15px] leading-relaxed max-w-sm text-balance" style={{ color: 'var(--text2)' }}>
            On-chain behavioral intelligence for Solana traders.
          </motion.p>

          <motion.div variants={staggerItem} className="mt-10 w-full">
            <WalletSearch />
          </motion.div>

          {/* Trust strip */}
          <motion.div variants={staggerItem} className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {['Public on-chain only', 'No keys ever', 'Solana-native', 'Export in 1 click'].map(t => (
              <span key={t} className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--muted)' }}>
                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--success)', opacity: 0.6 }} />
                {t}
              </span>
            ))}
          </motion.div>

          {/* Mood meter */}
          <motion.div variants={staggerItem} className="mt-8">
            <MarketMoodPreview />
          </motion.div>

          {/* Badge */}
          <motion.div variants={staggerItem} className="mt-10 text-[9px] uppercase tracking-[0.2em] font-medium flex items-center gap-2" style={{ color: 'var(--ghost)' }}>
            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }} />
            Built for Solana traders
            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }} />
          </motion.div>

          <motion.p variants={staggerItem} className="mt-3 text-[8px] max-w-xs" style={{ color: 'var(--ghost)', opacity: 0.5 }}>
            Not financial advice. On-chain behavioral analysis only.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
