import type { Transition, Variants } from "motion/react";

/** Signature easing — a long, soft deceleration. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Timing scale (seconds), from the design brief. */
export const DURATION = {
  button: 0.25,
  card: 0.4,
  nav: 0.35,
  reveal: 0.7,
  hero: 1.2,
  heroZoom: 10,
} as const;

export const transition = (duration: number = DURATION.reveal, delay = 0): Transition => ({
  duration,
  delay,
  ease: EASE,
});

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: transition() },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transition() },
};

export const stagger = (staggerChildren = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
});

export const dropdown: Variants = {
  hidden: { opacity: 0, y: -8 },
  show: { opacity: 1, y: 0, transition: transition(DURATION.nav) },
  exit: { opacity: 0, y: -6, transition: transition(0.2) },
};
