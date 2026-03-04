/**
 * Drizzle ORM schema — Neon Postgres.
 * Solana-only. Wallet is the identity (no login).
 */

import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  serial,
} from 'drizzle-orm/pg-core';

// ── Wallets ──────────────────────────────────────────────────────

export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  address: text('address').notNull().unique(),
  solDomain: text('sol_domain'),
  solBalance: real('sol_balance').default(0),
  tokenCount: integer('token_count').default(0),
  firstSeen: timestamp('first_seen', { mode: 'date' }),
  lastActive: timestamp('last_active', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('wallets_address_idx').on(t.address),
]);

// ── Wallet Settings (per wallet) ─────────────────────────────────

export const walletSettings = pgTable('wallet_settings', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  theme: text('theme').default('dark'),
  reducedMotion: boolean('reduced_motion').default(false),
  notifications: boolean('notifications').default(true),
  voiceMode: boolean('voice_mode').default(false),
  privacyLevel: text('privacy_level').default('standard'),
  catReactivity: text('cat_reactivity').default('normal'),
  showTooltips: boolean('show_tooltips').default(true),
  rulesJson: jsonb('rules_json'),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('wallet_settings_wallet_idx').on(t.walletId),
]);

// ── Wallet Sync Runs (audit) ─────────────────────────────────────

export const walletSyncRuns = pgTable('wallet_sync_runs', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending | running | completed | failed
  swapsFetched: integer('swaps_fetched').default(0),
  lastSignature: text('last_signature'),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { mode: 'date' }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { mode: 'date' }),
}, (t) => [
  index('sync_runs_wallet_idx').on(t.walletId),
]);

// ── Wallet Swaps (cached decoded swaps, bounded) ─────────────────

export const walletSwaps = pgTable('wallet_swaps', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  signature: text('signature').notNull(),
  timestamp: timestamp('timestamp', { mode: 'date' }).notNull(),
  source: text('source').notNull(),  // jupiter, raydium, orca, meteora, pumpfun, other
  pair: text('pair').notNull(),
  side: text('side').notNull(),      // buy | sell
  tokenInMint: text('token_in_mint').notNull(),
  tokenInSymbol: text('token_in_symbol').notNull(),
  tokenInAmount: real('token_in_amount').notNull(),
  tokenOutMint: text('token_out_mint').notNull(),
  tokenOutSymbol: text('token_out_symbol').notNull(),
  tokenOutAmount: real('token_out_amount').notNull(),
  priceUsd: real('price_usd').default(0),
  feeUsd: real('fee_usd').default(0),
  feeSol: real('fee_sol').default(0),
  programId: text('program_id').notNull(),
}, (t) => [
  index('swaps_wallet_idx').on(t.walletId),
  index('swaps_timestamp_idx').on(t.timestamp),
  uniqueIndex('swaps_signature_idx').on(t.walletId, t.signature),
]);

// ── Wallet Daily PnL (aggregated series) ─────────────────────────

export const walletDailyPnl = pgTable('wallet_daily_pnl', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id').notNull().references(() => wallets.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),          // YYYY-MM-DD
  pnlUsd: real('pnl_usd').default(0),
  pnlPercent: real('pnl_percent').default(0),
  cumulativePnl: real('cumulative_pnl').default(0),
  tradeCount: integer('trade_count').default(0),
  volume: real('volume').default(0),
}, (t) => [
  index('daily_pnl_wallet_idx').on(t.walletId),
  uniqueIndex('daily_pnl_date_idx').on(t.walletId, t.date),
]);

// ── Chat Threads ─────────────────────────────────────────────────

export const chatThreads = pgTable('chat_threads', {
  id: serial('id').primaryKey(),
  walletId: integer('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
  mode: text('mode').notNull(), // coach | market
  title: text('title'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
}, (t) => [
  index('threads_wallet_idx').on(t.walletId),
]);

// ── Chat Messages ────────────────────────────────────────────────

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  threadId: integer('thread_id').notNull().references(() => chatThreads.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),  // user | assistant | system
  content: text('content').notNull(),
  catEmotion: text('cat_emotion'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (t) => [
  index('messages_thread_idx').on(t.threadId),
]);
