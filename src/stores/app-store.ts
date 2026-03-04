'use client';

/**
 * Global application state — Solana-only.
 * No chain selectors, no exchange connections.
 */

import { create } from 'zustand';
import type {
  WalletInfo,
  Trade,
  PnLSummary,
  TimeWindow,
  BehaviorSignal,
  TradingRule,
  MarketMood,
  ChatMessage,
  EquityCurvePoint,
  UserPreferences,
  Intervention,
} from '@/types';

interface AppState {
  wallet: WalletInfo | null;
  trades: Trade[];
  totalTradeCount: number;
  pricedSwapCount: number;
  dexBreakdown: Record<string, number>;
  isLoadingWallet: boolean;
  walletError: string | null;
  lastSyncAt: string | null;

  pnlWindows: Partial<Record<TimeWindow, PnLSummary>>;
  activeWindow: TimeWindow;
  equityCurve: EquityCurvePoint[];

  signals: BehaviorSignal[];
  interventions: Intervention[];
  rules: TradingRule[];

  marketMood: MarketMood | null;

  coachMessages: ChatMessage[];
  marketMessages: ChatMessage[];
  isChatStreaming: boolean;

  preferences: UserPreferences;

  setWallet: (wallet: WalletInfo | null) => void;
  setTrades: (trades: Trade[], total: number) => void;
  setPricedSwapCount: (count: number) => void;
  setDexBreakdown: (breakdown: Record<string, number>) => void;
  setLastSyncAt: (ts: string) => void;
  setPnLWindows: (windows: Partial<Record<TimeWindow, PnLSummary>>) => void;
  setActiveWindow: (window: TimeWindow) => void;
  setEquityCurve: (curve: EquityCurvePoint[]) => void;
  setSignals: (signals: BehaviorSignal[]) => void;
  setInterventions: (interventions: Intervention[]) => void;
  setRules: (rules: TradingRule[]) => void;
  setMarketMood: (mood: MarketMood) => void;
  addChatMessage: (message: ChatMessage) => void;
  addMarketMessage: (message: ChatMessage) => void;
  updateLastMessage: (mode: 'coach' | 'market', content: string) => void;
  setIsChatStreaming: (streaming: boolean) => void;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  setIsLoadingWallet: (loading: boolean) => void;
  setWalletError: (error: string | null) => void;
  dismissIntervention: (id: string) => void;
  reset: () => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  reducedMotion: false,
  theme: 'system',
  notifications: true,
  voiceMode: false,
  privacyLevel: 'standard',
};

const DEFAULT_RULES: TradingRule[] = [
  { id: 'max-daily-loss', label: 'Max Daily Loss', type: 'max_daily_loss', value: 500, unit: 'USD', enabled: true, triggeredCount: 0 },
  { id: 'max-trades', label: 'Max Trades Per Day', type: 'max_trades_per_day', value: 10, unit: 'trades', enabled: true, triggeredCount: 0 },
  { id: 'cooldown', label: 'Cooldown After Loss', type: 'cooldown_after_loss', value: 15, unit: 'minutes', enabled: false, triggeredCount: 0 },
  { id: 'max-position', label: 'Max Position Size', type: 'max_position_size', value: 5000, unit: 'USD', enabled: false, triggeredCount: 0 },
];

export const useAppStore = create<AppState>((set) => ({
  wallet: null,
  trades: [],
  totalTradeCount: 0,
  pricedSwapCount: 0,
  dexBreakdown: {},
  isLoadingWallet: false,
  walletError: null,
  lastSyncAt: null,
  pnlWindows: {},
  activeWindow: 30,
  equityCurve: [],
  signals: [],
  interventions: [],
  rules: DEFAULT_RULES,
  marketMood: null,
  coachMessages: [],
  marketMessages: [],
  isChatStreaming: false,
  preferences: DEFAULT_PREFERENCES,

  setWallet: (wallet) => set({ wallet, walletError: null }),
  setTrades: (trades, total) => set({ trades, totalTradeCount: total }),
  setPricedSwapCount: (count) => set({ pricedSwapCount: count }),
  setDexBreakdown: (breakdown) => set({ dexBreakdown: breakdown }),
  setLastSyncAt: (ts) => set({ lastSyncAt: ts }),
  setPnLWindows: (windows) => set({ pnlWindows: windows }),
  setActiveWindow: (window) => set({ activeWindow: window }),
  setEquityCurve: (curve) => set({ equityCurve: curve }),
  setSignals: (signals) => set({ signals }),
  setInterventions: (interventions) => set({ interventions }),
  setRules: (rules) => set({ rules }),
  setMarketMood: (mood) => set({ marketMood: mood }),
  addChatMessage: (message) => set((s) => ({ coachMessages: [...s.coachMessages, message] })),
  addMarketMessage: (message) => set((s) => ({ marketMessages: [...s.marketMessages, message] })),
  updateLastMessage: (mode, content) => set((s) => {
    const key = mode === 'coach' ? 'coachMessages' : 'marketMessages';
    const msgs = [...s[key]];
    if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + content };
    return { [key]: msgs };
  }),
  setIsChatStreaming: (streaming) => set({ isChatStreaming: streaming }),
  setPreferences: (prefs) => set((s) => ({ preferences: { ...s.preferences, ...prefs } })),
  setIsLoadingWallet: (loading) => set({ isLoadingWallet: loading }),
  setWalletError: (error) => set({ walletError: error }),
  dismissIntervention: (id) => set((s) => ({ interventions: s.interventions.filter(i => i.id !== id) })),
  reset: () => set({
    wallet: null, trades: [], totalTradeCount: 0, pricedSwapCount: 0, dexBreakdown: {},
    pnlWindows: {}, equityCurve: [],
    signals: [], interventions: [], coachMessages: [], marketMessages: [],
    walletError: null, lastSyncAt: null, marketMood: null,
  }),
}));
