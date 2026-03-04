/**
 * Keyword + heuristic sentiment mapper.
 * Runs on final assistant message text. Returns CatExpression.
 */

import type { CatExpression } from '@/lib/cat/stateResolver';

const NEG = [
  /revenge\s*trad/i, /tilt/i, /over\s*trad/i, /loss\s*avers/i,
  /fomo/i, /drawdown/i, /consecutive\s*loss/i, /risk\s*escalat/i,
  /stop\s*trad/i, /step\s*away/i, /discipline.*problem/i,
  /not\s*good/i, /poor/i, /dangerous/i, /destructive/i,
  /\bstop\b/i, /\bbad\b/i, /\bworse\b/i,
];

const STERN = [
  /must\s*stop/i, /no\s*exception/i, /critical/i, /immediately/i,
  /right\s*now/i, /walk\s*away/i, /close.*chart/i,
];

const POS = [
  /disciplin/i, /improv/i, /good\s*(job|work|sign)/i,
  /strong/i, /profit/i, /\bwin/i, /consistent/i,
  /well\s*done/i, /rare\s*praise/i, /keep\s*it\s*up/i,
];

const CALM = [
  /analyz/i, /pattern/i, /observ/i, /notice/i,
  /suggest/i, /recommend/i, /consider/i, /data\s*shows/i,
];

export function resolveSentiment(text: string): CatExpression {
  // Explicit tag from AI prompt system
  const tag = text.match(/\[SENTIMENT:\s*(\w+)\]/);
  if (tag) {
    const s = tag[1].toLowerCase();
    if (s === 'angry' || s === 'strict') return 'angry';
    if (s === 'disappointed') return 'disappointed';
    if (s === 'supportive' || s === 'playful') return 'happy';
  }

  let neg = 0, stern = 0, pos = 0, calm = 0;
  for (const p of NEG) if (p.test(text)) neg++;
  for (const p of STERN) if (p.test(text)) stern++;
  for (const p of POS) if (p.test(text)) pos++;
  for (const p of CALM) if (p.test(text)) calm++;

  if (stern >= 2 || (neg >= 3 && stern >= 1)) return 'angry';
  if (neg >= 2) return 'disappointed';
  if (neg >= 1 && pos === 0) return 'sad';
  if (pos >= 3) return 'excited';
  if (pos >= 1) return 'happy';
  if (calm >= 2) return 'neutral';
  return 'idle';
}
