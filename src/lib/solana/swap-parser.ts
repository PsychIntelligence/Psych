/**
 * Swap parser: transforms Helius Enhanced Transaction objects
 * into normalized Trade records.
 *
 * Two parsing strategies:
 * 1. Primary: use `events.swap` (Jupiter, Raydium, Orca, Meteora structured swaps)
 * 2. Fallback: reconstruct from `tokenTransfers` + `nativeTransfers`
 *    (Pump.fun and other protocols that don't always populate events.swap)
 *
 * Attribution precedence:
 * - Jupiter aggregator → always 'jupiter' even if inner pool is another DEX
 * - Pump.fun → 'pumpfun' (detected by source field or program ID)
 * - Then check for Raydium / Orca / Meteora by program ID or Helius source
 * - Everything else → 'other'
 */

import type { Trade, TradeSource } from '@/types';
import type { HeliusEnhancedTx, HeliusSwapEvent } from './helius';
import { SOL_MINT, STABLECOIN_MINTS, DEX_PROGRAMS, AGGREGATOR_PROGRAM_IDS } from './constants';

// ── Well-known symbol mapping ───────────────────────────────────

const SYMBOL_CACHE = new Map<string, string>([
  [SOL_MINT, 'SOL'],
  ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'USDC'],
  ['Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 'USDT'],
  ['DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', 'BONK'],
  ['JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', 'JUP'],
  ['7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', 'ETH'],
  ['mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', 'mSOL'],
  ['J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', 'jitoSOL'],
  ['bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1', 'bSOL'],
  ['7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj', 'stSOL'],
  ['rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', 'RNDR'],
  ['HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', 'PYTH'],
  ['EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', 'WIF'],
]);

function resolveSymbol(mint: string): string {
  if (mint === SOL_MINT) return 'SOL';
  return SYMBOL_CACHE.get(mint) ?? mint.slice(0, 6) + '...';
}

function applyDecimals(raw: string, decimals: number): number {
  return parseFloat(raw) / Math.pow(10, decimals);
}

// ── Main entry point ────────────────────────────────────────────

export function parseHeliusSwaps(txs: HeliusEnhancedTx[], walletAddress: string): Trade[] {
  const trades: Trade[] = [];
  const seenSigs = new Set<string>();

  for (const tx of txs) {
    if (seenSigs.has(tx.signature)) continue;

    // Strategy 1: structured events.swap
    const swap = tx.events?.swap;
    if (swap) {
      const trade = parseFromSwapEvent(tx, swap, walletAddress);
      if (trade) {
        trades.push(trade);
        seenSigs.add(tx.signature);
        continue;
      }
    }

    // Strategy 2: reconstruct from tokenTransfers + nativeTransfers
    // Covers Pump.fun and other protocols where events.swap is absent
    if (isLikelySwap(tx, walletAddress)) {
      const trade = parseFromTransfers(tx, walletAddress);
      if (trade) {
        trades.push(trade);
        seenSigs.add(tx.signature);
      }
    }
  }

  return trades.sort((a, b) => b.timestamp - a.timestamp);
}

// ── Strategy 1: Parse from events.swap ──────────────────────────

function parseFromSwapEvent(tx: HeliusEnhancedTx, swap: HeliusSwapEvent, walletAddress: string): Trade | null {
  const parsed = extractSwapAmounts(swap, walletAddress);
  if (!parsed) return null;

  const { inMint, inAmount, inDecimals, outMint, outAmount, outDecimals } = parsed;
  return buildTrade(tx, inMint, applyDecimals(inAmount, inDecimals), outMint, applyDecimals(outAmount, outDecimals), swap);
}

function extractSwapAmounts(swap: HeliusSwapEvent, _walletAddress: string) {
  let inMint: string;
  let inAmount: string;
  let inDecimals: number;

  if (swap.tokenInputs.length > 0) {
    const ti = swap.tokenInputs[0];
    inMint = ti.mint;
    inAmount = ti.rawTokenAmount.tokenAmount;
    inDecimals = ti.rawTokenAmount.decimals;
  } else if (swap.nativeInput) {
    inMint = SOL_MINT;
    inAmount = swap.nativeInput.amount;
    inDecimals = 9;
  } else {
    return null;
  }

  let outMint: string;
  let outAmount: string;
  let outDecimals: number;

  if (swap.tokenOutputs.length > 0) {
    const to = swap.tokenOutputs[0];
    outMint = to.mint;
    outAmount = to.rawTokenAmount.tokenAmount;
    outDecimals = to.rawTokenAmount.decimals;
  } else if (swap.nativeOutput) {
    outMint = SOL_MINT;
    outAmount = swap.nativeOutput.amount;
    outDecimals = 9;
  } else {
    return null;
  }

  if (inMint === outMint) return null;

  return { inMint, inAmount, inDecimals, outMint, outAmount, outDecimals };
}

