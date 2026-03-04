'use client';

/**
 * DialogueConsole — Cat Stage + Message Lane + Composer Dock.
 *
 * CSS Grid: 3 rows.
 *   Row 1: CatStage (1fr — fills ~60-65% of panel)
 *   Row 2: MessageLane (clamped height, bottom-aligned, top-masked)
 *   Row 3: ComposerDock (auto)
 *
 * The cat is the IMMERSIVE BACKDROP. Messages do NOT cover it.
 * Messages appear from the bottom and older ones fade out at the top
 * via CSS mask-image gradient.
 *
 * Expression switching:
 *   streaming → talk
 *   post-message → sentiment(lastAssistantText)
 *   severity=critical → angry
 *   default → idle
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CatCompanion from '@/components/cat/CatCompanion';
import MessageList from './MessageList';
import ChatComposer from './ChatComposer';
import { chooseCatExpression } from '@/lib/cat/stateResolver';
import { resolveSentiment } from '@/lib/chat/sentiment';
import { useCatEmotion } from '@/components/cat/CatEmotionProvider';
import { press } from '@/lib/motion';
import type { ChatMessage, ChatMode } from '@/types';
import { Sparkles } from 'lucide-react';

interface DialogueConsoleProps {
  mode: ChatMode;
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  hudPanel: React.ReactNode;
  quickActions: string[];
  emptyHint: string;
}

export default function DialogueConsole({
  mode, messages, isStreaming, onSend, onStop, hudPanel, quickActions, emptyHint,
}: DialogueConsoleProps) {
  const isEmpty = messages.length === 0;
  const { assetMap } = useCatEmotion();

  // Get the last assistant message text for sentiment analysis
  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].content.length > 10) {
        return messages[i].content;
      }
    }
    return undefined;
  }, [messages]);

  // Build a minimal state map for chooseCatExpression
  const stateMap = useMemo(() => {
    if (!assetMap) return { states: new Map(), hasAssets: false };
    // assetMap.assets is Map<CatEmotion, CatAssetWithTalk>
    // We need to convert to the stateResolver's CatStateMap format
    const states = new Map<string, { base: string; talk: string }>();
    for (const [key, val] of assetMap.assets.entries()) {
      states.set(key, { base: val.src, talk: val.talkSrc ?? val.src });
    }
    return { states: states as Map<import('@/lib/cat/stateResolver').CatExpression, { base: string; talk: string }>, hasAssets: states.size > 0 };
  }, [assetMap]);

  // Resolve expression
  const { expression, isTalking } = useMemo(() => {
    return chooseCatExpression({
      streaming: isStreaming,
      assistantText: lastAssistantText,
      severity: null,
      sentimentFn: resolveSentiment,
      stateMap,
    });
  }, [isStreaming, lastAssistantText, stateMap]);

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3 max-w-[1400px] mx-auto w-full px-4 py-3 overflow-hidden"
      style={{ height: 'calc(100vh - 2.75rem)' }}
    >
      {/* ── Left: Conversation panel — 3-row grid ───────────── */}
      <div
        className="min-h-0 overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateRows: 'minmax(0, 1fr) minmax(180px, 1fr) auto',
          background: `linear-gradient(180deg, var(--surface-hl), transparent 30%), var(--surface)`,
          border: '1px solid var(--stroke)',
          boxShadow: 'var(--sh-inset), var(--sh-surface)',
          borderRadius: 'var(--r)',
        }}
      >
        {/* ─── Row 1: Cat Stage ────────────────────────────── */}
        <div className="relative flex flex-col items-center justify-center overflow-hidden min-h-0">
          {/* Spotlight vignette behind cat */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 50% 60% at 50% 45%, var(--accent-dim) 0%, transparent 70%)',
            }}
          />

          {/* Cat — fills the stage */}
          <div className="relative z-10 flex items-center justify-center" style={{ width: '100%', height: '75%' }}>
            <CatCompanion
              size="stage"
              isTalking={isTalking}
              overrideExpression={expression}
            />
          </div>

          {/* Intro overlay — only when empty, sits below cat */}
          <AnimatePresence>
            {isEmpty && (
              <motion.div
                initial={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
                transition={{ duration: 0.3 }}
                className="relative z-10 flex flex-col items-center gap-3 px-6 pb-4"
              >
                <p className="text-[13px] text-center max-w-sm" style={{ color: 'var(--text2)' }}>
                  {emptyHint}
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {quickActions.map((a) => (
                    <motion.button
                      key={a}
                      onClick={() => onSend(a)}
                      className="px-3 py-1.5 rounded-full text-[10px] font-medium"
                      style={{ border: '1px solid var(--stroke)', color: 'var(--text2)', background: 'transparent' }}
                      {...press}
                    >
                      <Sparkles className="inline w-2.5 h-2.5 mr-1 opacity-40" />{a}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Row 2: Message Lane (bottom-aligned, top-masked) */}
        <div
          className="min-h-0 relative"
          style={{
            borderTop: '1px solid var(--stroke2)',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 100%)',
          }}
        >
          <MessageList messages={messages} isStreaming={isStreaming} />
        </div>

        {/* ─── Row 3: Composer Dock ──────────────────────────── */}
        <ChatComposer
          onSend={onSend}
          onStop={onStop}
          isStreaming={isStreaming}
          placeholder={mode === 'coach' ? 'Ask about your trading psychology...' : 'Ask about market sentiment...'}
        />
      </div>

      {/* ── Right: HUD panel ─────────────────────────────────── */}
      <div className="hidden lg:flex flex-col gap-2.5 min-h-0 overflow-y-auto custom-scroll">
        {hudPanel}
      </div>
    </div>
  );
}

