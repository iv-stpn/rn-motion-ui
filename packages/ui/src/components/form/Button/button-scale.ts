// The button family's shared scale: the one place a button's box (height,
// horizontal padding, corner radius), its adornment gap and its label type ramp
// are decided. A flat Button, an elevated chip, a glossy key and an
// ActionSwapButton at the same `size` are therefore the same box with the same
// text inside it, and a row of mixed types lines up.
//
// The geometry itself lives in theme/tokens.css (`--spacing-button-*`,
// `--spacing-button-pad-*`, `--radius-button-*`) — the classes below only name
// those tokens, so a consumer retunes the whole family by overriding one custom
// property rather than by passing a class to every button. BUTTON_METRICS
// mirrors the same numbers for the effect layers that need a number instead of a
// class: GlossyButton's seven shadow slots and ElevatedButton's SVG rim both
// have to follow the same curve as the Pressable, and neither can read a class.
// scripts/check-token-parity.mjs fails the build if the two ever drift.
//
// Data only, no React — ActionSwap imports this without pulling in the family's
// press/ripple machinery (button-internals.tsx, which re-exports the two types
// below so existing import sites keep working).

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
export type ButtonShape = 'rounded' | 'pill';

/**
 * The pixel twin of the geometry tokens. `radius` is the `rounded` corner only —
 * a pill's radius depends on the height, so ask {@link buttonRadius} for the
 * resolved value rather than reading this directly.
 *
 * `icon` is the `md` box squared: same height, same curve, no horizontal padding
 * (the square is the padding).
 */
export const BUTTON_METRICS: Record<ButtonSize, { height: number; padX: number; radius: number }> = {
  sm: { height: 32, padX: 12, radius: 8 },
  md: { height: 40, padX: 16, radius: 10 },
  lg: { height: 48, padX: 20, radius: 12 },
  icon: { height: 40, padX: 0, radius: 10 },
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
    sm: 'h-button-sm rounded-button-sm px-button-pad-sm',
    md: 'h-button-md rounded-button-md px-button-pad-md',
    lg: 'h-button-lg rounded-button-lg px-button-pad-lg',
    icon: 'h-button-md w-button-md rounded-button-md',
  },
  pill: {
    sm: 'h-button-sm rounded-full px-button-pad-sm',
    md: 'h-button-md rounded-full px-button-pad-md',
    lg: 'h-button-lg rounded-full px-button-pad-lg',
    icon: 'h-button-md w-button-md rounded-full',
  },
};

/**
 * Resolved corner radius in px, for the layers that can't read a class — the
 * glossy shadow slots and the elevated rim/ring. A pill rounds to half its
 * height; everything else takes the size's `rounded` radius.
 */
export function buttonRadius(shape: ButtonShape, size: ButtonSize): number {
  return shape === 'pill' ? BUTTON_METRICS[size].height / 2 : BUTTON_METRICS[size].radius;
}

/**
 * The family's label type ramp — the one place a button label's weight and size
 * are decided, so an `md` label is the same text in a flat Button and in a glossy
 * key. Colour is deliberately absent: each sibling resolves its own (Button
 * through a per-variant class, GlossyButton inline from the face colour), and a
 * shared colour class here would fight those.
 *
 * ElevatedButton is the one opt-out — AlignUI pins its chips to a 14px
 * `text-label-sm` at every size, so it spells its own label class.
 *
 * Static literals so the Tailwind/uniwind scanner picks them up.
 */
export const LABEL_TEXT_CLASS: Record<ButtonSize, string> = {
  sm: 'font-medium text-xs',
  md: 'font-medium text-sm',
  lg: 'font-medium text-base',
  icon: 'font-medium text-sm',
};
