/**
 * GET/PUT /api/wallet/:address/settings
 *
 * Per-wallet settings stored in Neon DB.
 * GET: returns settings (or defaults if none exist).
 * PUT: upserts settings.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { SOLANA_ADDRESS_REGEX } from '@/lib/solana/constants';
import { applyRateLimit } from '@/lib/security/rate-limit';
import { isDbConfigured } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  reducedMotion: false,
  notifications: true,
  voiceMode: false,
  privacyLevel: 'standard',
  catReactivity: 'normal',
  showTooltips: true,
  rulesJson: null,
};

const settingsUpdateSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  reducedMotion: z.boolean().optional(),
  notifications: z.boolean().optional(),
  voiceMode: z.boolean().optional(),
  privacyLevel: z.enum(['standard', 'strict']).optional(),
  catReactivity: z.enum(['low', 'normal', 'high']).optional(),
  showTooltips: z.boolean().optional(),
  rulesJson: z.unknown().optional(),
});

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

  if (!isDbConfigured()) {
    return NextResponse.json(DEFAULT_SETTINGS);
  }

  try {
    const { getWalletByAddress, getSettings } = await import('@/lib/db/queries');
    const wallet = await getWalletByAddress(address);
    if (!wallet) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    const settings = await getSettings(wallet.id);
    if (!settings) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    return NextResponse.json({
      theme: settings.theme ?? DEFAULT_SETTINGS.theme,
      reducedMotion: settings.reducedMotion ?? DEFAULT_SETTINGS.reducedMotion,
      notifications: settings.notifications ?? DEFAULT_SETTINGS.notifications,
      voiceMode: settings.voiceMode ?? DEFAULT_SETTINGS.voiceMode,
      privacyLevel: settings.privacyLevel ?? DEFAULT_SETTINGS.privacyLevel,
      catReactivity: settings.catReactivity ?? DEFAULT_SETTINGS.catReactivity,
      showTooltips: settings.showTooltips ?? DEFAULT_SETTINGS.showTooltips,
      rulesJson: settings.rulesJson ?? DEFAULT_SETTINGS.rulesJson,
    });
  } catch (error) {
    console.error('[wallet/settings] GET error:', error);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const rateLimited = applyRateLimit(request);
  if (rateLimited) return rateLimited;

  const { address } = await params;

  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    return NextResponse.json({ error: 'Invalid Solana address.' }, { status: 400 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, stored: false, message: 'No database configured. Settings saved locally only.' });
  }

  try {
    const body = await request.json();
    const parsed = settingsUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { findOrCreateWallet, upsertSettings } = await import('@/lib/db/queries');
    const wallet = await findOrCreateWallet(address);
    await upsertSettings(wallet.id, parsed.data);

    return NextResponse.json({ ok: true, stored: true });
  } catch (error) {
    console.error('[wallet/settings] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to save settings.' },
      { status: 500 }
    );
  }
}
