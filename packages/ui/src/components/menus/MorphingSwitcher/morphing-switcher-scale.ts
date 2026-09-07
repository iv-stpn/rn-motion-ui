// The MorphingSwitcher's shared scale — the one place one size decides the
// trigger's and every row's inset, gap, icon, type size and pane radius. The row
// height is not decided here: it is the shared interactive ramp, imported from
// the button family's BUTTON_SIZE as the pixel number the pane arithmetic needs
// (the row's `h-interactive-*` class compiles to the same token). A switcher
// therefore lines up with a Button or IconButton of the same size by
// construction, not by a copied number.
//
// Data only, no React — a sibling imports this without pulling in the switcher's
// morph machinery (morphing-switcher.tsx), and the parity tests import it to pin
// every row to the shared ramp.

import { BUTTON_SIZE } from '../../buttons/Button/button-scale';
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
  /** Trigger and row height in px — read from {@link BUTTON_SIZE}, not authored here. */
  height: number;
  /**
   * The row box. The height class names the shared `--spacing-interactive-*`
   * ramp (the same token {@link BUTTON_SIZE} `px` mirrors), so a switcher lines
   * up with a Button or IconButton of the same size. The horizontal padding is a
   * row's, not a button's (`--spacing-interactive-pad-*` is tuned for a label
   * hugged by a pill, far too wide for a full-width bar). `py-0` drops
   * {@link MenuItem}'s own vertical padding — the fixed height owns it.
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
    height: BUTTON_SIZE.sm.px,
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
    height: BUTTON_SIZE.md.px,
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
    height: BUTTON_SIZE.lg.px,
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
