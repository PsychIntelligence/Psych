'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/stores/app-store';

const LS_KEY = 'psych_settings';

function getStoredTheme(): 'light' | 'dark' | 'system' {
  if (typeof window === 'undefined') return 'dark';
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system') {
        return parsed.theme;
      }
    }
  } catch { /* ignore */ }
  return 'dark';
}

function resolveTheme(pref: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (pref === 'system') {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return pref;
}

export default function ThemeEffect() {
  const theme = useAppStore(s => s.preferences.theme) as 'light' | 'dark' | 'system';

  useEffect(() => {
    const effective = resolveTheme(theme || getStoredTheme());
    document.documentElement.setAttribute('data-theme', effective);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'light' : 'dark');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return null;
}
