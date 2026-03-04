'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Panel from '@/components/ui/Panel';
import { stagger, staggerItem } from '@/lib/motion';
import { ArrowLeft, Shield, Eye, Zap, HelpCircle, Globe } from 'lucide-react';

const SECTIONS = [
  { icon: Eye, title: 'What is psych?', content: 'psych is an on-chain behavioral analytics tool for Solana traders. It reads your public swap history, identifies psychological trading patterns, and provides AI-powered coaching.\n\nWe analyze behavior, not markets.' },
  { icon: Zap, title: 'How does it work?', content: '1. Paste your Solana wallet or .sol name.\n2. We fetch swaps via Helius.\n3. 16+ behavioral patterns detected.\n4. Dashboard + AI coaching.' },
  { icon: Globe, title: 'Supported DEXes', content: 'Jupiter (v4+v6), Raydium (AMM/CLMM/CPMM), Orca Whirlpool, Meteora (DLMM/Pools), Pump.fun.' },
  { icon: Shield, title: 'Privacy', content: 'Public on-chain data only. No private keys. No exchange keys. Export or delete anytime.' },
  { icon: HelpCircle, title: 'FAQ', content: '**Financial advice?** No. Behavioral analysis only.\n\n**Why Solana?** Fastest DEX ecosystem with fully parseable on-chain swap data.\n\n**CEX trades?** Off-chain — not visible from wallet address.' },
];

export default function DocsPage() {
  return (
    <div className="max-w-xl mx-auto px-5 py-12">
      <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-medium mb-8" style={{ color: 'var(--muted)' }}>
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </Link>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.h1 variants={staggerItem} className="font-serif text-2xl tracking-tight" style={{ color: 'var(--text)' }}>Documentation</motion.h1>
        <div className="mt-6 space-y-4">
          {SECTIONS.map(({ icon: Icon, title, content }) => (
            <motion.div key={title} variants={staggerItem}>
              <Panel>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.6} style={{ color: 'var(--accent)' }} />
                  <h2 className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
                </div>
                <div className="text-[12px] leading-[1.7] whitespace-pre-line" style={{ color: 'var(--text2)' }}>
                  {content.split('\n').map((l, i) => {
                    const h = l.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text)">$1</strong>');
                    return <p key={i} className="mb-0.5" dangerouslySetInnerHTML={{ __html: h }} />;
                  })}
                </div>
              </Panel>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
