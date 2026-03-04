'use client';

/**
 * CatAvatar — Renders REAL PNGtuber GIF assets from /catfiles/.
 *
 * When the cat is "talking", it swaps to the Talk variant of the current
 * emotion (e.g., BlackCat_Idle1Talk_ghremlin.gif while idle + talking).
 *
 * Placeholder only shows when truly zero renderable assets exist.
 * Includes a dev-only Asset Inspector toggle.
 *
 * All animations use the unified motion system (spring configs).
 * GIFs rendered with image-rendering: pixelated for pixel integrity.
 */

import React, { useMemo, memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCatEmotion } from './CatEmotionProvider';
import { fastSpring, hudSpring, slowSpring } from '@/lib/motion';
import type { CatEmotion } from '@/types';

interface CatAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  className?: string;
  showMessage?: boolean;
  interactive?: boolean;
  showInspector?: boolean;
}

const SIZE_MAP = {
  sm: 40,
  md: 64,
  lg: 96,
  xl: 128,
  hero: 200,
} as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
const EMOTION_MOTION: Record<CatEmotion, { animate: any; transition: any }> = {
  idle: {
    animate: { y: [0, -2, 0], rotate: 0, scale: 1 },
    transition: { y: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' } },
  },
  neutral: {
    animate: { y: [0, -1, 0], rotate: 0, scale: 1 },
    transition: { y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } },
  },
  talking: {
    animate: { y: [0, -2, 0], scaleY: [1, 0.97, 1] },
    transition: { duration: 0.25, repeat: Infinity, ease: 'easeInOut' },
  },
  angry: {
    animate: { x: [-2, 2, -1, 1, 0], rotate: [-0.5, 0.5, -0.3, 0], scale: 1.02 },
    transition: { duration: 0.35, repeat: 2 },
  },
  excited: {
    animate: { y: [0, -8, 0], scale: [1, 1.06, 1], rotate: [0, 1, -1, 0] },
    transition: { duration: 0.4, repeat: 3, ease: 'easeOut' },
  },
  disappointed: {
    animate: { y: 3, rotate: -2, scale: 0.97 },
    transition: { duration: 1.2, ease: 'easeInOut' },
  },
  alert: {
    animate: { rotate: [0, 4, -4, 2, 0], scale: [1, 1.03, 1] },
    transition: { duration: 0.5 },
  },
  happy: {
    animate: { y: [0, -4, 0], scale: [1, 1.04, 1] },
    transition: { duration: 0.6, repeat: 1, ease: 'easeOut' },
  },
  sad: {
    animate: { y: 4, scale: 0.96, opacity: 0.85 },
    transition: { duration: 1.5, ease: 'easeInOut' },
  },
  smug: {
    animate: { rotate: 3, scale: 1.02, y: -1 },
    transition: { duration: 0.5 },
  },
  warning: {
    animate: { scale: [1, 1.06, 1], opacity: [1, 0.75, 1] },
    transition: { duration: 0.6, repeat: 2, ease: 'easeInOut' },
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Placeholder — only when truly no renderable assets found.
 */
const Placeholder = memo(function Placeholder({ size }: { size: number }) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded border-2"
        style={{ borderColor: 'var(--border-default)', opacity: 0.3 }}
      />
      <motion.div
        className="rounded-full"
        style={{
          width: Math.max(6, size * 0.1),
          height: Math.max(6, size * 0.1),
          background: 'var(--text-muted)',
        }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {size >= 96 && (
        <span
          className="absolute bottom-2 text-center w-full"
          style={{ fontSize: '0.5rem', color: 'var(--text-ghost)' }}
        >
          no assets in /catfiles/
        </span>
      )}
    </div>
  );
});

/**
 * Dev-only Asset Inspector panel — toggled with a small button.
 */
function AssetInspector() {
  const { assetMap, state, reloadAssets } = useCatEmotion();
  const [open, setOpen] = useState(false);

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="absolute top-0 left-full ml-2 z-50" style={{ minWidth: 220 }}>
      <button
        onClick={() => setOpen(!open)}
        className="text-[9px] px-1.5 py-0.5 rounded"
        style={{
          background: 'var(--bg-overlay)',
          color: 'var(--text-ghost)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {open ? '✕' : '🐱'}
      </button>

      {open && assetMap && (
        <div
          className="mt-1 p-2 rounded text-[9px] space-y-1 max-h-64 overflow-auto custom-scroll"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{ color: 'var(--text-muted)' }}>
            <strong>State:</strong> {state.emotion} (i={state.intensity.toFixed(2)})
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            <strong>Assets:</strong> {assetMap.loadedCount} loaded
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            <strong>Files on disk:</strong> {assetMap.allFiles.length}
          </div>

          {assetMap.missingEmotions.length > 0 && (
            <div style={{ color: 'var(--accent-warning)' }}>
              <strong>Missing:</strong> {assetMap.missingEmotions.join(', ')}
            </div>
          )}

          <div className="pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {Array.from(assetMap.assets.entries()).map(([emotion, asset]) => (
              <div key={emotion} className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                <span className={emotion === state.emotion ? 'font-bold' : ''}>
                  {emotion === state.emotion ? '▸ ' : '  '}{emotion}
                </span>
                <span style={{ color: 'var(--text-ghost)' }}>
                  {asset.src.split('/').pop()}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={reloadAssets}
            className="mt-1 w-full text-center py-0.5 rounded"
            style={{
              background: 'var(--accent-danger-soft)',
              color: 'var(--accent-danger)',
            }}
          >
            Reload assets
          </button>
        </div>
      )}
    </div>
  );
}

const CatAvatar = memo(function CatAvatar({
  size = 'md',
  className = '',
  showMessage = true,
  interactive = true,
  showInspector = false,
}: CatAvatarProps) {
  const { state, trigger, getAsset, hasRealAssets, isLoaded } = useCatEmotion();
  const px = SIZE_MAP[size];
  const asset = getAsset();
  const emotionMotion = useMemo(() => EMOTION_MOTION[state.emotion], [state.emotion]);

  // Determine the actual image URL:
  // If talking and the current asset has a talkSrc, use it.
  // Otherwise use the standard src.
  const isTalking = state.emotion === 'talking';
  const imgSrc = useMemo(() => {
    if (!asset) return null;
    if (isTalking && asset.talkSrc) return asset.talkSrc;
    return asset.src;
  }, [asset, isTalking]);

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none ${className}`}
      onMouseEnter={() => interactive && trigger({ type: 'ui_hover' })}
      onClick={() => interactive && trigger({ type: 'ui_click' })}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) trigger({ type: 'ui_click' });
      }}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      {/* Dev inspector */}
      {showInspector && <AssetInspector />}

      {/* Emotion container — spring-based transform animations */}
      <motion.div
        animate={emotionMotion.animate}
        transition={emotionMotion.transition}
        className="relative"
        style={{ width: px, height: px }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={imgSrc ?? 'placeholder'}
            initial={{ opacity: 0.7, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={fastSpring}
            className="w-full h-full"
          >
            {hasRealAssets && imgSrc ? (
              <img
                src={imgSrc}
                alt={`Cat: ${state.emotion}`}
                className="w-full h-full pixel-render object-contain"
                style={{ imageRendering: 'pixelated' }}
                draggable={false}
              />
            ) : isLoaded ? (
              <Placeholder size={px} />
            ) : (
              /* Loading state — blank until manifest returns */
              <div style={{ width: px, height: px }} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Glow ring — high intensity emotions only */}
        {state.intensity > 0.6 && hasRealAssets && (
          <motion.div
            className="absolute inset-[-8px] rounded-3xl pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: state.intensity * 0.15 }}
            transition={slowSpring}
            style={{
              background:
                state.emotion === 'angry' || state.emotion === 'warning'
                  ? `radial-gradient(circle, var(--accent-danger-glow) 0%, transparent 70%)`
                  : state.emotion === 'excited' || state.emotion === 'happy'
                  ? `radial-gradient(circle, rgba(241,196,15,0.15) 0%, transparent 70%)`
                  : 'none',
            }}
          />
        )}
      </motion.div>

      {/* Message bubble */}
      {showMessage && state.message && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.92 }}
          transition={hudSpring}
          className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap z-20
                     px-3 py-1.5 rounded text-xs font-medium tracking-tight"
          style={{
            background: 'var(--text-primary)',
            color: 'var(--text-inverse)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
            style={{ background: 'var(--text-primary)' }}
          />
          {state.message}
        </motion.div>
      )}
    </div>
  );
});

export default CatAvatar;

