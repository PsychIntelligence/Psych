/**
 * POST /api/wallet/resolve
 *
 * Resolves a Solana wallet address or .sol domain name.
 * Returns the canonical base58 address.
 */

import { NextResponse } from 'next/server';
import { walletAddressSchema } from '@/lib/security/validation';
import { applyRateLimit } from '@/lib/security/rate-limit';
import { isSolDomain, resolveSolDomain, reverseResolveSol } from '@/lib/solana/sns';
import { SOLANA_ADDRESS_REGEX } from '@/lib/solana/constants';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rateLimited = applyRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = walletAddressSchema.safeParse(body.query ?? body.address);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    let address = parsed.data.trim();
    let resolvedFrom: string | undefined;

    if (isSolDomain(address)) {
      const resolved = await resolveSolDomain(address);
      if (!resolved) {
        return NextResponse.json(
          { error: `Could not resolve ${address}. Domain may not exist.` },
          { status: 404 }
        );
      }
      resolvedFrom = resolved.domain;
      address = resolved.address;
    } else if (SOLANA_ADDRESS_REGEX.test(address)) {
      const domain = await reverseResolveSol(address);
      if (domain) resolvedFrom = domain;
    }

    return NextResponse.json({ address, resolvedFrom });
  } catch (error) {
    console.error('[wallet/resolve] Error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve wallet address.' },
      { status: 500 }
    );
  }
}
