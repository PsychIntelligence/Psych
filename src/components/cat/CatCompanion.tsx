'use client';

/**
 * CatCompanion — Expressive PNGtuber.
 *
 * Sizes:
 *   sm (56px) — dashboard CTAs, chat header during conversation
 *   md (96px) — dashboard, settings
 *   lg (140px) — legacy
 *   hero (220px) — homepage
 *   stage — FILLS CONTAINER. Used in chat Cat Stage zone.
 *           Renders at 100% of parent height, capped at 320px.
 *
 * Uses real GIF assets from /catfiles/ via CatEmotionProvider.
 * Receives overrideExpression prop for sentiment-driven switching.
 */

import React, { useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCatEmotion } from './CatEmotionProvider';
import { fastSpring } from '@/lib/motion';
import type { CatEmotion } from '@/types';

interface CatCompanionProps {
  size?: 'sm' | 'md' | 'lg' | 'hero' | 'stage';
  isTalking?: boolean;
  overrideExpression?: CatEmotion;
  className?: string;
}

const PX: Record<string, number | null> = { sm: 56, md: 96, lg: 140, hero: 220, stage: null };

/* eslint-disable @typescript-eslint/no-explicit-any */
const MOTION: Record<CatEmotion, { animate: any; transition: any }> = {
  idle:         { animate: { y: [0, -3, 0] }, transition: { y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' } } },
  neutral:      { animate: { y: [0, -2, 0] }, transition: { y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } } },
  talking:      { animate: { y: [0, -2, 0], scaleY: [1, 0.97, 1] }, transition: { duration: 0.22, repeat: Infinity, ease: 'easeInOut' } },
  angry:        { animate: { x: [-2, 2, -1, 0], rotate: [-0.5, 0.5, 0] }, transition: { duration: 0.35, repeat: 2 } },
  excited:      { animate: { y: [0, -8, 0], scale: [1, 1.06, 1] }, transition: { duration: 0.4, repeat: 3, ease: 'easeOut' } },
  disappointed: { animate: { y: 3, rotate: -2, scale: 0.97 }, transition: { duration: 1.2 } },
  alert:        { animate: { rotate: [0, 4, -4, 0], scale: [1, 1.03, 1] }, transition: { duration: 0.5 } },
  happy:        { animate: { y: [0, -4, 0], scale: [1, 1.04, 1] }, transition: { duration: 0.6, repeat: 1 } },
  sad:          { animate: { y: 4, scale: 0.96, opacity: 0.85 }, transition: { duration: 1.5 } },
  smug:         { animate: { rotate: 3, scale: 1.02, y: -1 }, transition: { duration: 0.5 } },
  warning:      { animate: { scale: [1, 1.06, 1], opacity: [1, 0.75, 1] }, transition: { duration: 0.6, repeat: 2 } },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const CatCompanion = memo(function CatCompanion({
  size = 'md', isTalking = false, overrideExpression, className = '',
}: CatCompanionProps) {
  const { state, trigger, getAsset, hasRealAssets, isLoaded } = useCatEmotion();

  const effectiveEmotion = overrideExpression ?? (isTalking ? 'talking' : state.emotion);
  const motionData = useMemo(() => MOTION[effectiveEmotion], [effectiveEmotion]);
  const asset = getAsset(effectiveEmotion);

  const imgSrc = useMemo(() => {
    if (!asset) return null;
    if (isTalking && asset.talkSrc) return asset.talkSrc;
    return asset.src;
  }, [asset, isTalking]);

  const isStage = size === 'stage';
  const px = PX[size];

  const containerStyle: React.CSSProperties = isStage
    ? { width: '100%', height: '100%', maxWidth: 320, maxHeight: 320 }
    : { width: px!, height: px! };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      onClick={() => trigger({ type: 'ui_click' })}
      style={{ cursor: 'pointer', ...(isStage ? { width: '100%', height: '100%' } : {}) }}
    >
      <motion.div
        animate={motionData.animate}
        transition={motionData.transition}
        style={containerStyle}
        className={isStage ? 'flex items-center justify-center' : ''}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={imgSrc ?? 'empty'}
            initial={{ opacity: 0.6, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={fastSpring}
            className="w-full h-full"
          >
            {hasRealAssets && imgSrc ? (
              <img
                src={imgSrc}
                alt={`Cat: ${effectiveEmotion}`}
                className="w-full h-full pixel-render object-contain"
                style={{ imageRendering: 'pixelated' }}
                draggable={false}
              />
            ) : isLoaded ? (
              <div className="w-full h-full flex items-center justify-center rounded"
                style={{ border: '1px solid var(--stroke)', opacity: 0.3 }}>
                <div className="w-3 h-3 rounded-full" style={{ background: 'var(--muted)' }} />
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
});

export default CatCompanion;

