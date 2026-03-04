'use client';

/**
 * Hook for streaming AI chat with the cat companion.
 */

import { useCallback, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useCatEmotion } from '@/components/cat/CatEmotionProvider';
import { nanoid } from 'nanoid';
import type { ChatMode, CatEmotion, ChatMessage } from '@/types';

export function useChat(mode: ChatMode) {
  const {
    coachMessages,
    marketMessages,
    addChatMessage,
    addMarketMessage,
    updateLastMessage,
    setIsChatStreaming,
    isChatStreaming,
    pnlWindows,
    activeWindow,
    signals,
    rules,
    wallet,
    marketMood,
    trades,
    dexBreakdown,
  } = useAppStore();

  const { trigger } = useCatEmotion();
  const abortRef = useRef<AbortController | null>(null);

  const messages = mode === 'coach' ? coachMessages : marketMessages;
  const addMessage = mode === 'coach' ? addChatMessage : addMarketMessage;

  const send = useCallback(async (content: string) => {
    if (!content.trim() || isChatStreaming) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };
    addMessage(userMessage);

    // Add placeholder for assistant response
    const assistantMessage: ChatMessage = {
      id: nanoid(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    addMessage(assistantMessage);

    setIsChatStreaming(true);
    trigger({ type: 'chat_streaming' });

    abortRef.current = new AbortController();

    try {
      const endpoint = mode === 'coach' ? '/api/chat/coach' : '/api/chat/market';

      const body: Record<string, unknown> = {
        message: content.trim(),
        mode,
        walletAddress: wallet?.address,
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      };

      if (mode === 'coach') {
        body.pnlContext = pnlWindows[activeWindow];
        body.signals = signals;
        body.rules = rules;
        body.dexBreakdown = dexBreakdown;
        body.recentTrades = trades.slice(0, 10).map(t => ({
          pair: t.pair, side: t.side, source: t.source,
          priceUsd: t.priceUsd, timestamp: t.timestamp,
        }));
      } else {
        body.marketMood = marketMood;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.token) {
              fullResponse += data.token;
              updateLastMessage(mode, data.token);
              trigger({ type: 'chat_streaming' });
            }

            if (data.done) {
              // Parse sentiment tag from response
              const sentimentMatch = fullResponse.match(/\[SENTIMENT:\s*(\w+)\]/);
              if (sentimentMatch) {
                const sentiment = sentimentMatch[1] as 'supportive' | 'strict' | 'disappointed' | 'playful' | 'angry';
                trigger({ type: 'chat_sentiment', sentiment });
              } else {
                trigger({ type: 'chat_complete' });
              }
            }
          } catch {
            // Skip malformed SSE data
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('[useChat] Error:', error);
      updateLastMessage(mode, '\n\n*Connection lost. Please try again.*');
      trigger({ type: 'error' });
    } finally {
      setIsChatStreaming(false);
    }
  }, [mode, messages, addMessage, updateLastMessage, setIsChatStreaming, isChatStreaming, trigger, wallet, pnlWindows, activeWindow, signals, rules, marketMood, trades, dexBreakdown]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsChatStreaming(false);
  }, [setIsChatStreaming]);

  return { messages, send, stop, isStreaming: isChatStreaming };
}
