/**
 * Solana Name Service (SNS) resolver.
 * Resolves .sol domain names to Solana public keys.
 *
 * Uses the public SNS HTTP resolver API (sns.id).
 * No mock fallbacks.
 */

import { SOL_DOMAIN_REGEX } from './constants';

const SNS_API_BASE = 'https://sns-sdk-proxy.bonfida.workers.dev';

export interface SnsResolution {
  address: string;
  domain: string;
}

/**
 * Check if input looks like a .sol domain.
 */
export function isSolDomain(input: string): boolean {
  return SOL_DOMAIN_REGEX.test(input.trim());
}

/**
 * Resolve a .sol domain name to a Solana public key.
 * Returns null if the domain doesn't exist or resolution fails.
 */
export async function resolveSolDomain(domain: string): Promise<SnsResolution | null> {
  const cleanDomain = domain.trim().toLowerCase();

  if (!isSolDomain(cleanDomain)) {
    return null;
  }

  try {
    const nameWithoutSuffix = cleanDomain.replace(/\.sol$/, '');
    const res = await fetch(`${SNS_API_BASE}/resolve/${nameWithoutSuffix}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`SNS API error: ${res.status}`);
    }

    const data: { result: string } = await res.json();
    const address = data.result;

    if (!address || typeof address !== 'string') {
      return null;
    }

    return { address, domain: cleanDomain };
  } catch (error) {
    console.error('[SNS] Resolution failed:', error);
    return null;
  }
}

/**
 * Reverse-resolve a Solana address to its .sol domain (if any).
 */
export async function reverseResolveSol(address: string): Promise<string | null> {
  try {
    const res = await fetch(`${SNS_API_BASE}/favorite-domain/${address}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data: { result: { domain: string } | null } = await res.json();
    if (data.result?.domain && typeof data.result.domain === 'string') {
      return `${data.result.domain}.sol`;
    }
    return null;
  } catch {
    return null;
  }
}
