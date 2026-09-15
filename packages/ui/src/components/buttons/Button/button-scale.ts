// The button family's shared scale: the one place a box's geometry (height,
// horizontal padding, corner radius), its adornment gap and its label type ramp
// are decided. A flat Button, an elevated chip and a ButtonSwap at the same
// `size` are therefore the same box with the same text inside it, and a row of
// mixed types lines up.
//
// The geometry itself lives in theme/tokens.css (`--spacing-interactive-*`,
// `--spacing-interactive-pad-*`) and lib/radius.ts (`INTERACTIVE_HEIGHT`,
// `INTERACTIVE_RADIUS`) — the classes below only name those tokens, so a
// consumer retunes the whole family by overriding one custom property rather
// than by passing a class to every button. BUTTON_METRICS mirrors the same
// number for the effect layers that need a number instead of a class: a pill
// rounds to half its height, and ElevatedButton's SVG rim has to follow the same
// curve as the Pressable, which can't read a class.
//
// BUTTON_SIZE is the single table every interactive control in the family reads:
// its `box` is the hugging label box a Button wears, its `square` is the box an
// IconButton (and `<Button size="icon">`, which is the `md` box squared) fills,
// and its `px` height is what the MorphingFAB trigger and the MorphingSwitcher
// rows stand on. A row of mixed controls therefore lines up by construction —
// there is no per-sibling copy of the numbers or classes to drift. BUTTON_BOX
// and BUTTON_METRICS are re-indexed views of that table, kept in the shape-major
// / ButtonSize-major shapes the Button siblings and the effect layers read.
//
// Data only, no React — a sibling imports this without pulling in the family's
// press/ripple machinery (button-internals.tsx, which re-exports the two types
// below so existing import sites keep working).

import { INTERACTIVE_HEIGHT, INTERACTIVE_RADIUS } from '../../../lib/radius';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';
export type ButtonShape = 'square' | 'rounded' | 'pill' | 'circle';

/** The four standalone box heights of the ramp — everything except `icon`,
 *  which is the `md` box squared. */
export type RampSize = 'xs' | 'sm' | 'md' | 'lg';

/** What one ramp height gives every control that stands on it. */
export type ButtonSizeGeometry = {
  /** Pixel side — the label box's height and the square's width. Twin of `--spacing-interactive-*`. */
  px: number;
  /** The label box classes — a Button hugs its content between horizontal padding. */
  box: Record<ButtonShape, string>;
  /** The square classes — an IconButton / `<Button size="icon">` / a MorphingFAB trigger. */
  square: Record<ButtonShape, string>;
};

/**
 * The shared size ramp — the one table the button family and its icon-carrying
 * siblings read for geometry, so a row of mixed controls lines up by
 * construction rather than by each sibling copying the same number. `px` is the
 * {@link INTERACTIVE_HEIGHT} pixel twin; the class strings spell the geometry
 * tokens as static literals so the Tailwind/uniwind scanner registers every one.
 */
