'use client';

/**
 * Hook for Solana wallet address lookup + sync.
 * Uses /api/wallet/sync endpoint which handles:
 * - Address/SNS resolution
 * - Helius swap fetching
 * - Price enrichment
 * - PnL computation
 * - DB caching (stale-while-revalidate)
 *
 * No mock fallbacks.
 */

import { useCallback } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useRouter } from 'next/navigation';

export function useWalletLookup() {
  const router = useRouter();
  const {
    setWallet, setTrades, setPnLWindows, setEquityCurve,
    setSignals, setMarketMood, setIsLoadingWallet, setWalletError,
    setLastSyncAt, setPricedSwapCount, setDexBreakdown,
    isLoadingWallet, walletError,
  } = useAppStore();

  const lookup = useCallback(async (address: string) => {
    if (!address.trim()) {
      setWalletError('Please enter a Solana wallet address or .sol name');
      return;
    }

    setIsLoadingWallet(true);
    setWalletError(null);

    try {
      const response = await fetch('/api/wallet/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const err = data as { error?: string; detail?: string };
        throw new Error(err.error ?? `Lookup failed (${response.status})`);
      }

      const data = await response.json();

      if (data.status === 'error') {
        throw new Error(data.error ?? 'Sync failed');
      }

      setWallet(data.wallet);
      setTrades(data.trades, data.totalTradeCount);
      setPricedSwapCount(data.pricedSwapCount ?? 0);
      setDexBreakdown(data.dexBreakdown ?? {});
      setPnLWindows(data.pnl);
      setEquityCurve(data.equityCurve);
      setSignals(data.signals);
      if (data.marketMood) setMarketMood(data.marketMood);
      if (data.lastSyncAt) setLastSyncAt(data.lastSyncAt);

      // Load settings from DB if wallet is connected
      if (data.wallet?.address) {
        try {
          const settingsRes = await fetch(`/api/wallet/${data.wallet.address}/settings`);
          if (settingsRes.ok) {
            const settings = await settingsRes.json();
            const { setPreferences } = useAppStore.getState();
            setPreferences({
              theme: settings.theme,
              reducedMotion: settings.reducedMotion,
              notifications: settings.notifications,
              voiceMode: settings.voiceMode,
              privacyLevel: settings.privacyLevel,
            });
          }
        } catch {
          // Settings load is non-critical
        }
      }

      router.push('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lookup failed';
      setWalletError(message);
    } finally {
      setIsLoadingWallet(false);
    }
  }, [router, setWallet, setTrades, setPnLWindows, setEquityCurve, setSignals, setMarketMood, setIsLoadingWallet, setWalletError, setLastSyncAt, setPricedSwapCount, setDexBreakdown]);

  return { lookup, isLoading: isLoadingWallet, error: walletError };
}
