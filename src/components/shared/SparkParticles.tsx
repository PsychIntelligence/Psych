'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface SparkParticlesProps {
  active: boolean;
  color?: string;
  count?: number;
}

export default function SparkParticles({ active, color = '#f1c40f', count = 6 }: SparkParticlesProps) {
  const reduced = useReducedMotion();

  if (reduced || !active) return null;

  return (
    <AnimatePresence>
      {active && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: count }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: color,
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
              }}
              initial={{ opacity: 0, scale: 0, y: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
                y: [0, -20 - Math.random() * 30],
                x: [(Math.random() - 0.5) * 20],
              }}
              transition={{
                duration: 0.6 + Math.random() * 0.4,
                delay: i * 0.08,
                ease: 'easeOut',
              }}
              exit={{ opacity: 0 }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