export const BUTTON_SIZE: Record<RampSize, ButtonSizeGeometry> = {
  xs: {
    px: INTERACTIVE_HEIGHT.xs,
    box: {
      square: 'h-interactive-xs w-interactive-xs rounded-interactive',
      rounded: 'h-interactive-xs rounded-interactive px-interactive-pad-xs',
      pill: 'h-interactive-xs rounded-full px-interactive-pad-xs',
      circle: 'h-interactive-xs w-interactive-xs rounded-full',
    },
    square: {
      square: 'h-interactive-xs w-interactive-xs rounded-interactive',
      rounded: 'h-interactive-xs w-interactive-xs rounded-interactive',
      pill: 'h-interactive-xs w-interactive-xs rounded-full',
      circle: 'h-interactive-xs w-interactive-xs rounded-full',
    },
  },
  sm: {
    px: INTERACTIVE_HEIGHT.sm,
    box: {
      square: 'h-interactive-sm w-interactive-sm rounded-interactive',
      rounded: 'h-interactive-sm rounded-interactive px-interactive-pad-sm',
      pill: 'h-interactive-sm rounded-full px-interactive-pad-sm',
      circle: 'h-interactive-sm w-interactive-sm rounded-full',
    },
    square: {
      square: 'h-interactive-sm w-interactive-sm rounded-interactive',
      rounded: 'h-interactive-sm w-interactive-sm rounded-interactive',
      pill: 'h-interactive-sm w-interactive-sm rounded-full',
      circle: 'h-interactive-sm w-interactive-sm rounded-full',
    },
  },
  md: {
    px: INTERACTIVE_HEIGHT.md,
    box: {
      square: 'h-interactive-md w-interactive-md rounded-interactive',
      rounded: 'h-interactive-md rounded-interactive px-interactive-pad-md',
      pill: 'h-interactive-md rounded-full px-interactive-pad-md',
      circle: 'h-interactive-md w-interactive-md rounded-full',
    },
    square: {
      square: 'h-interactive-md w-interactive-md rounded-interactive',
      rounded: 'h-interactive-md w-interactive-md rounded-interactive',
      pill: 'h-interactive-md w-interactive-md rounded-full',
      circle: 'h-interactive-md w-interactive-md rounded-full',
    },
  },
  lg: {
    px: INTERACTIVE_HEIGHT.lg,
    box: {
      square: 'h-interactive-lg w-interactive-lg rounded-interactive',
      rounded: 'h-interactive-lg rounded-interactive px-interactive-pad-lg',
      pill: 'h-interactive-lg rounded-full px-interactive-pad-lg',
      circle: 'h-interactive-lg w-interactive-lg rounded-full',
    },
    square: {
      square: 'h-interactive-lg w-interactive-lg rounded-interactive',
      rounded: 'h-interactive-lg w-interactive-lg rounded-interactive',
      pill: 'h-interactive-lg w-interactive-lg rounded-full',
      circle: 'h-interactive-lg w-interactive-lg rounded-full',
    },
  },
};

/**
 * The pixel twin of the geometry tokens. `radius` is the shared interactive
 * corner — a pill's radius depends on the height, so ask {@link buttonRadius}
 * for the resolved value rather than reading this directly.
 *
 * `icon` is the `md` box squared (the table's `md.square`): same height, same
 * curve, no horizontal padding (the square is the padding).
 */
export const BUTTON_METRICS: Record<ButtonSize, { height: number; padX: number; radius: number }> = {
  xs: { height: BUTTON_SIZE.xs.px, padX: 8, radius: INTERACTIVE_RADIUS },
  sm: { height: BUTTON_SIZE.sm.px, padX: 12, radius: INTERACTIVE_RADIUS },
  md: { height: BUTTON_SIZE.md.px, padX: 16, radius: INTERACTIVE_RADIUS },
  lg: { height: BUTTON_SIZE.lg.px, padX: 20, radius: INTERACTIVE_RADIUS },
  icon: { height: BUTTON_SIZE.md.px, padX: 0, radius: INTERACTIVE_RADIUS },
};

/** Space between an adornment (icon, spinner) and the label, at every size. */
export const BUTTON_GAP_CLASSNAME = 'gap-2';

/**
 * Icon size (px) for success / error / idle state icons in StatefulButton, per
 * button size. Sized so the icon reads at a glance without overpowering the label.
 */
export const STATE_ICON_SIZE: Record<ButtonSize, number> = {
  xs: 12,
  sm: 16,
  md: 19,
  lg: 24,
  icon: 20,
};

/**
 * Gap class between the state icon, the label, and the idle adornment icon in
 * StatefulButton, per button size — keeps the spacing proportional as the
 * button scales.
 */
export const STATE_BUTTON_GAP_CLASSNAME: Record<ButtonSize, string> = {
  xs: 'gap-0.5',
  sm: 'gap-1',
  md: 'gap-1.25',
  lg: 'gap-2',
  icon: 'gap-1',
};

