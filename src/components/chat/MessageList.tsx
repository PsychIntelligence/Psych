'use client';

/**
 * MessageList — Bottom-aligned scrollable message stream.
 *
 * Messages stack from the bottom upward. Older messages at the top
 * fade out via the parent's CSS mask-image gradient.
 *
 * Features:
 * - Slide-in per message from bottom
 * - Scanline shimmer on active streaming message
 * - Streaming cursor blink in accent color
 * - Copy action on hover
 * - Max width 72ch for readability
 * - flex-col-reverse for natural bottom alignment
 */

import React, { useRef, useEffect, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { hudSpring } from '@/lib/motion';
import type { ChatMessage } from '@/types';
import { Copy, Check } from 'lucide-react';

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const Bubble = memo(function Bubble({
  msg, isLast, isStreaming,
}: {
  msg: ChatMessage; isLast: boolean; isStreaming: boolean;
}) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const [hover, setHover] = useState(false);
  const isActive = !isUser && isStreaming && isLast;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(msg.content.replace(/\[SENTIMENT:\s*\w+\]/g, '').trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={hudSpring}
      className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative" style={{ maxWidth: '72ch' }}>
        <div
          className={`rounded px-4 py-2.5 text-[13px] leading-[1.65] ${isActive ? 'scanline' : ''}`}
          style={isUser ? {
            background: 'var(--accent)',
            color: '#fff',
            borderBottomRightRadius: 4,
          } : {
            background: 'var(--surface2)',
            color: 'var(--text)',
            border: '1px solid var(--stroke2)',
            borderBottomLeftRadius: 4,
          }}
        >
          {msg.content.split('\n').map((line, i) => {
            const c = line.replace(/\[SENTIMENT:\s*\w+\]/g, '').trim();
            if (!c) return <br key={i} />;
            const h = c.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--accent)">$1</strong>');
            return <p key={i} dangerouslySetInnerHTML={{ __html: h }} />;
          })}

          {isActive && (
            <motion.span
              className="inline-block w-[2px] h-3.5 ml-0.5 align-middle rounded-full"
              style={{ background: 'var(--accent)' }}
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.4, repeat: Infinity }}
            />
          )}
        </div>

        {/* Timestamp */}
        <span className="block text-[8px] mt-1 px-1" style={{ color: 'var(--ghost)', textAlign: isUser ? 'right' : 'left' }}>
          {formatRelativeTime(msg.timestamp)}
        </span>

        {!isUser && hover && !isStreaming && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'var(--surface2)', border: '1px solid var(--stroke)', boxShadow: 'var(--sh-surface)' }}
            onClick={handleCopy}
          >
            {copied
              ? <Check className="w-3 h-3" style={{ color: 'var(--success)' }} />
              : <Copy className="w-3 h-3" style={{ color: 'var(--muted)' }} />
            }
          </motion.button>
        )}
      </div>
    </motion.div>
  );
});

export default function MessageList({
  messages, isStreaming,
}: {
  messages: ChatMessage[]; isStreaming: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return <div className="flex-1" />;
  }

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto custom-scroll flex flex-col justify-end px-4 py-3"
    >
      {/* Spacer pushes content to bottom when few messages */}
      <div className="flex-1 min-h-0" />

      {/* Messages */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <Bubble
              key={m.id}
              msg={m}
              isLast={i === messages.length - 1}
              isStreaming={isStreaming}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}


