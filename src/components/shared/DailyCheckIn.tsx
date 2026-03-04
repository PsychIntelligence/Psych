'use client';

/**
 * DailyCheckIn — "How are you feeling?" (1-5 scale).
 * Shows once per day at top of dashboard.
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { saveCheckIn, loadCheckIns, getStreakDays } from '@/lib/signals/achievements';
import { press, hudSpring } from '@/lib/motion';

const MOODS = [
  { value: 1, emoji: '😰', label: 'Tilted' },
  { value: 2, emoji: '😐', label: 'Tense' },
  { value: 3, emoji: '😌', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Focused' },
  { value: 5, emoji: '💪', label: 'Sharp' },
];

export default function DailyCheckIn() {
  const today = new Date().toISOString().split('T')[0];
  const checkins = loadCheckIns();
  const alreadyDone = checkins.some(c => c.date === today);
  const [done, setDone] = useState(alreadyDone);
  const [selected, setSelected] = useState<number | null>(null);
  const streak = getStreakDays();

  const handleSelect = useCallback((mood: number) => {
    saveCheckIn(mood);
    setSelected(mood);
    setDone(true);
  }, []);

  if (done) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--stroke2)',
          borderRadius: 'var(--r)',
        }}>
        <span className="text-lg">{selected ? MOODS.find(m => m.value === selected)?.emoji : '✅'}</span>
        <div>
          <span className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>Checked in today</span>
          {streak > 1 && (
            <span className="text-[10px] ml-2" style={{ color: 'var(--accent)' }}>🔥 {streak} day streak</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={hudSpring}
      className="flex items-center gap-4 px-4 py-3"
      style={{
        background: `linear-gradient(180deg, var(--surface-hl), transparent 50%), var(--surface)`,
        border: '1px solid var(--stroke)',
        borderRadius: 'var(--r)',
        boxShadow: 'var(--sh-inset), var(--sh-surface)',
      }}
    >
      <span className="text-[12px] font-medium" style={{ color: 'var(--text2)' }}>How are you feeling?</span>
      <div className="flex gap-1.5">
        {MOODS.map(({ value, emoji, label }) => (
          <motion.button
            key={value}
            onClick={() => handleSelect(value)}
            className="flex flex-col items-center gap-0.5 px-2 py-1"
            style={{ borderRadius: 'var(--r-xs)', color: 'var(--text)' }}
            title={label}
            {...press}
          >
            <span className="text-lg">{emoji}</span>
            <span className="text-[8px]" style={{ color: 'var(--ghost)' }}>{label}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
