/**
 * POST /api/chat/market
 *
 * Streaming AI market psychology chat endpoint.
 * Discusses Solana macro sentiment and crowd behavior.
 * Uses real market data from Birdeye when available.
 */

import { chatMessageSchema, sanitizeInput } from '@/lib/security/validation';
import { applyRateLimit } from '@/lib/security/rate-limit';
import { buildMarketSystemPrompt } from '@/lib/ai/prompts/market';
import { fetchMarketMood } from '@/lib/solana/market';
import { isDbConfigured } from '@/lib/db';
import type { AIMessage } from '@/lib/ai/client';

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

    // Use real market mood from Birdeye, fall back to client-provided mood
    let marketMood = await fetchMarketMood().catch(() => null);
    if (!marketMood && body.marketMood) {
      marketMood = body.marketMood;
    }

    const systemPrompt = buildMarketSystemPrompt(marketMood);

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (body.history && Array.isArray(body.history)) {
      for (const msg of body.history.slice(-10)) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    messages.push({ role: 'user', content: cleanMessage });

    let threadId: number | undefined;
    if (walletAddress && isDbConfigured()) {
      try {
        const { getWalletByAddress, findOrCreateThread, addChatMessage } = await import('@/lib/db/queries');
        const wallet = await getWalletByAddress(walletAddress);
        if (wallet) {
          const thread = await findOrCreateThread(wallet.id, 'market');
          threadId = thread.id;
          await addChatMessage(threadId, 'user', cleanMessage);
        }
      } catch (dbError) {
        console.warn('[chat/market] DB storage failed:', dbError);
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const { streamChatCompletion } = await import('@/lib/ai/client');

        try {
          const fullResponse = await streamChatCompletion({
            messages,
            temperature: 0.6,
            maxTokens: 1500,
            onToken: (token) => {
              const data = JSON.stringify({ token, done: false });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            },
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));

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
    console.error('[chat/market] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Chat service unavailable' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