/**
 * Box classes per shape and size — a re-index of {@link BUTTON_SIZE} into the
 * shape-major order the Button siblings read (`icon` is the table's `md`
 * square). Re-pointing rather than re-authoring keeps the literals in one place:
 * no two classes ever compete for the same {@link cn} group, and the
 * Tailwind/uniwind scanner still sees every static literal in BUTTON_SIZE.
 */
export const BUTTON_BOX: Record<ButtonShape, Record<ButtonSize, string>> = {
  square: {
    xs: BUTTON_SIZE.xs.box.square,
    sm: BUTTON_SIZE.sm.box.square,
    md: BUTTON_SIZE.md.box.square,
    lg: BUTTON_SIZE.lg.box.square,
    icon: BUTTON_SIZE.md.square.square,
  },
  rounded: {
    xs: BUTTON_SIZE.xs.box.rounded,
    sm: BUTTON_SIZE.sm.box.rounded,
    md: BUTTON_SIZE.md.box.rounded,
    lg: BUTTON_SIZE.lg.box.rounded,
    icon: BUTTON_SIZE.md.square.rounded,
  },
  pill: {
    xs: BUTTON_SIZE.xs.box.pill,
    sm: BUTTON_SIZE.sm.box.pill,
    md: BUTTON_SIZE.md.box.pill,
    lg: BUTTON_SIZE.lg.box.pill,
    icon: BUTTON_SIZE.md.square.pill,
  },
  circle: {
    xs: BUTTON_SIZE.xs.box.circle,
    sm: BUTTON_SIZE.sm.box.circle,
    md: BUTTON_SIZE.md.box.circle,
    lg: BUTTON_SIZE.lg.box.circle,
    icon: BUTTON_SIZE.md.square.circle,
  },
};

/**
 * Resolved corner radius in px, for the layers that can't read a class — the
 * elevated SVG rim and the ring inset calculation. A square and the rounded
 * shape both take the shared interactive radius, a pill or circle rounds to
 * half its height.
 *
 * Prefer {@link buttonRadiusClass} for the CSS border-radius; use this only
 * when the number is required (SVG rx/ry, arithmetic).
 */
export function buttonRadius(shape: ButtonShape, size: ButtonSize): number {
  if (shape === 'square' || shape === 'rounded') return INTERACTIVE_RADIUS;
  return BUTTON_METRICS[size].height / 2;
}

/**
 * CSS class for the interactive border-radius — the className twin of
 * {@link buttonRadius}. Squares and the rounded shape use `rounded-interactive`
 * (backed by `--radius-interactive`), pills and circles use `rounded-full`.
 */
export function buttonRadiusClass(shape: ButtonShape): 'rounded-full' | 'rounded-interactive' {
  if (shape === 'square' || shape === 'rounded') return 'rounded-interactive';
  return 'rounded-full';
}

/**
 * The family's label type ramp — the one place a button label's size is decided,
 * so an `md` label is the same text in a flat Button and in an elevated chip.
 * Weight is uniform across the family (`weight="medium"`, applied at each render
 * site) and colour is deliberately absent: each sibling resolves its own (Button
 * through a per-variant class), and a shared colour class here would fight those.
 *
 * The ramp tracks the shared interactive type scale — 12 / 14 / 16 / 18 px for
 * xs / sm / md / lg — the same ramp `TEXT_INTERACTIVE` (which Tabs, ToggleGroup
 * and ChoiceGroup use verbatim) spells out, so a button and a neighbouring
 * input/tab/chip at the same size read the same label.
 *
 * ElevatedButton is the one opt-out: a single size for every box, level with `md`.
 *
 * Static literals so the Tailwind/uniwind scanner picks them up.
 */
export const LABEL_TEXT_CLASS: Record<ButtonSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  icon: 'text-base',
};
