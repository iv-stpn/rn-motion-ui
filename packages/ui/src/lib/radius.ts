/**
 * radius — shared corner-radius constants and Tailwind classes.
 *
 * Four radius tokens partition corner curves by surface category:
 * `--radius-interactive` (buttons, inputs, tabs, button groups),
 * `--radius-card` (cards), `--radius-menu` (menus, dropdowns) and
 * `--radius-modal` (modals, popovers, bottom sheets). A fifth token,
 * `--radius-card-compact` (16 px), is the tight card variant used by
 * RadioCard/CheckboxCard/SwipeableList — it has no pixel mirror here because no
 * effect layer traces that curve, so the class is spelled at its call sites.
 *
 * Every class is a static literal so the uniwind/Tailwind scanner picks it up.
 * Pixel constants are the source of truth matching the design tokens in
 * theme/tokens.css — they exist for the effect layers and JS-powered styles
 * that cannot read a CSS class.
 */

type InteractiveSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

/** Corner radius in px for interactive components — buttons, inputs, tabs, button groups. */
export const INTERACTIVE_RADIUS = 8;

/** Corner radius in px for card containers. */
export const CARD_RADIUS = 24;

/** Tailwind class backed by --radius-card. */
export const ROUNDED_CARD = 'rounded-card' as const;

/** Corner radius in px for menu overlays — HoverMenu, Dropdown, HoldMenu. */
export const MENU_RADIUS = 16;

/** Tailwind class backed by --radius-menu. */
export const ROUNDED_MENU = 'rounded-menu' as const;

/** Corner radius in px for modal surfaces — Modal, Popover, MorphingModal, BottomSheet. */
export const MODAL_RADIUS = 32;

/** Tailwind class backed by --radius-modal. */
export const ROUNDED_MODAL = 'rounded-modal' as const;

// ── Height ────────────────────────────────────────────────────────────────────

/** Height in px per interactive size. */
export const INTERACTIVE_HEIGHT = { xs: 24, sm: 32, md: 42, lg: 56 } as const;

// ── Touch target ─────────────────────────────────────────────────────────────

/** Minimum recommended touch target in px (WCAG 2.5.5 / Apple HIG). */
export const MIN_TOUCH_TARGET = 44;

/**
 * `hitSlop` in px per side that lifts a control of `size` px up to the
 * {@link MIN_TOUCH_TARGET} minimum — without changing its visual footprint.
 * `0` once the control is already large enough.
 */
export function hitSlopFor(size: number): number {
  return Math.max(0, Math.ceil((MIN_TOUCH_TARGET - size) / 2));
}

/** Tailwind class: height per interactive size. Static literals so the
 *  uniwind/Tailwind scanner registers them. */
export const H_INTERACTIVE: Record<InteractiveSize, string> = {
  xs: 'h-interactive-xs',
  sm: 'h-interactive-sm',
  md: 'h-interactive-md',
  lg: 'h-interactive-lg',
  icon: 'h-interactive-md',
};

// ── Padding ──────────────────────────────────────────────────────────────────

/** Tailwind class: horizontal padding per interactive size. Static literals so
 *  the uniwind/Tailwind scanner registers them. */
export const PX_INTERACTIVE: Record<InteractiveSize, string> = {
  xs: 'px-interactive-pad-xs',
  sm: 'px-interactive-pad-sm',
  md: 'px-interactive-pad-md',
  lg: 'px-interactive-pad-lg',
  icon: 'px-interactive-pad-md',
};

// ── Font sizes ───────────────────────────────────────────────────────────────

/** Standard Tailwind text class per interactive size. Static literals. */
export const TEXT_INTERACTIVE: Record<InteractiveSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  icon: 'text-base',
};
