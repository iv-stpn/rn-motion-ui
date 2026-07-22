/**
 * Motion tokens — single source of truth for animation timing and spring
 * constants across rn-motion-ui components.
 *
 * ## Usage
 *
 * Import the preset that matches the interaction, then pass it to `transition`:
 * ```tsx
 * import { MOTION_SNAPPY } from 'rn-motion-ui/theme/motion';
 * <MotiView transition={MOTION_SNAPPY} animate={{ scale: pressed ? 0.94 : 1 }} />
 * ```
 *
 * Use `mergeTransition` when a consumer should be able to partially override the
 * preset without re-specifying every field:
 * ```tsx
 * const t = mergeTransition(MOTION_SNAPPY, props.pressTransition);
 * <MotiView transition={t} animate={{ scale: pressed ? 0.94 : 1 }} />
 * ```
 */

import type { TransitionConfig } from '../moti/core/types';

// ── Re-export the canonical transition type ──────────────────────────────────

export type { TransitionConfig as MotiTransitionProp } from '../moti/core/types';

// ── Duration constants (ms) ──────────────────────────────────────────────────

/** 0 ms — use when `useReducedMotion()` is true. */
export const DURATION_INSTANT = 0;
/** 150 ms — micro-interactions, icon swaps, small fades. */
export const DURATION_FAST = 150;
/** 200 ms — default fade/slide for UI feedback (error states, backdrop). */
export const DURATION_BASE = 200;
/** 300 ms — colour cross-fades, slightly heavier transitions. */
export const DURATION_SLOW = 300;
/** 400 ms — deliberate morph / text cascade animations. */
export const DURATION_SLOWER = 400;

// ── Shorthand timing transitions ─────────────────────────────────────────────

/** `{ type: 'timing', duration: 0 }` — instant (reduced-motion fallback). */
export const TIMING_INSTANT = { type: 'timing' as const, duration: DURATION_INSTANT };

/** `{ type: 'timing', duration: 150 }` — fast fade / icon swap. */
export const TIMING_FAST = { type: 'timing' as const, duration: DURATION_FAST };

/** `{ type: 'timing', duration: 200 }` — default UI feedback. */
export const TIMING_BASE = { type: 'timing' as const, duration: DURATION_BASE };

/** `{ type: 'timing', duration: 300 }` — colour cross-fades. */
export const TIMING_SLOW = { type: 'timing' as const, duration: DURATION_SLOW };

// ── Semantic spring presets ───────────────────────────────────────────────────

/**
 * Snappy — fast, energetic spring for press feedback and toggles.
 * Equivalent to `SPRING_PRESS` in `lib/ease.ts`.
 */
export const MOTION_SNAPPY = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
  mass: 0.6,
};

/**
 * Standard — balanced spring for most UI element transitions.
 * Good for tab indicators, selection pills, and small layout changes.
 */
export const MOTION_STANDARD = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 24,
  mass: 0.8,
};

/**
 * Gentle — soft, weighted spring for large surfaces and number tickers.
 * Lower stiffness keeps motion unhurried and considered.
 */
export const MOTION_GENTLE = {
  type: 'spring' as const,
  stiffness: 180,
  damping: 24,
  mass: 1.0,
};

// ── Merge helper ─────────────────────────────────────────────────────────────

/**
 * Shallowly merges a motion preset with a consumer override.
 *
 * The consumer can change individual fields (e.g. just `stiffness`) without
 * re-specifying the full object. When `override` is undefined the preset is
 * returned as-is with no extra allocation.
 *
 * @example
 * const t = mergeTransition(MOTION_SNAPPY, props.pressTransition);
 * // t = { type: 'spring', stiffness: 500, damping: 30, mass: 0.6, ...override }
 */
export function mergeTransition<T extends Record<string, unknown>>(preset: T, override?: Partial<TransitionConfig>): T {
  if (!override) return preset;
  // biome-ignore lint/plugin: spreading Partial<TransitionConfig> onto a generic T is safe — all override keys are valid TransitionConfig fields
  return { ...preset, ...override } as T;
}
