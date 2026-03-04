/**
 * Session mode — tracks active trading sessions.
 *
 * While a session is active:
 * - Tilt score is computed in real-time
 * - "Next Best Action" prompts are generated
 * - Duration is tracked
 *
 * All client-side, localStorage-backed.
 */

const SESSION_KEY = 'psych_session';

export interface TradingSession {
  startedAt: number;
  endedAt?: number;
  tradeCount: number;
  tiltPeak: number;
  notes: string[];
}

export interface ActiveSession {
  startedAt: number;
  tradeCount: number;
  tiltScore: number;
}

export function startSession(): ActiveSession {
  const session: ActiveSession = {
    startedAt: Date.now(),
    tradeCount: 0,
    tiltScore: 0,
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

export function getActiveSession(): ActiveSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function updateSession(updates: Partial<ActiveSession>): void {
  const current = getActiveSession();
  if (!current) return;
  const updated = { ...current, ...updates };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
}

export function endSession(): TradingSession | null {
  const current = getActiveSession();
  if (!current) return null;
  localStorage.removeItem(SESSION_KEY);
  return {
    startedAt: current.startedAt,
    endedAt: Date.now(),
    tradeCount: current.tradeCount,
    tiltPeak: current.tiltScore,
    notes: [],
  };
}

/**
 * Get "Next Best Action" based on tilt score.
 */
export function getNextAction(tiltScore: number): { action: string; urgency: 'low' | 'medium' | 'high' } {
  if (tiltScore >= 70) return { action: 'Stop trading. Take a 15-minute break.', urgency: 'high' };
  if (tiltScore >= 50) return { action: 'Reduce position size by 50%.', urgency: 'medium' };
  if (tiltScore >= 30) return { action: 'Breathe for 20 seconds before next trade.', urgency: 'medium' };
  if (tiltScore >= 15) return { action: 'Check your rules before entering.', urgency: 'low' };
  return { action: 'You\'re disciplined. Stay focused.', urgency: 'low' };
}
