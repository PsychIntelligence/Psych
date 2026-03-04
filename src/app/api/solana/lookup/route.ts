/**
 * POST /api/solana/lookup
 *
 * Legacy endpoint — redirects to /api/wallet/sync.
 * Kept for backward compatibility during migration.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Forward to the new sync endpoint
    const url = new URL('/api/wallet/sync', request.url);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward client IP for rate limiting
        'x-forwarded-for': request.headers.get('x-forwarded-for') ?? '',
      },
      body: JSON.stringify({
        address: body.address,
        force: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[solana/lookup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to look up wallet. Please try again.' },
      { status: 500 }
    );
  }
}
