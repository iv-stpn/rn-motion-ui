// The MorphingSwitcher's shared scale — the one place one size decides the
// trigger's and every row's height, inset, gap, icon, type size and pane radius.
// Height comes from the shared `--spacing-interactive-*` ramp (the same tokens
// Button and IconButton read), so a switcher lines up with a Button or IconButton
// of the same size; the numeric `height` mirrors that token for the pane
// arithmetic a class can't do.
//
// Data only, no React — a sibling imports this without pulling in the switcher's
// morph machinery (morphing-switcher.tsx), and the parity tests import it to pin
// every row to the shared ramp.

import type { MenuItemSize } from '../../rows/menu-item';

/** Switcher size — the trigger and every row stand at the matching interactive height. */
export type MorphingSwitcherSize = 'sm' | 'md' | 'lg';

/**
 * Everything one size decides. The trigger and the item rows read from the same
 * entry, which is what makes the trigger the active row of the list rather than
 * a differently-sized header: one height, one inset, one gap, one icon, one type
 * size.
 */
export type SwitcherScale = {
  /** Trigger and row height in px — the pixel twin of `rowClassName`'s height, for the pane arithmetic. */
  height: number;
  /**
   * The row box. Height comes from the shared `--spacing-interactive-*` ramp, so
   * a switcher lines up with a Button or IconButton of the same size. The
   * horizontal padding is a row's, not a button's (`--spacing-interactive-pad-*`
   * is tuned for a label hugged by a pill, far too wide for a full-width bar).
   * `py-0` drops {@link MenuItem}'s own vertical padding — the fixed height owns it.
   */
  rowClassName: string;
  /** Gap between icon and label, and between the label block and the carets. */
  gapClassName: string;
  /** The size the item rows render their {@link MenuItem} at. */
  menuItemSize: MenuItemSize;
  /** That MenuItem size's leading-icon size — the trigger matches it so the two stacks align. */
  iconSize: number;
  /** {@link Text} size matching the MenuItem label's, for the same reason. */
  labelSize: 'xs' | 'sm';
  /** The single caret of the `select` trigger. */
  caretSize: number;
  /** Each caret of the `switcher` trigger's stacked pair. */
  stackedCaretSize: number;
  /** Corner radius of the open pane — a touch tighter than the collapsed pill's half-height. */
  paneRadius: number;
};

/**
 * `lg` deliberately shares `md`'s icon and label rather than stepping up, the
 * same divergence the button family's `LABEL_TEXT_CLASS` makes: past the `md`
 * box the extra height and padding already carry the size difference, and
 * MenuItem's `lg` ramp (26px icon, 18px label) belongs to a settings list, not
 * to a switcher bar.
 */
export const SWITCHER_SCALE: Record<MorphingSwitcherSize, SwitcherScale> = {
  sm: {
    height: 24,
    rowClassName: 'h-interactive-sm px-2 py-0',
    gapClassName: 'gap-1.5',
    menuItemSize: 'sm',
    iconSize: 16,
    labelSize: 'xs',
    caretSize: 12,
    stackedCaretSize: 11,
    paneRadius: 14,
  },
  md: {
    height: 32,
    rowClassName: 'h-interactive-md px-2.5 py-0',
    gapClassName: 'gap-2',
    menuItemSize: 'md',
    iconSize: 21,
    labelSize: 'sm',
    caretSize: 14,
    stackedCaretSize: 13,
    paneRadius: 16,
  },
  lg: {
    height: 40,
    rowClassName: 'h-interactive-lg px-3 py-0',
    gapClassName: 'gap-2',
    menuItemSize: 'md',
    iconSize: 21,
    labelSize: 'sm',
    caretSize: 16,
    stackedCaretSize: 15,
    paneRadius: 20,
  },
};
