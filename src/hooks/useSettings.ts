'use client';

/**
 * Settings hook — manages localStorage + optional DB sync.
 *
 * - Always persists to localStorage (instant).
 * - If a wallet is loaded, debounces PUT to /api/wallet/:address/settings.
 * - On wallet load, DB settings are merged over local defaults.
 */

import { useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/app-store';
import type { UserPreferences } from '@/types';

const LS_KEY = 'psych_settings';
const DEBOUNCE_MS = 1500;

interface SettingsState extends UserPreferences {
  catReactivity: 'low' | 'normal' | 'high';
  showTooltips: boolean;
}

const DEFAULTS: SettingsState = {
  reducedMotion: false,
  theme: 'dark',
  notifications: true,
  voiceMode: false,
  privacyLevel: 'standard',
  catReactivity: 'normal',
  showTooltips: true,
};

function loadFromLocalStorage(): Partial<SettingsState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveToLocalStorage(settings: SettingsState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked
  }
}

export function useSettings() {
  const wallet = useAppStore(s => s.wallet);
  const preferences = useAppStore(s => s.preferences);
  const setPreferences = useAppStore(s => s.setPreferences);
  const dbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Merge current settings
  const localExtra = loadFromLocalStorage();
  const settings: SettingsState = {
    ...DEFAULTS,
    ...preferences,
    catReactivity: (localExtra.catReactivity as SettingsState['catReactivity']) ?? DEFAULTS.catReactivity,
    showTooltips: localExtra.showTooltips ?? DEFAULTS.showTooltips,
  };

  // Sync to DB with debounce
  const syncToDb = useCallback((updated: Partial<SettingsState>) => {
    if (!wallet?.address) return;

    if (dbTimerRef.current) clearTimeout(dbTimerRef.current);
    dbTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/wallet/${wallet.address}/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
      } catch {
        // Non-critical
      }
    }, DEBOUNCE_MS);
  }, [wallet?.address]);

  // Update a setting
  const update = useCallback((key: keyof SettingsState, value: SettingsState[keyof SettingsState]) => {
    const newSettings = { ...settings, [key]: value };

    // Update Zustand store for core preferences
    if (key in DEFAULTS && key !== 'catReactivity' && key !== 'showTooltips') {
      setPreferences({ [key]: value } as Partial<UserPreferences>);
    }

    // Always save to localStorage
    saveToLocalStorage(newSettings);

    // Debounce DB sync
    syncToDb({ [key]: value });
  }, [settings, setPreferences, syncToDb]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULTS);
    saveToLocalStorage(DEFAULTS);
    if (wallet?.address) {
      fetch(`/api/wallet/${wallet.address}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DEFAULTS),
      }).catch(() => {});
    }
  }, [setPreferences, wallet?.address]);

  // Load from localStorage on mount
  useEffect(() => {
    const local = loadFromLocalStorage();
    if (Object.keys(local).length > 0) {
      const { catReactivity, showTooltips, ...prefs } = local;
      if (Object.keys(prefs).length > 0) {
        setPreferences(prefs as Partial<UserPreferences>);
      }
    }
  // Run only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    settings,
    update,
    resetToDefaults,
  };
}
