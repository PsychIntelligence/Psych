/* ===================================================================
   Core type definitions for Trading Psychology Companion
   Solana-only — no EVM chains.
   =================================================================== */

// ── Wallet ────────────────────────────────────────────────────────

export interface WalletInfo {
  address: string;       // base58 Solana public key
  solDomain?: string;    // .sol name from SNS (Solana Name Service)
  solBalance: number;    // native SOL balance in SOL (not lamports)
  tokenCount: number;    // number of SPL token accounts
  firstSeen?: number;    // unix ms of earliest known tx
  lastActive?: number;   // unix ms of most recent tx
}

// ── Trades ────────────────────────────────────────────────────────

export type TradeSource =
  | 'jupiter'
  | 'raydium'
  | 'orca'
  | 'meteora'
  | 'pumpfun'
  | 'other';

export type TradeSide = 'buy' | 'sell';

export interface Trade {
  id: string;                // unique (signature + index)
  source: TradeSource;       // which DEX program
  timestamp: number;         // unix ms
  signature: string;         // Solana tx signature
  pair: string;              // e.g. "SOL/USDC"
  side: TradeSide;           // from user's perspective relative to base token
  tokenInMint: string;       // SPL mint address of token spent
  tokenInSymbol: string;
  tokenInAmount: number;     // human-readable (decimals applied)
  tokenOutMint: string;      // SPL mint address of token received
  tokenOutSymbol: string;
  tokenOutAmount: number;    // human-readable (decimals applied)
  priceUsd: number;          // USD value of the swap at execution
  feeUsd: number;            // tx fee in USD
  feeSol: number;            // tx fee in SOL
  programId: string;         // Solana program that processed the swap
}

// ── Token metadata ───────────────────────────────────────────────

export interface TokenMeta {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
}

// ── PnL & Analytics ──────────────────────────────────────────────

export type TimeWindow = 1 | 7 | 30 | 90 | 180 | 365;

export interface DailyReturn {
  date: string; // YYYY-MM-DD
  pnlUsd: number;
  pnlPercent: number;
  cumulativePnl: number;
  tradeCount: number;
  volume: number;
}

export interface PnLSummary {
  window: TimeWindow;
  totalPnlUsd: number;
  totalPnlPercent: number;
  winRate: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  volatilityOfReturns: number;
  sharpeRatio: number;
  avgHoldTimeMs: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  bestTrade: number;
  worstTrade: number;
  dailyReturns: DailyReturn[];
}

export interface EquityCurvePoint {
  timestamp: number;
  equity: number;
  drawdown: number;
}

// ── Psychology / Behavior Signals ────────────────────────────────

export type SignalSeverity = 'info' | 'warning' | 'critical';

export type SignalType =
  | 'revenge_trading'
  | 'tilt'
  | 'fomo_chasing'
  | 'overtrading'
  | 'loss_aversion'
  | 'risk_escalation'
  | 'mean_reversion_bias'
  | 'momentum_bias'
  | 'late_entry'
  | 'paper_hands'
  | 'diamond_hands'
  | 'stop_loss_discipline'
  | 'trade_clustering'
  | 'time_of_day_pattern'
  | 'weekend_effect'
  | 'position_size_spike';

export interface BehaviorSignal {
  type: SignalType;
  severity: SignalSeverity;
  label: string;
  description: string;
  evidence: string[];
  detectedAt: number;
  tradeIds: string[];
  score: number; // 0-100
}

// ── Rules & Guardrails ───────────────────────────────────────────

export interface TradingRule {
  id: string;
  label: string;
  type: 'max_daily_loss' | 'max_trades_per_day' | 'cooldown_after_loss' | 'max_position_size' | 'custom';
  value: number;
  unit: string;
  enabled: boolean;
  triggeredCount: number;
  lastTriggered?: number;
}

// ── Market Mood ──────────────────────────────────────────────────

export type MarketRegime = 'risk_on' | 'risk_off' | 'choppy' | 'trending_up' | 'trending_down' | 'capitulation' | 'euphoria';

export interface MarketMood {
  regime: MarketRegime;
  fearGreedIndex: number;
  volatilityLevel: 'low' | 'medium' | 'high' | 'extreme';
  solPrice: number;
  solChange24h: number;
  dominanceSol: number;
  defiTvlSolana: number;
  narrativeSummary: string;
  updatedAt: number;
}

// ── Cat State ────────────────────────────────────────────────────

export type CatEmotion =
  | 'idle'
  | 'talking'
  | 'angry'
  | 'excited'
  | 'disappointed'
  | 'alert'
  | 'happy'
  | 'sad'
  | 'smug'
  | 'neutral'
  | 'warning';

export interface CatAsset {
  emotion: CatEmotion;
  src: string;
  format: 'png' | 'gif' | 'webp' | 'apng' | 'svg';
  frames?: number;
  width?: number;
  height?: number;
}

export interface CatState {
  emotion: CatEmotion;
  intensity: number;
  message?: string;
  isTransitioning: boolean;
}

// ── Chat / AI ────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'system';
export type ChatMode = 'market' | 'coach';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  catEmotion?: CatEmotion;
  metadata?: {
    signals?: BehaviorSignal[];
    actionItems?: string[];
    ruleUpdates?: string[];
  };
}

export interface SessionSummary {
  actionItems: string[];
  ruleUpdateSuggestions: string[];
  keyInsight: string;
  catMood: CatEmotion;
}

// ── User / Settings ──────────────────────────────────────────────

export interface UserPreferences {
  reducedMotion: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  voiceMode: boolean;
  privacyLevel: 'standard' | 'strict';
}

export interface BehavioralTwin {
  riskTolerance: number;
  tradingStyle: 'scalper' | 'day_trader' | 'swing' | 'position';
  emotionalPatterns: string[];
  strengths: string[];
  weaknesses: string[];
  updatedAt: number;
}

// ── Memory / RAG ─────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  userId: string;
  type: 'goal' | 'rule' | 'pitfall' | 'insight' | 'session_summary';
  content: string;
  embedding?: number[];
  createdAt: number;
  relevanceScore?: number;
}

// ── Intervention ─────────────────────────────────────────────────

export type InterventionType = 'cooldown' | 'journal_prompt' | 'rule_reminder' | 'position_warning' | 'break_suggestion';

export interface Intervention {
  id: string;
  type: InterventionType;
  trigger: string;
  message: string;
  catEmotion: CatEmotion;
  severity: SignalSeverity;
  actionLabel?: string;
  dismissable: boolean;
  createdAt: number;
}
