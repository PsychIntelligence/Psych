'use client';

/**
 * Background — Atmospheric layer rendered once, behind all pages.
 *
 * Layers (back to front):
 * 1. Solid dark base (via body CSS)
 * 2. Ambient bloom: soft radial glow behind hero zone
 * 3. Vignette: darkening at edges
 * 4. Grain: ultra-faint film noise with mouse-parallax
 *
 * All layers use fixed positioning → no layout impact.
 * Parallax uses rAF for 60fps, transform-only.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export default function Background() {
  const reduced = useReducedMotion();
  const grainRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const mouse = useRef({ x: 0.5, y: 0.5 });

  const onMouseMove = useCallback((e: MouseEvent) => {
    mouse.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
  }, []);

  useEffect(() => {
    if (reduced) return;
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    const tick = () => {
      const { x, y } = mouse.current;
      if (grainRef.current) {
        grainRef.current.style.transform = `translate(${(x - 0.5) * 8}px, ${(y - 0.5) * 8}px)`;
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${(x - 0.5) * -20}px, ${(y - 0.5) * -14}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [reduced, onMouseMove]);

  if (reduced) {
    return (
      <>
        <div className="fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 30%, var(--bg-glow) 0%, transparent 70%)' }} />
      </>
    );
  }

  return (
    <>
      {/* Ambient bloom — shifts with mouse */}
      <div
        ref={glowRef}
        className="fixed inset-0 -z-10 pointer-events-none will-change-transform"
        style={{
          background: 'radial-gradient(ellipse 60% 45% at 50% 25%, var(--bg-glow) 0%, transparent 65%)',
        }}
      />

      {/* Vignette */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, rgba(0,0,0,0.35) 100%)',
        }}
      />

      {/* Grain — parallax with mouse */}
      <div
        ref={grainRef}
        className="fixed inset-[-20px] pointer-events-none will-change-transform"
        style={{
          zIndex: 9999,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: '128px',
          opacity: 0.018,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}
