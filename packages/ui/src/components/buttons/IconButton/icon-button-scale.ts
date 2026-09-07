// The IconButton's shared box scale — the one place an icon button's square (the
// same height and width at every size), its corner shape, and the pixel twin
// that sizes the MorphingFAB's collapsed shell are decided. The geometry lives
// in theme/tokens.css (`--spacing-interactive-*`) and lib/radius.ts
// (`INTERACTIVE_HEIGHT`) — the same tokens Button's boxes read — so an IconButton
// and a Button of the same `size` stand at the same height and a row of the two
// lines up.
//
// Data only, no React — a sibling imports this without pulling in the button's
// press/ripple machinery (icon-button.tsx), the MorphingFAB reads `lg`'s pixel
// twin to size its shell, and the parity tests import it to pin every box to the
// shared ramp.

import { INTERACTIVE_HEIGHT } from '../../../lib/radius';

// ── Types ────────────────────────────────────────────────────────────────────

export type IconButtonSize = 'sm' | 'md' | 'lg';
export type IconButtonShape = 'rounded' | 'pill';

// ── Box geometry ─────────────────────────────────────────────────────────────
// Static literals so the uniwind/Tailwind scanner registers every class.
// Tracks the BUTTON_BOX.icon pattern: the square at each interactive height.
// Every size sits on the shared ramp (24/32/40px), so an IconButton and a Button
// of the same `size` are the same height and a row of the two lines up.

export const ICON_BUTTON_BOX: Record<IconButtonShape, Record<IconButtonSize, string>> = {
  rounded: {
    sm: 'h-interactive-sm w-interactive-sm rounded-interactive',
    md: 'h-interactive-md w-interactive-md rounded-interactive',
    lg: 'h-interactive-lg w-interactive-lg rounded-interactive',
  },
  pill: {
    sm: 'h-interactive-sm w-interactive-sm rounded-full',
    md: 'h-interactive-md w-interactive-md rounded-full',
    lg: 'h-interactive-lg w-interactive-lg rounded-full',
  },
};

/** The `lg` box's pixel twin — the MorphingFAB reads it so its trigger shell
 *  stays exactly the size of an `lg` IconButton. Mirrors the `lg` height the box
 *  classes resolve to, so a token retune must update this number too (guarded by
 *  the parity test). */
export const ICON_BUTTON_LG_SIZE = INTERACTIVE_HEIGHT.lg;
