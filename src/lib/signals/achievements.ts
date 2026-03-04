/**
 * Achievements system — tasteful behavioral milestones.
 *
 * Stored in localStorage. Checked after each wallet load.
 */

import type { BehaviorLabel, LabeledTrade } from './labels';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji or lucide icon name
  unlockedAt?: number; // unix ms, undefined = locked
}

const ACHIEVEMENT_DEFS: Omit<Achievement, 'unlockedAt'>[] = [
  { id: 'first_lookup', title: 'First Look', description: 'Analyzed your first wallet.', icon: '👁' },
  { id: 'discipline_3', title: 'Discipline Streak', description: '3 consecutive disciplined trades.', icon: '🎯' },
  { id: 'no_revenge_7d', title: 'Cool Head', description: 'No revenge trading for 7 days.', icon: '🧊' },
  { id: 'size_consistent', title: 'Steady Hand', description: 'Consistent position sizing (5+ trades).', icon: '⚖️' },
  { id: 'debrief_first', title: 'Self-Aware', description: 'Completed your first debrief.', icon: '📋' },
  { id: 'session_first', title: 'Session Player', description: 'Completed your first trading session.', icon: '🎮' },
  { id: 'streak_7d', title: 'Week Warrior', description: '7-day check-in streak.', icon: '🔥' },
  { id: 'rules_active_3', title: 'Rule Keeper', description: '3 guardrails active simultaneously.', icon: '🛡' },
];

const STORAGE_KEY = 'psych_achievements';

export function loadAchievements(): Achievement[] {
  if (typeof window === 'undefined') return ACHIEVEMENT_DEFS.map(d => ({ ...d }));
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return ACHIEVEMENT_DEFS.map(d => ({
      ...d,
      unlockedAt: stored[d.id] ?? undefined,
    }));
  } catch {
    return ACHIEVEMENT_DEFS.map(d => ({ ...d }));
  }
}

export function unlockAchievement(id: string): Achievement | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (stored[id]) return null; // already unlocked
    stored[id] = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const def = ACHIEVEMENT_DEFS.find(d => d.id === id);
    return def ? { ...def, unlockedAt: stored[id] } : null;
  } catch {
    return null;
  }
}

/**
 * Check which achievements should be unlocked based on current data.
 */
export function checkAchievements(labeled: LabeledTrade[], activeRuleCount: number): string[] {
  const unlocks: string[] = [];

  // first_lookup: always on first load
  unlocks.push('first_lookup');

  // discipline_3: 3 consecutive discipline labels
  let streak = 0;
  for (const t of labeled) {
    if (t.label === 'discipline') { streak++; if (streak >= 3) { unlocks.push('discipline_3'); break; } }
    else streak = 0;
  }

  // no_revenge_7d: no revenge in last 7 days
  const weekAgo = Date.now() - 7 * 86400_000;
  const recentRevenge = labeled.filter(t => t.timestamp > weekAgo && t.label === 'revenge');
  if (recentRevenge.length === 0 && labeled.length > 5) {
    unlocks.push('no_revenge_7d');
  }

  // size_consistent: std dev of last 5 sizes < 30% of mean
  const last5 = labeled.slice(-5);
  if (last5.length >= 5) {
    const sizes = last5.map(t => t.priceUsd);
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / sizes.length;
    if (Math.sqrt(variance) / mean < 0.3) unlocks.push('size_consistent');
  }

  // rules_active_3
  if (activeRuleCount >= 3) unlocks.push('rules_active_3');

  return unlocks;
}

// ── Daily check-in (mood tracking) ──────────────────────────

const CHECKIN_KEY = 'psych_checkins';

export interface DailyCheckIn {
  date: string; // YYYY-MM-DD
  mood: number; // 1-5
}

export function saveCheckIn(mood: number): void {
  if (typeof window === 'undefined') return;
  const date = new Date().toISOString().split('T')[0];
  try {
    const stored: DailyCheckIn[] = JSON.parse(localStorage.getItem(CHECKIN_KEY) ?? '[]');
    const existing = stored.findIndex(c => c.date === date);
    if (existing >= 0) stored[existing].mood = mood;
    else stored.push({ date, mood });
    // Keep last 90 days
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const filtered = stored.filter(c => c.date >= cutoff.toISOString().split('T')[0]);
    localStorage.setItem(CHECKIN_KEY, JSON.stringify(filtered));
  } catch { /* ignore */ }
}

export function loadCheckIns(): DailyCheckIn[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(CHECKIN_KEY) ?? '[]');
  } catch { return []; }
}

export function getStreakDays(): number {
  const checkins = loadCheckIns();
  if (checkins.length === 0) return 0;
  const sorted = checkins.sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    if (sorted.some(c => c.date === key)) streak++;
    else break;
  }
  return streak;
}
