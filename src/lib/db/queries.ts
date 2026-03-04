/**
 * Database query helpers — typed wrappers around Drizzle for common operations.
 * All queries are server-only.
 */

import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { getDb } from './index';
import {
  wallets,
  walletSettings,
  walletSyncRuns,
  walletSwaps,
  walletDailyPnl,
  chatThreads,
  chatMessages,
} from './schema';
import type { Trade, TradeSide, TradeSource } from '@/types';

// ── Wallets ──────────────────────────────────────────────────────

export async function findOrCreateWallet(address: string, solDomain?: string) {
  const db = getDb();

  const existing = await db.select().from(wallets).where(eq(wallets.address, address)).limit(1);
  if (existing.length > 0) {
    // Update domain if newly resolved
    if (solDomain && !existing[0].solDomain) {
      await db.update(wallets).set({ solDomain, updatedAt: new Date() }).where(eq(wallets.id, existing[0].id));
      return { ...existing[0], solDomain };
    }
    return existing[0];
  }

  const inserted = await db.insert(wallets).values({
    address,
    solDomain: solDomain ?? null,
  }).returning();

  return inserted[0];
}

export async function updateWalletInfo(walletId: number, info: {
  solBalance?: number;
  tokenCount?: number;
  firstSeen?: Date;
  lastActive?: Date;
}) {
  const db = getDb();
  await db.update(wallets).set({ ...info, updatedAt: new Date() }).where(eq(wallets.id, walletId));
}

export async function getWalletByAddress(address: string) {
  const db = getDb();
  const rows = await db.select().from(wallets).where(eq(wallets.address, address)).limit(1);
  return rows[0] ?? null;
}

// ── Sync Runs ────────────────────────────────────────────────────

