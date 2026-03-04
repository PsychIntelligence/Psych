'use client';

/**
 * WalletSearch — Solana wallet input with spring-based micro-interactions.
 * Uses unified motion system. No per-component animation configs.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion';
import { useWalletLookup } from '@/hooks/useWalletLookup';
import { useCatEmotion } from '@/components/cat/CatEmotionProvider';
import { fastSpring, hudSpring } from '@/lib/motion';
import { Search, ArrowRight, Loader2 } from 'lucide-react';

const LOADING_STEPS = [
  'Resolving wallet...',
  'Fetching on-chain transactions...',
  'Parsing swap activity...',
  'Computing pricing data...',
  'Calculating P&L metrics...',
  'Analyzing trading behavior...',
  'Almost there...',
];

export default function WalletSearch() {
  const [address, setAddress] = useState('');
  const [focused, setFocused] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const { lookup, isLoading, error } = useWalletLookup();
  const { trigger } = useCatEmotion();
  const shakeCtrl = useAnimationControls();
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    trigger({ type: 'loading' });
    setLoadingStep(0);
    await lookup(address);
  };

  useEffect(() => {
    if (isLoading) {
      setLoadingStep(0);
      stepTimerRef.current = setInterval(() => {
        setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
      }, 2500);
    } else {
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
        stepTimerRef.current = null;
      }
    }
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [isLoading]);

  useEffect(() => {
    if (error) {
      shakeCtrl.start({ x: [0, -6, 6, -4, 4, -2, 0], transition: { duration: 0.4 } });
      trigger({ type: 'error' });
    }
  }, [error, shakeCtrl, trigger]);

  return (
    <div className="w-full max-w-[600px] mx-auto">
      <form onSubmit={handleSubmit}>
        <motion.div animate={shakeCtrl}>
          <motion.div
            animate={{
              scale: focused ? 1.012 : 1,
              boxShadow: focused
                ? '0 0 0 1px var(--accent-danger), var(--shadow-md)'
                : error
                ? '0 0 0 1px var(--accent-danger), var(--shadow-sm)'
                : '0 0 0 1px var(--border-panel), var(--shadow-sm)',
            }}
            transition={hudSpring}
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: 'var(--surface)', borderRadius: 'var(--r)' }}
          >
            <motion.div animate={{ scale: focused ? 1.1 : 1 }} transition={fastSpring}>
              <Search className="w-[18px] h-[18px] flex-shrink-0"
                strokeWidth={focused ? 2.2 : 1.8}
                style={{ color: focused ? 'var(--text-primary)' : 'var(--text-ghost)' }} />
            </motion.div>

            <input
              type="text" value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                const v = e.target.value.trim();
                if (!v) trigger({ type: 'idle' });
                else if (v.endsWith('.sol') || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) trigger({ type: 'custom', emotion: 'happy', duration: 1500 });
                else if (v.length > 3) trigger({ type: 'custom', emotion: 'alert', duration: 1000 });
              }}
              onFocus={() => { setFocused(true); trigger({ type: 'custom', emotion: 'excited', duration: 2000 }); }}
              onBlur={() => { setFocused(false); if (!address.trim()) trigger({ type: 'idle' }); }}
              placeholder="Solana wallet or .sol name"
              className="flex-1 bg-transparent text-[14px] font-mono tracking-tight
                       placeholder:font-sans placeholder:tracking-normal
                       focus:outline-none text-primary placeholder:text-ghost"
              disabled={isLoading} autoComplete="off" spellCheck={false}
            />

            <motion.button type="submit" disabled={isLoading || !address.trim()}
              whileHover={address.trim() ? { scale: 1.08 } : {}}
              whileTap={address.trim() ? { scale: 0.92 } : {}}
              transition={fastSpring}
              className="flex items-center justify-center w-9 h-9 rounded disabled:opacity-25"
              style={{
                background: address.trim() ? 'var(--text-primary)' : 'var(--bg-sunken)',
                color: address.trim() ? 'var(--text-inverse)' : 'var(--text-ghost)',
              }}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </motion.button>
          </motion.div>
        </motion.div>
      </form>

      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 px-4"
          >
            <div className="flex items-center gap-3">
              <div className="relative w-full h-1 rounded-full overflow-hidden"
                style={{ background: 'var(--stroke)' }}>
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: 'var(--accent)' }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.min(95, ((loadingStep + 1) / LOADING_STEPS.length) * 100)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>
            <motion.p
              key={loadingStep}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="text-[10px] mt-1.5 font-medium"
              style={{ color: 'var(--muted)' }}
            >
              {LOADING_STEPS[loadingStep]}
            </motion.p>
          </motion.div>
        )}

        {!isLoading && error && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={fastSpring}
            className="text-[11px] mt-2 pl-4"
            style={{ color: 'var(--accent-danger)' }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {!isLoading && (
        <p className="text-[10px] mt-2 pl-4 text-ghost">
          On-chain only — Jupiter, Raydium, Orca, Meteora, Pump.fun
        </p>
      )}
    </div>
  );
}

