'use client';

/**
 * SessionWidget — Floating bottom-right session HUD.
 *
 * When session is active:
 * - Shows elapsed time
 * - Shows tilt score with animated meter
 * - Shows "Next Best Action" prompt
 *
 * Toggle button to start/end session.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { startSession, endSession, getActiveSession, getNextAction } from '@/lib/signals/session';
import { computeTiltScore, labelTrades } from '@/lib/signals/labels';
import { useAppStore } from '@/stores/app-store';
import { hudSpring, press, fastSpring } from '@/lib/motion';
import { Play, Square, AlertTriangle, Zap } from 'lucide-react';

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${s % 60}s`;
}

export default function SessionWidget() {
  const trades = useAppStore(s => s.trades);
  const [session, setSession] = useState(getActiveSession());
  const [elapsed, setElapsed] = useState(0);
  const [tilt, setTilt] = useState(0);

  // Tick elapsed time
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - session.startedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Compute tilt from trades
  useEffect(() => {
    if (!session || trades.length === 0) return;
    const labeled = labelTrades(trades);
    setTilt(computeTiltScore(labeled));
  }, [session, trades]);

  const handleStart = useCallback(() => {
    const s = startSession();
    setSession(s);
  }, []);

  const handleEnd = useCallback(() => {
    endSession();
    setSession(null);
    setElapsed(0);
    setTilt(0);
  }, []);

  const nextAction = getNextAction(tilt);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <AnimatePresence mode="wait">
        {session ? (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={hudSpring}
            className="w-[260px] p-4"
            style={{
              background: `linear-gradient(180deg, var(--surface-hl), transparent 40%), var(--surface)`,
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--r)',
              boxShadow: 'var(--sh-deep)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
                  Session Active
                </span>
              </div>
              <span className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--muted)' }}>
                {formatElapsed(elapsed)}
              </span>
            </div>

            {/* Tilt meter */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Tilt Risk</span>
                <span className="text-[10px] font-semibold"
                  style={{ color: tilt > 50 ? 'var(--accent)' : tilt > 25 ? 'var(--warning)' : 'var(--success)' }}>
                  {tilt}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--stroke)' }}>
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${tilt}%` }}
                  transition={fastSpring}
                  style={{
                    background: tilt > 50 ? 'var(--accent)' : tilt > 25 ? 'var(--warning)' : 'var(--success)',
                  }}
                />
              </div>
            </div>

            {/* Next action */}
            <div className="flex items-start gap-2 p-2.5 mb-3"
              style={{
                background: nextAction.urgency === 'high' ? 'var(--accent-soft)' : 'var(--surface2)',
                borderRadius: 'var(--r-xs)',
                border: `1px solid ${nextAction.urgency === 'high' ? 'rgba(231,76,60,0.15)' : 'var(--stroke2)'}`,
              }}>
              {nextAction.urgency === 'high' ? (
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
              ) : (
                <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--muted)' }} />
              )}
              <span className="text-[11px] leading-relaxed" style={{ color: 'var(--text)' }}>
                {nextAction.action}
              </span>
            </div>

            {/* End button */}
            <motion.button
              onClick={handleEnd}
              className="w-full flex items-center justify-center gap-2 py-2 text-[11px] font-medium"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--r-xs)',
                color: 'var(--text2)',
              }}
              {...press}
            >
              <Square className="w-3 h-3" /> End Session
            </motion.button>
          </motion.div>
        ) : (
          <motion.button
            key="start"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={hudSpring}
            onClick={handleStart}
            className="flex items-center gap-2 px-4 py-2.5"
            style={{
              background: `linear-gradient(180deg, var(--surface-hl), transparent 40%), var(--surface)`,
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--r)',
              boxShadow: 'var(--sh-surface)',
              color: 'var(--text)',
            }}
            {...press}
          >
            <Play className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
            <span className="text-[11px] font-medium">Start Session</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
