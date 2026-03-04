'use client';

/**
 * InterventionOverlay — Whisper-style alert overlay.
 * Uses Panel system + unified motion.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/app-store';
import CatCompanion from '@/components/cat/CatCompanion';
import { hudSpring, press } from '@/lib/motion';
import { X } from 'lucide-react';

export default function InterventionOverlay() {
  const { interventions, dismissIntervention } = useAppStore();
  const active = interventions[0];

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={hudSpring}
          className="fixed bottom-5 right-5 z-50 max-w-sm"
        >
          <div className="p-4 rounded"
            style={{
              background: 'var(--surface)',
              border: `1px solid ${active.severity === 'critical' ? 'var(--accent-danger)' : 'var(--accent-warning)'}`,
              boxShadow: `var(--shadow-lg), 0 0 24px -4px ${active.severity === 'critical' ? 'var(--glow-danger)' : 'var(--glow-warning)'}`,
            }}>
            {active.dismissable && (
              <button onClick={() => dismissIntervention(active.id)}
                className="absolute top-3 right-3 text-ghost" aria-label="Dismiss">
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="flex gap-3">
              <CatCompanion size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted mb-1">{active.trigger}</p>
                <p className="text-[13px] text-primary font-medium leading-snug">{active.message}</p>
                {active.actionLabel && (
                  <motion.button className="mt-3 px-3 py-1.5 rounded text-[11px] font-medium"
                    style={{
                      background: active.severity === 'critical' ? 'var(--accent-danger)' : 'var(--bg-sunken)',
                      color: active.severity === 'critical' ? 'white' : 'var(--text-secondary)',
                      border: active.severity !== 'critical' ? '1px solid var(--border-subtle)' : 'none',
                    }}
                    onClick={() => dismissIntervention(active.id)} {...press}>
                    {active.actionLabel}
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

