/**
 * radius — shared corner-radius constants and Tailwind classes.
 *
 * Four radius tokens partition corner curves by surface category:
 * `--radius-interactive` (buttons, inputs, tabs, button groups),
 * `--radius-card` (cards), `--radius-menu` (menus, dropdowns) and
 * `--radius-modal` (modals, popovers, bottom sheets).
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

/** Tailwind class backed by --radius-interactive. */
export const ROUNDED_INTERACTIVE = 'rounded-interactive' as const;

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
export const INTERACTIVE_HEIGHT = { xs: 24, sm: 36, md: 48, lg: 64 } as const;

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

/** Horizontal padding in px per interactive size. */
export const INTERACTIVE_PAD_X = { xs: 8, sm: 12, md: 16, lg: 20 } as const;

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
