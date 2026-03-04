/**
 * POST /api/chat/coach
 *
 * Streaming AI coaching chat endpoint.
 * Automatically loads wallet analytics from DB and injects into system prompt.
 * Stores completed messages in DB.
 */

import { chatMessageSchema, sanitizeInput } from '@/lib/security/validation';
import { applyRateLimit } from '@/lib/security/rate-limit';
import { createSSEStream } from '@/lib/ai/client';
import { buildCoachSystemPrompt } from '@/lib/ai/prompts/coach';
import { buildMemoryContext, addMemory } from '@/lib/ai/memory';
import { isDbConfigured } from '@/lib/db';
import { computePnL } from '@/lib/analytics/pnl';
import { analyzeTradesPsychology } from '@/lib/analytics/psychology';
import type { AIMessage } from '@/lib/ai/client';
import type { PnLSummary, BehaviorSignal, TradingRule } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rateLimited = applyRateLimit(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = chatMessageSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0].message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { message, walletAddress } = parsed.data;
    const cleanMessage = sanitizeInput(message);
    const userId = walletAddress ?? 'anonymous';

    // ── Load wallet context from DB (server-side, automatic) ──
    let pnlSummary: PnLSummary | undefined;
    let signals: BehaviorSignal[] | undefined;
    let rules: TradingRule[] | undefined;
    let threadId: number | undefined;

    if (walletAddress && isDbConfigured()) {
      try {
        const { getWalletByAddress, getSwaps, getSettings, findOrCreateThread } = await import('@/lib/db/queries');

        const wallet = await getWalletByAddress(walletAddress);
        if (wallet) {
          // Load swaps and compute fresh analytics
          const trades = await getSwaps(wallet.id, { limit: 500 });
          if (trades.length > 0) {
            pnlSummary = computePnL(trades, 30); // Default 30d window
            signals = analyzeTradesPsychology(trades);
          }

          // Load saved rules from settings
          const settings = await getSettings(wallet.id);
          if (settings?.rulesJson && Array.isArray(settings.rulesJson)) {
            rules = settings.rulesJson as TradingRule[];
          }

          // Get or create thread for message storage
          const thread = await findOrCreateThread(wallet.id, 'coach');
          threadId = thread.id;
        }
      } catch (dbError) {
        console.warn('[chat/coach] DB context load failed, continuing without:', dbError);
      }
    }

    // Fall back to client-provided context if DB didn't have data
    if (!pnlSummary && body.pnlContext) pnlSummary = body.pnlContext;
    if (!signals && body.signals) signals = body.signals;
    if (!rules && body.rules) rules = body.rules;

    // Recent trades for prompt context
    const recentTrades = body.recentTrades as { pair: string; side: string; source: string; priceUsd: number; timestamp: number }[] | undefined;
    const dexBreakdown = body.dexBreakdown as Record<string, number> | undefined;

    // Build system prompt with trading context
    const memoryContext = buildMemoryContext(userId, cleanMessage);
    const systemPrompt = buildCoachSystemPrompt({
      pnlSummary,
      signals,
      rules,
      memoryContext,
      recentTrades,
      dexBreakdown,
    });

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Include conversation history
    if (body.history && Array.isArray(body.history)) {
      for (const msg of body.history.slice(-10)) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    messages.push({ role: 'user', content: cleanMessage });

    // Store in memory for future context
    addMemory(userId, 'insight', `User asked: ${cleanMessage.slice(0, 100)}`);

    // Store user message in DB
    if (threadId && isDbConfigured()) {
      import('@/lib/db/queries').then(q => {
        q.addChatMessage(threadId!, 'user', cleanMessage).catch(() => {});
      });
    }

    // Create streaming response, capture full text for storage
    let fullResponse = '';
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const { streamChatCompletion } = await import('@/lib/ai/client');

        try {
          fullResponse = await streamChatCompletion({
            messages,
            temperature: 0.7,
            maxTokens: 1500,
            onToken: (token) => {
              fullResponse += ''; // tracked via return value
              const data = JSON.stringify({ token, done: false });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));

          // Store assistant response in DB
          if (threadId && isDbConfigured()) {
            import('@/lib/db/queries').then(q => {
              q.addChatMessage(threadId!, 'assistant', fullResponse).catch(() => {});
            });
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg, done: true })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[chat/coach] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Chat service unavailable' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
