/**
 * Helius client for Solana data.
 *
 * Uses Helius Enhanced Transactions API to fetch parsed swap history,
 * and the Helius RPC DAS API for token balances.
 *
 * No mock fallbacks — requires HELIUS_API_KEY or throws.
 */

import type { Trade, WalletInfo } from '@/types';
import { requireKey } from '@/lib/utils/env';
import { parseHeliusSwaps } from './swap-parser';

// ── Helius response types ───────────────────────────────────────

export interface HeliusTokenTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  fromTokenAccount: string;
  toTokenAccount: string;
  tokenAmount: number;
  mint: string;
  tokenStandard: string;
}

export interface HeliusNativeTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

export interface HeliusSwapEvent {
  nativeInput: { account: string; amount: string } | null;
  nativeOutput: { account: string; amount: string } | null;
  tokenInputs: {
    userAccount: string;
    tokenAccount: string;
    mint: string;
    rawTokenAmount: { tokenAmount: string; decimals: number };
  }[];
  tokenOutputs: {
    userAccount: string;
    tokenAccount: string;
    mint: string;
    rawTokenAmount: { tokenAmount: string; decimals: number };
  }[];
  tokenFees: unknown[];
  nativeFees: { account: string; amount: string }[];
  innerSwaps: {
    tokenInputs: {
      userAccount: string;
      tokenAccount: string;
      mint: string;
      rawTokenAmount: { tokenAmount: string; decimals: number };
    }[];
    tokenOutputs: {
      userAccount: string;
      tokenAccount: string;
      mint: string;
      rawTokenAmount: { tokenAmount: string; decimals: number };
    }[];
    programInfo: { source: string; account: string; programName: string; instructionName: string };
  }[];
}

export interface HeliusEnhancedTx {
  description: string;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  signature: string;
  slot: number;
  timestamp: number;
  tokenTransfers: HeliusTokenTransfer[];
  nativeTransfers: HeliusNativeTransfer[];
  accountData: { account: string; nativeBalanceChange: number; tokenBalanceChanges: unknown[] }[];
  events: {
    swap?: HeliusSwapEvent;
  };
}

// ── Client ──────────────────────────────────────────────────────

function heliusUrl(path: string): string {
  const key = requireKey('HELIUS_API_KEY');
  return `https://api.helius.xyz${path}?api-key=${key}`;
}

function heliusRpcUrl(): string {
  const key = requireKey('HELIUS_API_KEY');
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

/**
 * Fetch with retry and exponential backoff.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '2');
        const delay = Math.min(retryAfter * 1000, 10_000) * (attempt + 1);
        console.warn(`[helius] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (res.status >= 500 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[helius] Server error ${res.status}, retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[helius] Network error, retrying in ${delay}ms:`, lastError.message);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error('Helius fetch failed after retries');
}

/**
 * Fetch enhanced transactions for a Solana wallet.
 * Fetches ALL transaction types (not just SWAP) so the parser can
 * capture Pump.fun and other protocols that Helius may classify
 * differently. The swap parser handles filtering.
 */
export async function fetchSwapTransactions(
  address: string,
  opts: { maxTxs?: number; beforeSignature?: string } = {}
): Promise<HeliusEnhancedTx[]> {
  const maxTxs = opts.maxTxs ?? 500;
  const allTxs: HeliusEnhancedTx[] = [];
  let lastSig = opts.beforeSignature;
  let emptyPages = 0;

  while (allTxs.length < maxTxs) {
    const limit = Math.min(100, maxTxs - allTxs.length);
    let url = heliusUrl(`/v0/addresses/${address}/transactions`) + `&limit=${limit}`;
    if (lastSig) url += `&before=${lastSig}`;

    const res = await fetchWithRetry(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Helius API error ${res.status}: ${text.slice(0, 200)}`);
    }

    const txs: HeliusEnhancedTx[] = await res.json();

    if (txs.length === 0) {
      emptyPages++;
      if (emptyPages >= 2) break;
      continue;
    }

    emptyPages = 0;
    allTxs.push(...txs);
    lastSig = txs[txs.length - 1].signature;

    if (txs.length < limit) break;
  }

  return allTxs;
}

/**
 * Get SOL balance and token accounts for a wallet via Helius RPC.
 */
export async function getWalletInfo(address: string): Promise<WalletInfo> {
  const rpcUrl = heliusRpcUrl();

  const balanceRes = await fetchWithRetry(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'getBalance',
      params: [address],
    }),
    signal: AbortSignal.timeout(10000),
  });

  const balanceData = await balanceRes.json();
  const lamports: number = balanceData?.result?.value ?? 0;
  const solBalance = lamports / 1e9;

  const tokenRes = await fetchWithRetry(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 2,
      method: 'getTokenAccountsByOwner',
      params: [
        address,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ],
    }),
    signal: AbortSignal.timeout(10000),
  });

  const tokenData = await tokenRes.json();
  const tokenAccounts = tokenData?.result?.value ?? [];

  return {
    address,
    solBalance,
    tokenCount: tokenAccounts.length,
  };
}

/**
 * High-level: fetch swap transactions → parse into Trade[].
 */
export async function fetchWalletTrades(address: string, maxTxs = 500): Promise<Trade[]> {
  const rawTxs = await fetchSwapTransactions(address, { maxTxs });
  return parseHeliusSwaps(rawTxs, address);
}
