/**
 * CatStateMachine: Maps UI events, data states, and chat sentiment
 * to cat emotion states with priority, duration, and transition logic.
 *
 * Priority system prevents low-priority emotions from interrupting
 * high-priority ones (e.g., an alert won't be overridden by idle).
 */

import type { CatEmotion, CatState, BehaviorSignal, SignalSeverity } from '@/types';

// ── Priority map (higher = more important) ──────────────────────

const EMOTION_PRIORITY: Record<CatEmotion, number> = {
  idle: 0,
  neutral: 0,
  happy: 1,
  smug: 1,
  talking: 2,
  excited: 3,
  sad: 3,
  disappointed: 3,
  alert: 4,
  warning: 5,
  angry: 6,
};

// ── Default durations (ms) before returning to idle ──────────────

const EMOTION_DURATION: Record<CatEmotion, number> = {
  idle: Infinity,
  neutral: Infinity,
  happy: 3000,
  smug: 4000,
  talking: 500, // refreshed per token during streaming
  excited: 2500,
  sad: 5000,
  disappointed: 4000,
  alert: 3000,
  warning: 5000,
  angry: 4000,
};

// ── Transition config ────────────────────────────────────────────

const TRANSITION_DURATION = 200; // ms for crossfade between emotions

export type EmotionTrigger =
  | { type: 'ui_hover' }
  | { type: 'ui_click' }
  | { type: 'loading' }
  | { type: 'success' }
  | { type: 'error' }
  | { type: 'chat_streaming' }
  | { type: 'chat_complete' }
  | { type: 'profit_streak'; count: number }
  | { type: 'drawdown'; percent: number }
  | { type: 'overtrading' }
  | { type: 'leverage_spike' }
  | { type: 'win'; amount: number }
  | { type: 'loss'; amount: number }
  | { type: 'behavior_signal'; signal: BehaviorSignal }
  | { type: 'chat_sentiment'; sentiment: 'supportive' | 'strict' | 'disappointed' | 'playful' | 'angry' }
  | { type: 'idle' }
  | { type: 'custom'; emotion: CatEmotion; intensity?: number; duration?: number };

export type StateChangeCallback = (state: CatState) => void;

export class CatStateMachine {
  private currentState: CatState;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<StateChangeCallback> = new Set();
  private transitionStart = 0;
  private reducedMotion = false;
  private reactivityScale = 1.0;

  constructor(initialEmotion: CatEmotion = 'idle') {
    this.currentState = {
      emotion: initialEmotion,
      intensity: 0.5,
      isTransitioning: false,
    };
  }