export async function getLastSync(walletId: number) {
  const db = getDb();
  const rows = await db.select().from(walletSyncRuns)
    .where(and(eq(walletSyncRuns.walletId, walletId), eq(walletSyncRuns.status, 'completed')))
    .orderBy(desc(walletSyncRuns.completedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSyncRun(walletId: number) {
  const db = getDb();
  const rows = await db.insert(walletSyncRuns).values({ walletId, status: 'running' }).returning();
  return rows[0];
}

export async function completeSyncRun(syncId: number, swapsFetched: number, lastSignature?: string) {
  const db = getDb();
  await db.update(walletSyncRuns).set({
    status: 'completed',
    swapsFetched,
    lastSignature: lastSignature ?? null,
    completedAt: new Date(),
  }).where(eq(walletSyncRuns.id, syncId));
}

export async function failSyncRun(syncId: number, errorMessage: string) {
  const db = getDb();
  await db.update(walletSyncRuns).set({
    status: 'failed',
    errorMessage,
    completedAt: new Date(),
  }).where(eq(walletSyncRuns.id, syncId));
}

// ── Swaps ────────────────────────────────────────────────────────

export async function upsertSwaps(walletId: number, trades: Trade[]) {
  const db = getDb();

  // Insert in batches to avoid huge queries
  const batchSize = 50;
  for (let i = 0; i < trades.length; i += batchSize) {
    const batch = trades.slice(i, i + batchSize);
    const values = batch.map(t => ({
      walletId,
      signature: t.signature,
      timestamp: new Date(t.timestamp),
      source: t.source,
      pair: t.pair,
      side: t.side,
      tokenInMint: t.tokenInMint,
      tokenInSymbol: t.tokenInSymbol,
      tokenInAmount: t.tokenInAmount,
      tokenOutMint: t.tokenOutMint,
      tokenOutSymbol: t.tokenOutSymbol,
      tokenOutAmount: t.tokenOutAmount,
      priceUsd: t.priceUsd,
      feeUsd: t.feeUsd,
      feeSol: t.feeSol,
      programId: t.programId,
    }));

    await db.insert(walletSwaps).values(values).onConflictDoNothing();
  }
}

export async function getSwaps(walletId: number, opts: { limit?: number; cursor?: number; since?: Date } = {}): Promise<Trade[]> {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 200, 500);

  let query = db.select().from(walletSwaps)
    .where(eq(walletSwaps.walletId, walletId))
    .orderBy(desc(walletSwaps.timestamp))
    .limit(limit);

  if (opts.cursor) {
    query = db.select().from(walletSwaps)
      .where(and(
        eq(walletSwaps.walletId, walletId),
        sql`${walletSwaps.id} < ${opts.cursor}`
      ))
      .orderBy(desc(walletSwaps.timestamp))
      .limit(limit);
  }

  if (opts.since) {
    query = db.select().from(walletSwaps)
      .where(and(
        eq(walletSwaps.walletId, walletId),
        gte(walletSwaps.timestamp, opts.since)
      ))
      .orderBy(desc(walletSwaps.timestamp))
      .limit(limit);
  }

  const rows = await query;

  return rows.map(r => ({
    id: `${r.signature}:0`,
    source: r.source as TradeSource,
    timestamp: r.timestamp.getTime(),
    signature: r.signature,
    pair: r.pair,
    side: r.side as TradeSide,
    tokenInMint: r.tokenInMint,
    tokenInSymbol: r.tokenInSymbol,
    tokenInAmount: r.tokenInAmount,
    tokenOutMint: r.tokenOutMint,
    tokenOutSymbol: r.tokenOutSymbol,
    tokenOutAmount: r.tokenOutAmount,
    priceUsd: r.priceUsd ?? 0,
    feeUsd: r.feeUsd ?? 0,
    feeSol: r.feeSol ?? 0,
    programId: r.programId,
  }));
}

export async function getSwapCount(walletId: number): Promise<number> {
  const db = getDb();
  const rows = await db.select({ count: sql<number>`count(*)` }).from(walletSwaps)
    .where(eq(walletSwaps.walletId, walletId));
  return rows[0]?.count ?? 0;
}

// ── Daily PnL ────────────────────────────────────────────────────

export async function upsertDailyPnl(walletId: number, series: { date: string; pnlUsd: number; pnlPercent: number; cumulativePnl: number; tradeCount: number; volume: number }[]) {
  const db = getDb();

  const batchSize = 50;
  for (let i = 0; i < series.length; i += batchSize) {
    const batch = series.slice(i, i + batchSize);
    const values = batch.map(d => ({
      walletId,
      date: d.date,
      pnlUsd: d.pnlUsd,
      pnlPercent: d.pnlPercent,
      cumulativePnl: d.cumulativePnl,
      tradeCount: d.tradeCount,
      volume: d.volume,
    }));

    await db.insert(walletDailyPnl).values(values).onConflictDoNothing();
  }
}

export async function getDailyPnl(walletId: number, since?: Date) {
  const db = getDb();

  if (since) {
    const sinceStr = since.toISOString().split('T')[0];
    return db.select().from(walletDailyPnl)
      .where(and(eq(walletDailyPnl.walletId, walletId), gte(walletDailyPnl.date, sinceStr)))
      .orderBy(walletDailyPnl.date);
  }

  return db.select().from(walletDailyPnl)
    .where(eq(walletDailyPnl.walletId, walletId))
    .orderBy(walletDailyPnl.date);
}

// ── Settings ─────────────────────────────────────────────────────

export async function getSettings(walletId: number) {
  const db = getDb();
  const rows = await db.select().from(walletSettings).where(eq(walletSettings.walletId, walletId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertSettings(walletId: number, settings: {
  theme?: string;
  reducedMotion?: boolean;
  notifications?: boolean;
  voiceMode?: boolean;
  privacyLevel?: string;
  catReactivity?: string;
  showTooltips?: boolean;
  rulesJson?: unknown;
}) {
  const db = getDb();

  const existing = await getSettings(walletId);
  if (existing) {
    await db.update(walletSettings).set({
      ...settings,
      updatedAt: new Date(),
    }).where(eq(walletSettings.walletId, walletId));
  } else {
    await db.insert(walletSettings).values({
      walletId,
      ...settings,
    });
  }
}

// ── Chat ─────────────────────────────────────────────────────────

export async function findOrCreateThread(walletId: number | null, mode: string) {
  const db = getDb();

  if (walletId) {
    const existing = await db.select().from(chatThreads)
      .where(and(eq(chatThreads.walletId, walletId), eq(chatThreads.mode, mode)))
      .orderBy(desc(chatThreads.updatedAt))
      .limit(1);

    if (existing.length > 0) return existing[0];
  }

  const rows = await db.insert(chatThreads).values({
    walletId,
    mode,
  }).returning();

  return rows[0];
}

export async function addChatMessage(threadId: number, role: string, content: string, catEmotion?: string, metadata?: unknown) {
  const db = getDb();

  await db.insert(chatMessages).values({
    threadId,
    role,
    content,
    catEmotion: catEmotion ?? null,
    metadata: metadata ?? null,
  });

  // Update thread timestamp
  await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, threadId));
}

export async function getThreadMessages(threadId: number, limit = 20) {
  const db = getDb();
  const rows = await db.select().from(chatMessages)
    .where(eq(chatMessages.threadId, threadId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  return rows.reverse(); // Return in chronological order
}
