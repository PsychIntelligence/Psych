'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/app-store';

export function useReducedMotion(): boolean {
  const preference = useAppStore((s) => s.preferences.reducedMotion);
  const [systemReduced, setSystemReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setSystemReduced(mq.matches);

    const handler = (e: MediaQueryListEvent) => setSystemReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return preference || systemReduced;
}
