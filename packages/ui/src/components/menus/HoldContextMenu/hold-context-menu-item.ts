// biome-ignore-all lint/style/useExportsLast: the item type heads the module so the mapping below reads against it
/**
 * `HoldContextMenu`'s item type, and the translation from it to the `Menu`
 * entries the panel actually renders.
 *
 * The component used to draw its own rows — a port of react-native-hold-menu's
 * `menu/MenuItem.tsx` and `menu/Separator.tsx`, with its own hover and press
 * fills, its own disabled dimming, and its own heading branch. All of that is
 * `Menu`'s job now, so what is left here is a mapping: one `HoldContextMenuItem`
 * in, one {@link MenuEntry} out.
 *
 * The item type stays as it was. It is the component's public API, it reads in
 * upstream's vocabulary (`heading`, `separator`) rather than `Menu`'s, and a
 * `separator: true` flag on a row is not the same shape as a separator *entry*
 * standing between two rows — so the two are kept apart and this module converts.
 */

import type { ReactNode } from 'react';
import type { MenuActionEntry, MenuEntry } from '../../rows/menu';
import type { MenuItemIcon } from '../../rows/menu-item';
import { HOLD_MENU_HEADING_CLASS, HOLD_MENU_ROW_CLASS } from './hold-context-menu-layout';

/**
 * Leading icon renderer — any component taking the library's `IconProps`.
 *
 * Aliases `Menu`'s own icon type, since the rows are `Menu` rows: whatever the
 * list accepts, so does this.
 */
export type HoldContextMenuIcon = MenuItemIcon;

export type HoldContextMenuItem = {
  /** Stable identity for the row. Also used as its React key and to build its testID. */
  id: string;
  /** Row label. A string keeps the row single-line; a node is rendered as-is. */
  label: ReactNode;
  /** Leading icon, drawn at the row's start in the label's colour. */
  icon?: HoldContextMenuIcon;
  /** Runs on press. The panel closes first, so navigation here is safe. */
  onPress?: () => void;
  /**
   * Renders as a non-pressable caption instead of an action — upstream's
   * `isTitle`. Use it to name the held item or label a group.
   */
  heading?: boolean;
  /** Paints the label and icon in the `danger` token — upstream's `isDestructive`. */
  destructive?: boolean;
  /** Greys the row out and blocks the press, and says so to assistive tech. */
  disabled?: boolean;
  /**
   * Ends a group: a band below this row, separating it from the next.
   * Ignored on the last row. Upstream's `withSeparator`.
   */
  separator?: boolean;
  /** Overrides the announced name when `label` is a node rather than a string. */
  accessibilityLabel?: string;
};

/** One action row, with the panel's height floor on it. */
function actionEntry(item: HoldContextMenuItem, onSelect: (item: HoldContextMenuItem) => void): MenuActionEntry {
  return {
    accessibilityLabel: item.accessibilityLabel,
    className: HOLD_MENU_ROW_CLASS,
    destructive: item.destructive,
    disabled: item.disabled,
    icon: item.icon,
    id: item.id,
    label: item.label,
    onSelect: () => onSelect(item),
  };
}

/**
 * Turns the items into `Menu` entries.
 *
 * Two things are not one-to-one. A `heading` becomes a `label` entry, which is
 * the list's own non-interactive caption; and `separator: true` on a row becomes
 * a separate separator entry *after* that row, dropped on the last one where
 * there is nothing below to separate from.
 *
 * Every row carries the panel's own height floor (see {@link HOLD_MENU_ROW_CLASS})
 * so the pre-layout estimate can be exact.
 *
 * `onSelect` is called with the item and is the caller's whole handler: it closes
 * the panel, runs the item's `onPress` and reports upward, in that order. The
 * entries therefore set no `onClose` of their own — see the note in
 * `hold-context-menu-overlay.tsx`.
 */
export function holdMenuEntries(
  items: readonly HoldContextMenuItem[],
  onSelect: (item: HoldContextMenuItem) => void,
): MenuEntry[] {
  const entries: MenuEntry[] = [];

  for (const [index, item] of items.entries()) {
    if (item.heading) entries.push({ type: 'label', id: item.id, label: item.label, className: HOLD_MENU_HEADING_CLASS });
    else entries.push(actionEntry(item, onSelect));

    // A band ends a group, so the last row never draws one: there is nothing
    // below it to be separated from.
    if (item.separator && index < items.length - 1) entries.push({ type: 'separator', id: `${item.id}-separator` });
  }

  return entries;
}
