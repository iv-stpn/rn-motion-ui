// The button family's shared scale: the one place a button's box (height,
// horizontal padding, corner radius), its adornment gap and its label type ramp
// are decided. A flat Button, an elevated chip, a glossy key and an
// ActionSwapButton at the same `size` are therefore the same box with the same
// text inside it, and a row of mixed types lines up.
//
// The geometry itself lives in theme/tokens.css (`--spacing-interactive-*`,
// `--spacing-interactive-pad-*`) and lib/radius.ts (`INTERACTIVE_RADIUS`) — the
// classes below only name those tokens, so a consumer retunes the whole family
// by overriding one custom property rather than by passing a class to every
// button. BUTTON_METRICS mirrors the same number for the effect layers that need
// a number instead of a class: GlossyButton's seven shadow slots and
// ElevatedButton's SVG rim both have to follow the same curve as the Pressable,
// and neither can read a class.
//
// Data only, no React — ActionSwap imports this without pulling in the family's
// press/ripple machinery (button-internals.tsx, which re-exports the two types
// below so existing import sites keep working).

import { INTERACTIVE_RADIUS, TEXT_INTERACTIVE } from '../../../lib/radius';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
export type ButtonShape = 'rounded' | 'pill';

/**
 * The pixel twin of the geometry tokens. `radius` is the shared interactive
 * corner — a pill's radius depends on the height, so ask {@link buttonRadius}
 * for the resolved value rather than reading this directly.
 *
 * `icon` is the `md` box squared: same height, same curve, no horizontal padding
 * (the square is the padding).
 */
export const BUTTON_METRICS: Record<ButtonSize, { height: number; padX: number; radius: number }> = {
  sm: { height: 28, padX: 10, radius: INTERACTIVE_RADIUS },
  md: { height: 36, padX: 14, radius: INTERACTIVE_RADIUS },
  lg: { height: 44, padX: 18, radius: INTERACTIVE_RADIUS },
  icon: { height: 36, padX: 0, radius: INTERACTIVE_RADIUS },
};

/** Space between an adornment (icon, spinner) and the label, at every size. */
export const BUTTON_GAP_CLASSNAME = 'gap-2';

/**
 * Box classes per shape and size, straight from the geometry tokens. Spelled out
 * per shape rather than composed at call time so no two classes ever compete for
 * the same {@link cn} group, and so the Tailwind/uniwind scanner sees every one
 * as a static literal.
 */
export const BUTTON_BOX: Record<ButtonShape, Record<ButtonSize, string>> = {
  rounded: {
    sm: 'h-interactive-sm rounded-interactive px-interactive-pad-sm',
    md: 'h-interactive-md rounded-interactive px-interactive-pad-md',
    lg: 'h-interactive-lg rounded-interactive px-interactive-pad-lg',
    icon: 'h-interactive-md w-interactive-md rounded-interactive',
  },
  pill: {
    sm: 'h-interactive-sm rounded-full px-interactive-pad-sm',
    md: 'h-interactive-md rounded-full px-interactive-pad-md',
    lg: 'h-interactive-lg rounded-full px-interactive-pad-lg',
    icon: 'h-interactive-md w-interactive-md rounded-full',
  },
};

/**
 * Resolved corner radius in px, for the layers that can't read a class — the
 * glossy shadow slots and the elevated rim/ring. A pill rounds to half its
 * height; everything else takes the shared interactive radius.
 */
export function buttonRadius(shape: ButtonShape, size: ButtonSize): number {
  return shape === 'pill' ? BUTTON_METRICS[size].height / 2 : INTERACTIVE_RADIUS;
}

/**
 * The family's label type ramp — the one place a button label's weight and size
 * are decided, so an `md` label is the same text in a flat Button and in a glossy
 * key. Colour is deliberately absent: each sibling resolves its own (Button
 * through a per-variant class, GlossyButton inline from the face colour), and a
 * shared colour class here would fight those.
 *
 * ElevatedButton is the one opt-out.
 *
 * Static literals so the Tailwind/uniwind scanner picks them up.
 */
export const LABEL_TEXT_CLASS: Record<ButtonSize, string> = {
  sm: `font-medium ${TEXT_INTERACTIVE.sm}`,
  md: `font-medium ${TEXT_INTERACTIVE.md}`,
  lg: `font-medium ${TEXT_INTERACTIVE.lg}`,
  icon: `font-medium ${TEXT_INTERACTIVE.icon}`,
};
