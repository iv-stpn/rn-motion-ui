/**
 * Shared animation tokens. Reanimated uses spring configs and easing curves
 * that mirror the original web easing values.
 */

import { Easing } from 'react-native-reanimated';

// Cubic bezier control points (mirrored from web). Single source of truth so the
// Moti-facing factory and the plain JS-thread function stay on the same curve.
const EASE_OUT_POINTS = [0.16, 1, 0.3, 1] as const;
const EASE_IN_OUT_POINTS = [0.77, 0, 0.175, 1] as const;
const EASE_DRAWER_POINTS = [0.32, 0.72, 0, 1] as const;

// Moti transitions consume these as the `easing` field — Reanimated's `bezier`
// returns an EasingFunctionFactory that runs as a worklet on the UI thread.
export const EASE_OUT = Easing.bezier(...EASE_OUT_POINTS);
export const EASE_IN_OUT = Easing.bezier(...EASE_IN_OUT_POINTS);
export const EASE_DRAWER = Easing.bezier(...EASE_DRAWER_POINTS);

// Plain (t) => number form of EASE_OUT for JS-thread interpolation
// (AnimatedNumber's requestAnimationFrame loop), where a factory isn't callable.
export const EASE_OUT_FN = Easing.bezierFn(...EASE_OUT_POINTS);

/** Press feedback on buttons and other tappable surfaces. */
export const SPRING_PRESS = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
  mass: 0.6,
};

/** Content swaps — label/icon slots trading places inside a control. */
export const SPRING_SWAP = {
  type: 'spring' as const,
  stiffness: 460,
  damping: 30,
  mass: 0.55,
};

/** Overlay panel entrances — modals and sheets summoned by pointer. */
export const SPRING_PANEL = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 40,
  mass: 0.5,
};

/** Shared-layout glides — pills, indicators and panels morphing between positions. */
export const SPRING_LAYOUT = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 32,
  mass: 0.6,
};

/** Cursor-follow physics for decorative mouse tracking (magnetic, tilt, dock). */
export const SPRING_MOUSE = {
  stiffness: 200,
  damping: 15,
  mass: 0.3,
};

/** Drawer / sheet glide: a long, fully-damped tween reads smoother than a spring. */
export const DRAWER = { duration: 500, easing: EASE_DRAWER } as const;

/** Stack spring for toast / list item layout animations. */
export const STACK_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 34,
  mass: 0.75,
};

/** Heavy, deliberate thumb spring (switch toggles). */
export const THUMB_SPRING = {
  type: 'spring' as const,
  stiffness: 800,
  damping: 80,
  mass: 4,
};

/** Content transitions. */
export const CONTENT_TRANSITION = {
  duration: 280,
  easing: EASE_OUT,
} as const;
