/**
 * GET /api/wallet/:address/swaps?limit=200&cursor=...
 *
 * Returns recent swaps from DB with cursor pagination.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { SOLANA_ADDRESS_REGEX } from '@/lib/solana/constants';
import { applyRateLimit } from '@/lib/security/rate-limit';
import { isDbConfigured } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const rateLimited = applyRateLimit(request);
  if (rateLimited) return rateLimited;

  const { address } = await params;

  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    return NextResponse.json({ error: 'Invalid Solana address.' }, { status: 400 });
  }

  const limitStr = request.nextUrl.searchParams.get('limit') ?? '200';
  const limit = Math.min(parseInt(limitStr, 10) || 200, 500);
  const cursorStr = request.nextUrl.searchParams.get('cursor');
  const cursor = cursorStr ? parseInt(cursorStr, 10) : undefined;

  try {
    if (!isDbConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const { getWalletByAddress, getSwaps, getSwapCount } = await import('@/lib/db/queries');
    const wallet = await getWalletByAddress(address);
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found.' }, { status: 404 });
    }

    const swaps = await getSwaps(wallet.id, { limit, cursor });
    const total = await getSwapCount(wallet.id);

    // Determine next cursor
    const nextCursor = swaps.length === limit && swaps.length > 0
      ? swaps[swaps.length - 1].id
      : undefined;

    return NextResponse.json({
      swaps,
      total,
      nextCursor,
    });
  } catch (error) {
    console.error('[wallet/swaps] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch swaps.' }, { status: 500 });
  }
}
