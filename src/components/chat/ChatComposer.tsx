'use client';

/**
 * ChatComposer — Game command bar input dock.
 * Elevated, sticky, focus bloom, Enter sends, Shift+Enter newline.
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fastSpring, press } from '@/lib/motion';
import { Send, Square } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  placeholder: string;
}

export default function ChatComposer({ onSend, onStop, isStreaming, placeholder }: Props) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    onSend(input.trim());
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
  }, [input, isStreaming, onSend]);

  return (
    <div className="p-3" style={{ borderTop: '1px solid var(--stroke2)' }}>
      <motion.div
        animate={{
          boxShadow: focused
            ? `0 0 0 1px var(--accent), var(--sh-surface)`
            : `0 0 0 1px var(--stroke), var(--sh-surface)`,
        }}
        transition={fastSpring}
        className="flex gap-2 items-end rounded p-2"
        style={{ background: 'var(--bg2)' }}
      >
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); const t = e.target; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent text-[13px] px-2 py-1.5 focus:outline-none"
          style={{ color: 'var(--text)', minHeight: 40, maxHeight: 120 }}
        />

        {isStreaming ? (
          <motion.button onClick={onStop}
            className="flex items-center justify-center w-8 h-8 rounded flex-shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }} {...press}>
            <Square className="w-3.5 h-3.5" />
          </motion.button>
        ) : (
          <motion.button onClick={submit} disabled={!input.trim()}
            className="flex items-center justify-center w-8 h-8 rounded flex-shrink-0 disabled:opacity-20"
            style={{ background: input.trim() ? 'var(--accent)' : 'var(--stroke)', color: input.trim() ? '#fff' : 'var(--ghost)' }}
            {...press}>
            <Send className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </motion.div>
      <p className="text-[8px] text-center mt-1" style={{ color: 'var(--ghost)' }}>Not financial advice</p>
    </div>
  );
}


