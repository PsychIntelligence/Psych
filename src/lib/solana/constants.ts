/**
 * Solana ecosystem constants: program IDs, well-known mints, stablecoins.
 *
 * DEX attribution: only Jupiter, Raydium, Orca, Meteora are first-class.
 * Everything else resolves to 'other'.
 */

import type { TradeSource } from '@/types';

// ── Well-known token mints ──────────────────────────────────────

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const WSOL_MINT = SOL_MINT;
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

export const STABLECOIN_MINTS = new Set([USDC_MINT, USDT_MINT]);

// ── DEX Program IDs → TradeSource ───────────────────────────────
// Canonical list. If a program ID is not listed, it maps to 'other'.

export const DEX_PROGRAMS: Record<string, TradeSource> = {
  // Jupiter Aggregator v6
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'jupiter',
  // Jupiter Aggregator v4
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': 'jupiter',
  // Jupiter Aggregator v3
  'JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph': 'jupiter',
  // Jupiter Limit Order
  'jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu': 'jupiter',
  // Jupiter DCA
  'DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23': 'jupiter',

  // Raydium AMM V4
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'raydium',
  // Raydium Concentrated Liquidity (CLMM)
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'raydium',
  // Raydium CP-Swap (CPMM)
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C': 'raydium',
  // Raydium Router
  'routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS': 'raydium',

  // Orca Whirlpool
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'orca',
  // Orca Token Swap (legacy)
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'orca',

  // Meteora DLMM
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': 'meteora',
  // Meteora Pools
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': 'meteora',
  // Meteora Vault
  '24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi': 'meteora',

  // Pump.fun Bonding Curve AMM
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'pumpfun',
  // Pump.fun Fee Account / Migration
  'BSfD6SHZigAfDWSjzD5Q41jw8LmKwtmjskPH9XW1mrRW': 'pumpfun',
  // Pump.fun Token Program (Pump AMM)
  'PumpkiNVnFbcRGaGaxDfAoJe3XhKz8do3QLSVBEondN': 'pumpfun',
};

/**
 * Aggregator program IDs get attribution precedence.
 * If Jupiter is present in a transaction, the swap is attributed to Jupiter
 * even if the underlying pool is Raydium/Orca/Meteora.
 */
export const AGGREGATOR_PROGRAM_IDS = new Set([
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
  'JUP3c2Uh3WA4Ng34tw6kPd2G4C5BB21Xo36Je1s32Ph',
  'jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu',
  'DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23',
]);

/**
 * Resolve a program ID to a TradeSource.
 * Returns 'other' for anything not in the canonical list.
 */
export function programToDex(programId: string): TradeSource {
  return DEX_PROGRAMS[programId] ?? 'other';
}

// ── Solana Name Service ─────────────────────────────────────────

export const SNS_PROGRAM_ID = 'namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX';

/** Base58 regex for Solana public keys (32-byte, base58check) */
export const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** .sol domain regex */
export const SOL_DOMAIN_REGEX = /^[a-zA-Z0-9_-]+\.sol$/;
