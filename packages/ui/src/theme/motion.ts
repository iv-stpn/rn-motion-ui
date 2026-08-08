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
 *
 * The anchored-menu section at the bottom goes one step further: `resolveMenuMotion`
 * returns the whole `from` / `animate` / `exit` / `transition` set that every panel
 * summoned by a trigger shares, so `AdaptiveDropdown`, `HoverMenu`, `Popover` and
 * `HoldContextMenu` open and close identically and take the same `motion` prop.
 */

import { Easing } from 'react-native-reanimated';
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

/**
 * Menu enter — a little bouncier than `MOTION_STANDARD`, so the panel settles into
 * place with a subtle overshoot rather than stopping dead. The damping ratio (~0.7)
 * is roughly a framer-motion `bounce: 0.1`.
 */
export const MOTION_MENU_ENTER = {
  type: 'spring' as const,
  stiffness: 350,
  damping: 22,
  mass: 0.7,
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

// ── Anchored menu motion ─────────────────────────────────────────────────────

/**
 * Exit for a menu panel — `{ type: 'timing', duration: 150, easing: in(cubic) }`.
 *
 * A tween rather than a spring: a panel that is leaving has nothing to settle
 * into, and an ease-*in* accelerates it away so the dismissal reads as decisive
 * where the entrance reads as arriving.
 */
export const MENU_EXIT_TRANSITION = {
  type: 'timing' as const,
  duration: DURATION_FAST,
  easing: Easing.in(Easing.cubic),
};

/** Backdrop / scrim fade behind a menu — `{ type: 'timing', duration: 150 }`, both ways. */
export const MENU_SCRIM_TRANSITION = { type: 'timing' as const, duration: DURATION_FAST };

/** Scale a menu panel enters from and leaves to — visible pop-in, not a subtle settle. */
export const MENU_ENTER_SCALE = 0.85;

/** Distance (px) a menu panel travels toward its trigger as it opens. */
export const MENU_ENTER_OFFSET = 12;

/** Stagger delay between consecutive menu items entering, in ms. */
export const MENU_ITEM_STAGGER_MS = 25;

/** Which side of the trigger a menu panel opened on. */
export type MenuSide = 'top' | 'bottom';

/**
 * Which edge of the trigger a menu panel is aligned to. Physical, not writing-order:
 * `'start'` is the left edge on every locale, matching how the anchored menus
 * already position themselves.
 */
export type MenuAlign = 'start' | 'center' | 'end';

/** CSS `transform-origin` keyword pair a menu panel scales out of. */
export type MenuTransformOrigin = `${'left' | 'center' | 'right'} ${'top' | 'bottom'}`;

export type MenuOriginOptions = { side: MenuSide; align: MenuAlign };

/**
 * Per-menu overrides for {@link resolveMenuMotion}. Every field is optional, so a
 * consumer can move one number without restating the preset.
 *
 * Reduced motion wins over all of it: the panel cross-fades in place, because a
 * user who asked for less movement did not ask for less feedback.
 */
export type MenuMotion = {
  /** Enter spring/tween. @default MOTION_STANDARD */
  enter?: Partial<TransitionConfig>;
  /** Exit tween. @default MENU_EXIT_TRANSITION */
  exit?: Partial<TransitionConfig>;
  /** Scale the panel enters from and leaves to. `1` disables the scale. @default 0.96 */
  scale?: number;
  /** Px the panel travels toward its trigger as it opens. `0` disables the slide. @default 8 */
  offset?: number;
};

/** One end of a menu panel's travel — its pose before entering, and after leaving. */
export type MenuPose = { opacity: number; scale: number; translateY: number };

export type ResolvedMenuMotion = {
  from: MenuPose;
  animate: MenuPose;
  exit: MenuPose;
  transition: TransitionConfig;
  exitTransition: TransitionConfig;
};

export type ResolveMenuMotionOptions = {
  motion?: MenuMotion;
  /** `useReducedMotion()`. Collapses the whole thing to a fade in place. */
  reduce: boolean;
  /** Which side of the trigger the panel landed on — decides the slide direction. */
  side: MenuSide;
  /**
   * Resting `translateY`, for a panel already offset by a transform when at rest.
   * The slide is applied on top of it, so the panel settles here rather than at 0.
   * @default 0
   */
  restingTranslateY?: number;
};

/**
 * The shared open/close animation for a panel anchored to a trigger.
 *
 * Spread the result onto a `MotiView` — `from` / `animate` / `exit` /
 * `transition` / `exitTransition` — and the panel fades and scales up out of the
 * corner nearest its trigger while sliding the last few px toward it. Pair it
 * with {@link menuTransformOrigin} so the scale grows from that corner rather
 * than from the middle of the panel.
 *
 * @example
 * const motion = resolveMenuMotion({ motion: props.motion, reduce, side: openAbove ? 'top' : 'bottom' });
 * <MotiView {...motion} animate={{ ...motion.animate, opacity: measured ? 1 : 0 }} />
 */
export function resolveMenuMotion({ motion, reduce, side, restingTranslateY = 0 }: ResolveMenuMotionOptions): ResolvedMenuMotion {
  const scale = reduce ? 1 : (motion?.scale ?? MENU_ENTER_SCALE);
  const offset = reduce ? 0 : (motion?.offset ?? MENU_ENTER_OFFSET);
  // Toward the trigger: a panel below it drops down into place, one above it
  // rises up into place.
  const travel = side === 'bottom' ? -offset : offset;

  // The same pose at both ends — a menu leaves the way it arrived, so there is
  // nothing to distinguish and one object serves for `from` and `exit`.
  const hidden: MenuPose = { opacity: 0, scale, translateY: restingTranslateY + travel };

  return {
    from: hidden,
    animate: { opacity: 1, scale: 1, translateY: restingTranslateY },
    exit: hidden,
    transition: reduce ? TIMING_FAST : mergeTransition(MOTION_MENU_ENTER, motion?.enter),
    exitTransition: reduce ? TIMING_FAST : mergeTransition(MENU_EXIT_TRANSITION, motion?.exit),
  };
}

/**
 * `transform-origin` for a menu panel, so it scales out of the corner facing its
 * trigger instead of out of its own middle.
 *
 * Static style, not animated: it composes with the `scale` from
 * {@link resolveMenuMotion} rather than competing with it.
 */
export function menuTransformOrigin({ side, align }: MenuOriginOptions): MenuTransformOrigin {
  // A panel below its trigger grows down from its own top edge, and vice versa.
  const vertical = side === 'bottom' ? 'top' : 'bottom';
  if (align === 'start') return `left ${vertical}`;
  if (align === 'end') return `right ${vertical}`;
  return `center ${vertical}`;
}