  getState(): CatState {
    return { ...this.currentState };
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  setReactivity(level: 'low' | 'normal' | 'high'): void {
    this.reactivityScale = level === 'low' ? 0.5 : level === 'high' ? 1.5 : 1.0;
  }

  subscribe(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach(cb => cb(state));
  }

  private transitionTo(emotion: CatEmotion, intensity: number, duration?: number, message?: string): void {
    const currentPriority = EMOTION_PRIORITY[this.currentState.emotion];
    const newPriority = EMOTION_PRIORITY[emotion];

    // Don't interrupt higher-priority emotions (unless they've timed out)
    if (newPriority < currentPriority && this.currentState.emotion !== 'idle') {
      return;
    }

    // Clear any pending timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    // Start transition
    if (!this.reducedMotion && this.currentState.emotion !== emotion) {
      this.currentState.isTransitioning = true;
      this.transitionStart = Date.now();
      this.notify();

      setTimeout(() => {
        this.currentState = {
          emotion,
          intensity: Math.min(1, Math.max(0, intensity)),
          message,
          isTransitioning: false,
        };
        this.notify();
      }, TRANSITION_DURATION);
    } else {
      this.currentState = {
        emotion,
        intensity: Math.min(1, Math.max(0, intensity)),
        message,
        isTransitioning: false,
      };
      this.notify();
    }

    // Schedule return to idle — scale duration by reactivity
    const baseDuration = duration ?? EMOTION_DURATION[emotion];
    const scaledDuration = baseDuration === Infinity ? Infinity : Math.round(baseDuration * this.reactivityScale);
    if (scaledDuration !== Infinity) {
      this.timeoutId = setTimeout(() => {
        this.transitionTo('idle', 0.5);
      }, scaledDuration);
    }
  }

  /**
   * Process a trigger and update the cat's emotional state.
   */
  trigger(event: EmotionTrigger): void {
    switch (event.type) {
      case 'ui_hover':
        this.transitionTo('alert', 0.3, 1500);
        break;

      case 'ui_click':
        this.transitionTo('excited', 0.4, 800);
        break;

      case 'loading':
        this.transitionTo('neutral', 0.3);
        break;

      case 'success':
        this.transitionTo('happy', 0.7, 2500);
        break;

      case 'error':
        this.transitionTo('disappointed', 0.6, 3000);
        break;

      case 'chat_streaming':
        this.transitionTo('talking', 0.6, 800);
        break;

      case 'chat_complete':
        this.transitionTo('happy', 0.5, 2000);
        break;

      case 'profit_streak':
        if (event.count >= 5) {
          this.transitionTo('excited', 0.9, 4000, 'Discipline pays.');
        } else if (event.count >= 3) {
          this.transitionTo('smug', 0.7, 3000);
        } else {
          this.transitionTo('happy', 0.5, 2000);
        }
        break;

      case 'drawdown':
        if (event.percent > 20) {
          this.transitionTo('angry', 0.9, 6000, 'Step away. Now.');
        } else if (event.percent > 10) {
          this.transitionTo('warning', 0.7, 5000, 'Watch yourself.');
        } else {
          this.transitionTo('alert', 0.5, 3000);
        }
        break;

      case 'overtrading':
        this.transitionTo('angry', 0.7, 5000, 'You\'re trading too much.');
        break;

      case 'leverage_spike':
        this.transitionTo('warning', 0.8, 5000, 'Leverage up? Are you sure?');
        break;

      case 'win':
        this.transitionTo(event.amount > 1000 ? 'excited' : 'happy', Math.min(0.9, event.amount / 5000 + 0.3), 3000);
        break;

      case 'loss':
        this.transitionTo(
          event.amount > 1000 ? 'disappointed' : 'sad',
          Math.min(0.9, event.amount / 5000 + 0.3),
          4000,
        );
        break;

      case 'behavior_signal':
        this.handleBehaviorSignal(event.signal);
        break;

      case 'chat_sentiment':
        this.handleChatSentiment(event.sentiment);
        break;

      case 'idle':
        this.transitionTo('idle', 0.5);
        break;

      case 'custom':
        this.transitionTo(event.emotion, event.intensity ?? 0.5, event.duration);
        break;
    }
  }

  private handleBehaviorSignal(signal: BehaviorSignal): void {
    const severityMap: Record<SignalSeverity, { emotion: CatEmotion; intensity: number }> = {
      info: { emotion: 'alert', intensity: 0.4 },
      warning: { emotion: 'warning', intensity: 0.6 },
      critical: { emotion: 'angry', intensity: 0.8 },
    };

    const { emotion, intensity } = severityMap[signal.severity];
    this.transitionTo(emotion, intensity, 5000);
  }

  private handleChatSentiment(sentiment: string): void {
    const sentimentMap: Record<string, CatEmotion> = {
      supportive: 'happy',
      strict: 'angry',
      disappointed: 'disappointed',
      playful: 'smug',
      angry: 'angry',
    };

    this.transitionTo(sentimentMap[sentiment] ?? 'neutral', 0.6, 4000);
  }

  /**
   * Force reset to idle (e.g., on page navigation).
   */
  reset(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = null;
    this.currentState = { emotion: 'idle', intensity: 0.5, isTransitioning: false };
    this.notify();
  }

  destroy(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.listeners.clear();
  }
}