// ── Strategy 2: Parse from tokenTransfers + nativeTransfers ─────
// This is critical for Pump.fun where events.swap may not be populated

function isLikelySwap(tx: HeliusEnhancedTx, walletAddress: string): boolean {
  const heliusType = tx.type?.toUpperCase() ?? '';
  const heliusSource = tx.source?.toUpperCase() ?? '';

  // Helius labels these as SWAP
  if (heliusType === 'SWAP') return true;

  // Pump.fun buy/sell often typed as SWAP but sometimes as TRANSFER or other
  if (heliusSource.includes('PUMP')) return true;

  // Check if the wallet both sent and received different tokens in this tx
  const sentTokens = new Set<string>();
  const receivedTokens = new Set<string>();

  for (const tt of tx.tokenTransfers ?? []) {
    if (tt.fromUserAccount === walletAddress && tt.tokenAmount > 0) sentTokens.add(tt.mint);
    if (tt.toUserAccount === walletAddress && tt.tokenAmount > 0) receivedTokens.add(tt.mint);
  }

  for (const nt of tx.nativeTransfers ?? []) {
    if (nt.fromUserAccount === walletAddress && nt.amount > 0) sentTokens.add(SOL_MINT);
    if (nt.toUserAccount === walletAddress && nt.amount > 0) receivedTokens.add(SOL_MINT);
  }

  // A swap has the wallet sending one thing and receiving another
  if (sentTokens.size > 0 && receivedTokens.size > 0) {
    for (const r of receivedTokens) {
      if (!sentTokens.has(r)) return true;
    }
  }

  return false;
}

function parseFromTransfers(tx: HeliusEnhancedTx, walletAddress: string): Trade | null {
  // Collect what the wallet sent (token out from wallet = trade input)
  let inMint: string | null = null;
  let inAmount = 0;

  // Collect what the wallet received (token in to wallet = trade output)
  let outMint: string | null = null;
  let outAmount = 0;

  // Check native SOL transfers
  let solSent = 0;
  let solReceived = 0;

  for (const nt of tx.nativeTransfers ?? []) {
    if (nt.fromUserAccount === walletAddress) solSent += nt.amount;
    if (nt.toUserAccount === walletAddress) solReceived += nt.amount;
  }

  const netSolLamports = solReceived - solSent;
  // Subtract the tx fee from the "sent" side to avoid counting it as swap volume
  const feeAdjustedNetSol = netSolLamports + tx.fee;

  // Check token transfers
  const tokensSent = new Map<string, number>();
  const tokensReceived = new Map<string, number>();

  for (const tt of tx.tokenTransfers ?? []) {
    if (tt.fromUserAccount === walletAddress && tt.tokenAmount > 0) {
      tokensSent.set(tt.mint, (tokensSent.get(tt.mint) ?? 0) + tt.tokenAmount);
    }
    if (tt.toUserAccount === walletAddress && tt.tokenAmount > 0) {
      tokensReceived.set(tt.mint, (tokensReceived.get(tt.mint) ?? 0) + tt.tokenAmount);
    }
  }

  // Determine in/out:
  // Case 1: Wallet sent SOL and received a token (buy)
  // Case 2: Wallet sent a token and received SOL (sell)
  // Case 3: Token-to-token swap

  if (feeAdjustedNetSol < -5000 && tokensReceived.size > 0) {
    // Wallet sent SOL, received token(s) → BUY
    inMint = SOL_MINT;
    inAmount = Math.abs(feeAdjustedNetSol) / 1e9;

    // Find the received token (exclude SOL/WSOL)
    for (const [mint, amt] of tokensReceived) {
      if (mint !== SOL_MINT) {
        outMint = mint;
        outAmount = amt;
        break;
      }
    }
  } else if (feeAdjustedNetSol > 5000 && tokensSent.size > 0) {
    // Wallet received SOL, sent token(s) → SELL
    outMint = SOL_MINT;
    outAmount = feeAdjustedNetSol / 1e9;

    // Find the sent token (exclude SOL/WSOL)
    for (const [mint, amt] of tokensSent) {
      if (mint !== SOL_MINT) {
        inMint = mint;
        inAmount = amt;
        break;
      }
    }
  } else if (tokensSent.size > 0 && tokensReceived.size > 0) {
    // Token-to-token swap
    for (const [mint, amt] of tokensSent) {
      if (mint !== SOL_MINT) { inMint = mint; inAmount = amt; break; }
    }
    for (const [mint, amt] of tokensReceived) {
      if (mint !== SOL_MINT && mint !== inMint) { outMint = mint; outAmount = amt; break; }
    }
  }

  if (!inMint || !outMint || inAmount <= 0 || outAmount <= 0) return null;
  if (inMint === outMint) return null;

  return buildTrade(tx, inMint, inAmount, outMint, outAmount, null);
}

