'use client';

/**
 * AchievementToast — Shows when a new achievement is unlocked.
 * Slides in from top-right, auto-dismisses after 4s.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hudSpring } from '@/lib/motion';
import type { Achievement } from '@/lib/signals/achievements';

interface AchievementToastProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

export default function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  useEffect(() => {
    if (!achievement) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [achievement, onDismiss]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={hudSpring}
          className="fixed top-16 right-4 z-50 flex items-center gap-3 px-4 py-3"
          style={{
            background: `linear-gradient(180deg, var(--surface-hl), transparent 40%), var(--surface)`,
            border: '1px solid var(--stroke)',
            borderRadius: 'var(--r)',
            boxShadow: 'var(--sh-deep)',
            minWidth: 240,
          }}
        >
          <span className="text-2xl">{achievement.icon}</span>
          <div>
            <p className="text-[11px] font-semibold" style={{ color: 'var(--text)' }}>{achievement.title}</p>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{achievement.description}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
