/**
 * Cat State Resolver — filename-driven expression mapping.
 *
 * Scans manifest items, classifies by keyword patterns,
 * builds { idle: [...], talk: [...], angry: [...], ... } map.
 * Provides chooseCatExpression() for runtime state selection.
 */

export type CatExpression =
  | 'idle' | 'talking' | 'angry' | 'disappointed'
  | 'excited' | 'happy' | 'sad' | 'neutral'
  | 'alert' | 'warning';

export interface ResolvedAsset {
  base: string;
  talk: string;
}

export interface CatStateMap {
  states: Map<CatExpression, ResolvedAsset>;
  hasAssets: boolean;
}

const FILENAME_MAP: { expr: CatExpression; patterns: RegExp[] }[] = [
  { expr: 'idle',         patterns: [/idle/i, /default/i, /rest/i] },
  { expr: 'angry',        patterns: [/angry/i, /mad/i, /rage/i] },
  { expr: 'disappointed', patterns: [/despair/i, /disappoint/i] },
  { expr: 'excited',      patterns: [/excite/i, /hype/i] },
  { expr: 'happy',        patterns: [/heart/i, /happy/i, /joy/i, /smile/i, /love/i] },
  { expr: 'sad',          patterns: [/sad/i, /cry/i] },
  { expr: 'neutral',      patterns: [/sleep/i, /neutral/i, /calm/i, /focus/i, /think/i] },
  { expr: 'alert',        patterns: [/alert/i, /warn/i, /attention/i, /glance/i] },
];

interface ManifestAsset {
  url: string;
  stem: string;
  renderable: boolean;
  isTalkVariant: boolean;
}

export function buildStateMap(assets: ManifestAsset[]): CatStateMap {
  const renderable = assets.filter(a => a.renderable);
  const states = new Map<CatExpression, ResolvedAsset>();

  for (const rule of FILENAME_MAP) {
    const base = renderable.find(a => !a.isTalkVariant && rule.patterns.some(p => p.test(a.stem)));
    const talk = renderable.find(a => a.isTalkVariant && rule.patterns.some(p => p.test(a.stem)));
    if (base) {
      states.set(rule.expr, { base: base.url, talk: talk?.url ?? base.url });
    }
  }

  // talking = idle talk variant
  if (!states.has('talking')) {
    const idle = states.get('idle');
    if (idle) states.set('talking', { base: idle.talk, talk: idle.talk });
  }

  // alert/warning fallback to angry
  if (!states.has('alert') && states.has('angry')) states.set('alert', states.get('angry')!);
  if (!states.has('warning') && states.has('angry')) states.set('warning', states.get('angry')!);

  return { states, hasAssets: states.size > 0 };
}

export function resolveAsset(map: CatStateMap, expr: CatExpression, isTalking: boolean): string | null {
  const r = map.states.get(expr) ?? map.states.get('idle');
  if (!r) {
    const first = map.states.values().next().value;
    if (!first) return null;
    return isTalking ? first.talk : first.base;
  }
  return isTalking ? r.talk : r.base;
}

/**
 * Choose the cat expression based on current app state.
 *
 * Priority:
 *   1) severity === 'critical' → angry
 *   2) streaming === true → talking
 *   3) assistantText provided → sentiment analysis
 *   4) fallback → idle
 *
 * Always returns a CatExpression that is available in the state map
 * (falls back to idle if the chosen expression has no asset).
 */
export function chooseCatExpression(opts: {
  streaming: boolean;
  assistantText?: string;
  severity?: 'critical' | 'warning' | 'info' | null;
  sentimentFn: (text: string) => CatExpression;
  stateMap: CatStateMap;
}): { expression: CatExpression; isTalking: boolean } {
  const { streaming, assistantText, severity, sentimentFn, stateMap } = opts;

  // Critical alert overrides everything
  if (severity === 'critical') {
    const expr: CatExpression = stateMap.states.has('angry') ? 'angry' : 'alert';
    return { expression: expr, isTalking: false };
  }

  // Streaming → talk state
  if (streaming) {
    return { expression: 'talking', isTalking: true };
  }

  // Post-message → sentiment
  if (assistantText && assistantText.length > 10) {
    const sentiment = sentimentFn(assistantText);
    // Verify asset exists, fall back to idle
    if (stateMap.states.has(sentiment)) {
      return { expression: sentiment, isTalking: false };
    }
  }

  return { expression: 'idle', isTalking: false };
}
