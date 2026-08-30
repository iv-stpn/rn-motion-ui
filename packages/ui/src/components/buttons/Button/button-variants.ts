// The button family's colour tables: the one place a button's fill, border and
// label colour are decided. A flat Button and a ButtonSwap at the same `variant`
// are therefore the same plate with the same text colour on it, and a swapping
// button drops into a row of Buttons without a seam.
//
// The box (height, padding, radius) is the family's too, but it lives next door
// in button-scale.ts — colour and geometry are separate axes and retuned
// separately.
//
// Data only, no React — a sibling imports this without pulling in the family's
// press/ripple machinery (button-internals.tsx).

import { cva } from 'class-variance-authority';
import type { ThemeToken } from '../../../theme/use-theme-color';
import { LABEL_TEXT_CLASS } from './button-scale';

/**
 * The glyph (spinner/icon) colour token per variant — the single source of truth
 * for the flat Button's spinner and the stateful Button's state icon, so the two
 * can never drift apart. Variants not listed (`neutral`, `ghost`, `outline`)
 * resolve to `foreground`.
 */
const VARIANT_ICON_COLOR_TOKEN: Partial<Record<ButtonVariant, ThemeToken>> = {
  primary: 'primary-foreground',
  danger: 'primary-foreground',
  success: 'success-foreground',
  warning: 'warning-foreground',
  info: 'info-foreground',
  outlineDanger: 'danger',
  ghostDanger: 'danger',
};

export function variantIconColorToken(variant: ButtonVariant): ThemeToken {
  return VARIANT_ICON_COLOR_TOKEN[variant] ?? 'foreground';
}

export type ButtonVariant =
  | 'primary'
  | 'neutral'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'success'
  | 'warning'
  | 'info'
  | 'outlineDanger'
  | 'ghostDanger';

/**
 * The plate: fill and border per variant. Colour is the only axis here — the box
 * comes from {@link BUTTON_BOX} and the shadow from `elevation`/`floating`, so a
 * caller can raise or flatten any variant without the table fighting back.
 *
 * Class strings are static literals so the Tailwind/uniwind scanner picks them up.
 */
export const buttonContainer = cva('flex-row items-center justify-center', {
  variants: {
    variant: {
      primary: 'bg-primary',
      neutral: 'bg-surface-3',
      ghost: 'bg-transparent',
      outline: 'border-[1.5px] border-border bg-transparent',
      danger: 'bg-danger',
      success: 'bg-success',
      warning: 'bg-warning',
      info: 'bg-info',
      outlineDanger: 'border-[1.5px] border-danger bg-transparent',
      ghostDanger: 'bg-transparent',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

/**
 * The label: colour per variant, size from the family ramp. Weight is uniform
 * across the family (`weight="medium"`, applied at each render site), so colour
 * is the only thing this table adds to {@link LABEL_TEXT_CLASS}.
 */
export const buttonLabel = cva('', {
  variants: {
    variant: {
      primary: 'text-primary-foreground',
      neutral: 'text-foreground',
      ghost: 'text-foreground',
      outline: 'text-foreground',
      danger: 'text-white',
      success: 'text-success-foreground',
      warning: 'text-warning-foreground',
      info: 'text-info-foreground',
      outlineDanger: 'text-danger',
      ghostDanger: 'text-danger',
    },
    // Weight + size come from the family ramp, so only the colour above is
    // Button's own.
    size: LABEL_TEXT_CLASS,
  },
  defaultVariants: { variant: 'neutral', size: 'md' },
});

/**
 * Variants whose background is an opaque, dark-or-vivid fill, so a ripple has to
 * shimmer white to be visible. Everything else (`neutral`'s light surface plate,
 * ghost/outline's transparency) takes the dark ripple.
 */
export const FILLED_RIPPLE_VARIANTS = new Set<ButtonVariant>(['primary', 'danger', 'success', 'warning', 'info']);

/**
 * Fill token per *filled* variant — the variant's own fill colour, resolved for the
 * elevation ring (a filled button casts a fill-coloured ring so its edge reads on
 * any substrate). Mirrors ElevatedButton's `ELEVATED_FILL_TOKEN`: `primary` fills
 * with the `primary` token and the vivid status fills with themselves. Transparent
 * variants (`ghost`, `outline`, the danger outlines) have no fill and are absent —
 * and so is `neutral`: its `surface-3` plate is a *surface*, not an opaque fill, so
 * a raised neutral button keeps the surface ladder's `shadow-elevated-N` rather than
 * the fill-aware ring.
 */
export const FILLED_FILL_TOKEN: Partial<Record<ButtonVariant, ThemeToken>> = {
  primary: 'primary',
  danger: 'danger',
  success: 'success',
  warning: 'warning',
  info: 'info',
};