// ── Shared trade builder ────────────────────────────────────────

function buildTrade(
  tx: HeliusEnhancedTx,
  inMint: string,
  tokenInAmount: number,
  outMint: string,
  tokenOutAmount: number,
  swap: HeliusSwapEvent | null,
): Trade {
  const tokenInSymbol = resolveSymbol(inMint);
  const tokenOutSymbol = resolveSymbol(outMint);

  const isStableIn = STABLECOIN_MINTS.has(inMint);
  const isStableOut = STABLECOIN_MINTS.has(outMint);
  const isSolIn = inMint === SOL_MINT;
  const isSolOut = outMint === SOL_MINT;

  let side: Trade['side'] = 'buy';
  if (isStableIn || isSolIn) {
    side = 'buy';
  } else if (isStableOut || isSolOut) {
    side = 'sell';
  } else {
    side = 'buy';
  }

  let pair: string;
  if (isStableOut) {
    pair = `${tokenInSymbol}/${tokenOutSymbol}`;
  } else if (isStableIn) {
    pair = `${tokenOutSymbol}/${tokenInSymbol}`;
  } else if (isSolOut) {
    pair = `${tokenInSymbol}/SOL`;
  } else if (isSolIn) {
    pair = `${tokenOutSymbol}/SOL`;
  } else {
    pair = `${tokenOutSymbol}/${tokenInSymbol}`;
  }

  let priceUsd = 0;
  if (isStableIn) priceUsd = tokenInAmount;
  else if (isStableOut) priceUsd = tokenOutAmount;

  const source = resolveSource(tx, swap);
  const feeSol = tx.fee / 1e9;

  return {
    id: `${tx.signature}:0`,
    source,
    timestamp: tx.timestamp * 1000,
    signature: tx.signature,
    pair,
    side,
    tokenInMint: inMint,
    tokenInSymbol,
    tokenInAmount,
    tokenOutMint: outMint,
    tokenOutSymbol,
    tokenOutAmount,
    priceUsd,
    feeUsd: 0,
    feeSol,
    programId: resolveMainProgramId(tx, swap),
  };
}

// ── Source attribution ──────────────────────────────────────────

/**
 * Resolve swap source with aggregator precedence:
 * 1. Jupiter aggregator always wins
 * 2. Pump.fun detection (source field or program ID)
 * 3. Raydium / Orca / Meteora by source field
 * 4. Fall back to inner swap program IDs
 * 5. Default to 'other'
 */
function resolveSource(tx: HeliusEnhancedTx, swap: HeliusSwapEvent | null): TradeSource {
  const heliusSource = tx.source?.toUpperCase() ?? '';

  // Jupiter aggregator always gets priority
  if (heliusSource.includes('JUPITER')) return 'jupiter';

  // Check inner swap program IDs for Jupiter aggregator
  if (swap?.innerSwaps && swap.innerSwaps.length > 0) {
    for (const inner of swap.innerSwaps) {
      const pid = inner.programInfo?.account;
      if (pid && AGGREGATOR_PROGRAM_IDS.has(pid)) return 'jupiter';
    }
  }

  // Pump.fun detection — Helius returns "PUMP_FUN" or similar
  if (heliusSource.includes('PUMP')) return 'pumpfun';

  // Direct DEX matches from Helius source
  if (heliusSource.includes('RAYDIUM')) return 'raydium';
  if (heliusSource.includes('ORCA') || heliusSource.includes('WHIRLPOOL')) return 'orca';
  if (heliusSource.includes('METEORA')) return 'meteora';

  // Fallback: check inner swap program IDs against known DEXes
  if (swap?.innerSwaps && swap.innerSwaps.length > 0) {
    for (const inner of swap.innerSwaps) {
      const pid = inner.programInfo?.account;
      if (pid) {
        const dex = DEX_PROGRAMS[pid];
        if (dex) return dex;
      }
    }
  }

  // Last resort: scan accountData for known program IDs
  for (const ad of tx.accountData ?? []) {
    const dex = DEX_PROGRAMS[ad.account];
    if (dex) return dex;
  }

  return 'other';
}

function resolveMainProgramId(tx: HeliusEnhancedTx, swap: HeliusSwapEvent | null): string {
  if (swap?.innerSwaps && swap.innerSwaps.length > 0) {
    return swap.innerSwaps[0].programInfo?.account ?? '';
  }

  const source = tx.source?.toUpperCase() ?? '';
  if (source.includes('JUPITER')) return 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
  if (source.includes('PUMP')) return '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
  if (source.includes('RAYDIUM')) return '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';
  if (source.includes('ORCA')) return 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
  if (source.includes('METEORA')) return 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';

  return '';
}
