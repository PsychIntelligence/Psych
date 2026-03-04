/**
 * Unified Motion Engine — shared by all animated elements.
 *
 * fastSpring  → hovers, toggles, press (<80ms)
 * hudSpring   → panels, KPIs, nav (120-200ms)
 * slowSpring  → reveals, overlays (300-500ms)
 * microTween  → progress bars, smooth counters
 */

import type { Transition, Variants } from 'framer-motion';

export const fastSpring: Transition = { type: 'spring', stiffness: 800, damping: 35, mass: 0.5 };
export const hudSpring: Transition = { type: 'spring', stiffness: 400, damping: 30, mass: 0.9 };
export const slowSpring: Transition = { type: 'spring', stiffness: 180, damping: 22, mass: 1.2 };
export const microTween: Transition = { type: 'tween', duration: 0.35, ease: [0.25, 0.1, 0.25, 1] };
export const layoutSpring: Transition = { type: 'spring', stiffness: 350, damping: 30, mass: 0.9 };
export const numberSpring = { stiffness: 100, damping: 18, mass: 0.5 };

export const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: hudSpring },
};
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: hudSpring },
};
export const slideIn: Variants = {
  hidden: { opacity: 0, x: 12 },
  show: { opacity: 1, x: 0, transition: hudSpring },
};
export const press = {
  whileHover: { scale: 1.02, transition: fastSpring },
  whileTap: { scale: 0.97, transition: fastSpring },
};
