'use client';

/**
 * GrainOverlay — Subtle animated film grain with mouse-reactive parallax.
 *
 * Extremely low opacity. Adds premium texture feel without performance cost.
 * Uses CSS background (no canvas) for GPU compositing.
 * Mouse parallax: grain layer shifts slightly with cursor position.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export default function GrainOverlay() {
  const reduced = useReducedMotion();
  const grainRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = {
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    };
  }, []);

  useEffect(() => {
    if (reduced) return;

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const animate = () => {
      if (grainRef.current) {
        const { x, y } = mouseRef.current;
        const tx = (x - 0.5) * 6;
        const ty = (y - 0.5) * 6;
        grainRef.current.style.transform = `translate(${tx}px, ${ty}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [reduced, handleMouseMove]);

  if (reduced) return null;

  return (
    <>
      {/* Grain texture */}
      <div
        ref={grainRef}
        className="fixed inset-[-20px] pointer-events-none z-[9999]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
          opacity: 0.022,
          mixBlendMode: 'multiply',
          willChange: 'transform',
        }}
      />

      {/* Soft radial vignette */}
      <div
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(26,26,46,0.04) 100%)',
        }}
      />
    </>
  );
}
