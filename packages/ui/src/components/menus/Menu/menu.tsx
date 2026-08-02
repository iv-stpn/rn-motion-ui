// biome-ignore-all lint/style/useExportsLast: the entry types head the module so the components below read against them
/**
 * Menu — the list that goes *inside* a dropdown, a popover or a context menu.
 *
 * The anchored surfaces in this package (`AdaptiveDropdown`, `HoverMenu`,
 * `Popover`, `HoldContextMenu`) each own a panel: where it sits, how it opens,
 * when it closes. None of them own what is in it, so every consumer ends up
 * hand-rolling the same `View` of `MenuItem`s, the same hairline between groups,
 * and the same icon-gutter bookkeeping. This is that list, once.
 *
 * ## It is the inside, not the frame
 *
 * The list draws no surface, no border, no radius and — the one worth saying out
 * loud — **no padding**. Rows run edge to edge and separators span the full
 * width. Whatever holds the list decides how it is inset, because only that
 * component knows: a dropdown pads by a hair, a bottom sheet pads by more, a
 * sidebar column may pad on one axis only.
 *
 * ```tsx
 * // The frame is the caller's. `contentClassName` is AdaptiveDropdown's slot for it.
 * <AdaptiveDropdown contentClassName="p-1" trigger={trigger}>
 *   {({ close }) => <Menu entries={entries} onClose={close} />}
 * </AdaptiveDropdown>
 * ```
 *
 * One element does survive: the list renders a single `View` to hang
 * `role="menu"` and the accessible name on. It carries no classes of its own, so
 * it costs a node and changes no layout — a `Fragment` would be marginally
 * leaner and would leave the menu semantics with nowhere to live.
 *
 * ## The interface
 *
 * One `entries` array, holding four things in any order:
 *
 * | Entry | Renders |
 * | --- | --- |
 * | `{ id, label, … }` | a `MenuItem` row — the default, so `type` is optional |
 * | `{ type: 'separator' }` | a hairline between groups |
 * | `{ type: 'label', label }` | a group caption, readable but not selectable |
 * | `{ type: 'node', node }` | anything at all — a switch row, an input, a chart |
 *
 * A bare `ReactElement` is the shorthand for the last one, and `false` /
 * `null` / `undefined` entries are dropped, so a menu can be assembled with
 * `&&` inline rather than filtered first:
 *
 * ```tsx
 * <Menu
 *   onClose={close}
 *   entries={[
 *     { id: 'edit', label: 'Edit', icon: Pencil, onSelect: edit },
 *     { id: 'share', label: 'Share', icon: Share, onSelect: share },
 *     canDuplicate && { id: 'copy', label: 'Duplicate', icon: Copy, onSelect: copy },
 *     { type: 'separator' },
 *     <ViewDensityToggle key="density" />,
 *     { id: 'delete', label: 'Delete', icon: Trash2, destructive: true, onSelect: remove },
 *   ]}
 * />
 * ```
 *
 * ## What it does for you
 *
 * - **Closes the panel.** Give it `onClose` and every row calls it before its own
 *   `onSelect`, in that order — so an action that navigates does not leave the
 *   panel stranded on the old screen. Rows that should stay open (a checklist, a
 *   toggle) set `closeOnSelect: false`.
 * - **Aligns the labels.** If any row has an icon, the rows without one reserve
 *   the slot, so nothing shifts left. `iconGutter` forces it either way.
 * - **Carries the semantics.** `role="menu"` on the list, `menuitem` on each row,
 *   selected/disabled state on both a11y trees. A group caption is
 *   `presentation` — readable, never offered as a dead command. Set
 *   `role="none"` when the panel around it already announces itself as a menu.
 *
 * ## What it deliberately does not do
 *
 * **No frame.** No background, no border, no radius, no padding, no width, no
 * scrolling. The rows go edge to edge and the surface around them belongs to
 * whatever is holding it — `AdaptiveDropdown`'s panel, `HoldContextMenu`'s, a
 * `Card`, a sidebar column. A menu that painted its own surface would sit as a
 * second visible box inside the first one, and its padding would fight the
 * panel's.
 *
 * That includes the inset: pass `contentClassName="p-1"` to `AdaptiveDropdown`,
 * or `className="p-1"` here, and pick whichever of the two owns it in your app —
 * but only one of them.
 *
 * The list element that remains is not a frame; it exists to carry `role="menu"`
 * and the accessible name, and to space the rows in `'sidebar'` mode where they
 * are individually rounded. It has no visual styling.
 */

import { Fragment, isValidElement, type ReactElement, type ReactNode, useCallback } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { Text } from '../../typography/Text/text';
import { MenuItem, type MenuItemIcon, type MenuItemMode, type MenuItemSize } from '../MenuItem/menu-item';

/** An action row — the default entry, so `type` may be omitted. */
export type MenuActionEntry = {
  type?: 'item';
  /** Stable identity for the row. Also used as its React key and to build its testID. */
  id: string;
  /** Row label. A string keeps the row single-line; a node is rendered as-is. */
  label: ReactNode;
  /** Leading icon. */
  icon?: MenuItemIcon;
  /** Runs on press, after the panel has been told to close. */
  onSelect?: () => void;
  /** Marks the row as the active/selected one — highlight fill plus `selected` state. */
  active?: boolean;
  /** Greys the row out, blocks the press, and says so to assistive tech. */
  disabled?: boolean;
  /** Paints the label and icon in the `danger` token — "Delete", "Revoke", "Leave". */
  destructive?: boolean;
  /** Trailing node — a shortcut hint, a badge, a submenu chevron. Rendered as-is. */
  trailing?: ReactNode;
  /**
   * Whether choosing this row closes the panel. Turn it off for rows that toggle
   * something and should stay put — a checklist, a density switch.
   * @default true
   */
  closeOnSelect?: boolean;
  /** Overrides the announced name when `label` is a node rather than a string. */
  accessibilityLabel?: string;
  /** Per-row override of the menu's `size`. */
  size?: MenuItemSize;
  /** Per-row override of the menu's `mode`. */
  mode?: MenuItemMode;
  /**
   * Puts the icon in a coloured rounded square (iOS settings rows). The row then
   * ignores `mode`, as `MenuItem`'s icon-tile variant does.
   */
  iconBackgroundColor?: string;
  /** Icon stroke colour when `iconBackgroundColor` is set. @default 'white' */
  iconColor?: string;
  className?: string;
  testID?: string;
};

/** A hairline between two groups of rows. */
export type MenuSeparatorEntry = { type: 'separator'; id?: string; className?: string };

/** A caption naming the group below it. Readable, never selectable. */
export type MenuLabelEntry = { type: 'label'; id?: string; label: ReactNode; className?: string };

/** Anything at all, dropped into the list as-is. */
export type MenuNodeEntry = { type: 'node'; id?: string; node: ReactNode; className?: string };

/**
 * One thing in a menu. A bare `ReactElement` is shorthand for
 * `{ type: 'node' }`, and falsy entries are dropped so a list can be built with
 * `&&` inline.
 */
export type MenuEntry =
  | MenuActionEntry
  | MenuSeparatorEntry
  | MenuLabelEntry
  | MenuNodeEntry
  | ReactElement
  | false
  | null
  | undefined;

export type MenuProps = {
  /** The list, in render order. See {@link MenuEntry}. */
  entries: readonly MenuEntry[];
  /**
   * Closes the surrounding panel. Every row calls it before its own `onSelect`
   * unless the row sets `closeOnSelect: false`. Wire it to the `close` a
   * dropdown's render prop hands you.
   */
  onClose?: () => void;
  /** Called after any row's own `onSelect`, with that row. Handy for analytics. */
  onSelect?: (entry: MenuActionEntry) => void;
  /**
   * Row size — row padding, icon dimensions, label ramp, and the caption and
   * separator spacing that goes with them. Not the frame around the list: that
   * is the panel's, at whatever size. @default 'md'
   */
  size?: MenuItemSize;
  /**
   * `'menu'` — flush rows, highlight overlay (dropdowns, context menus).
   * `'sidebar'` — rounded rows with a gap, muted until active (nav lists).
   * @default 'menu'
   */
  mode?: MenuItemMode;
  /**
   * Whether rows without an icon reserve the icon slot so every label lines up.
   * `'auto'` turns it on when at least one row has one. @default 'auto'
   */
  iconGutter?: 'auto' | 'on' | 'off';
  /**
   * `'menu'` (default) announces the list as a menu and each row as a menuitem.
   * `'none'` drops the list's own role — use it when the panel around it already
   * carries `role="menu"` (`HoldContextMenu`'s does), so the two don't nest.
   */
  role?: 'menu' | 'none';
  /** Accessible name for the list. */
  accessibilityLabel?: string;
  /**
   * Merged onto the list element. That element has no styling of its own, so
   * this is additive rather than an override — see the note on the frame in the
   * module header before reaching for it.
   */
  className?: string;
  testID?: string;
};

/**
 * Per-size metrics — all of it *between* the rows, none of it around them: the
 * gap for the rounded rows of sidebar mode, the breathing room a separator takes
 * from its neighbours, and the caption's own padding (matching the row padding at
 * that size, so a group label lines up with the labels under it).
 *
 * There is deliberately no entry for the list's own padding. See {@link Menu}.
 */
const SIZE_SCALE: Record<MenuItemSize, { gapClass: string; separatorClass: string; labelClass: string }> = {
  sm: { gapClass: 'gap-0.5', separatorClass: 'my-0.5', labelClass: 'px-2 pt-1 pb-0.5' },
  md: { gapClass: 'gap-0.5', separatorClass: 'my-1', labelClass: 'px-3 pt-1.5 pb-0.5' },
  lg: { gapClass: 'gap-1', separatorClass: 'my-1.5', labelClass: 'px-4 pt-2 pb-1' },
};

export type MenuSeparatorProps = { className?: string };

/** The hairline between two groups. Exported so a `node` entry can draw a matching one. */
export function MenuSeparator({ className }: MenuSeparatorProps) {
  return <View className={cn('h-px bg-border', className)} />;
}

export type MenuLabelProps = { children: ReactNode; className?: string };

/** The caption above a group. Exported for the same reason as {@link MenuSeparator}. */
export function MenuLabel({ children, className }: MenuLabelProps) {
  return (
    // Not a menuitem — it does nothing when pressed. `presentation` drops the
    // wrapper from the tree while leaving its text readable, so a screen reader
    // reaches the caption without being offered a dead command.
    <View className={className} role="presentation">
      <Text className="text-muted-foreground" numberOfLines={1} size="xs" weight="medium">
        {children}
      </Text>
    </View>
  );
}

type MenuRowProps = {
  entry: MenuActionEntry;
  size: MenuItemSize;
  mode: MenuItemMode;
  iconPlaceholder: boolean;
  isMenu: boolean;
  reduce: boolean;
  onClose?: () => void;
  onSelect?: (entry: MenuActionEntry) => void;
  testID?: string;
};

/** One action row. Its own component so `onPress` is a stable per-row callback. */
function MenuRow({ entry, size, mode, iconPlaceholder, isMenu, reduce, onClose, onSelect, testID }: MenuRowProps) {
  const handlePress = useCallback(() => {
    // Close first, then act: the panel starts leaving while the action runs, so
    // an action that navigates does not leave a modal stranded on the old screen.
    if (entry.closeOnSelect !== false) onClose?.();
    entry.onSelect?.();
    onSelect?.(entry);
  }, [entry, onClose, onSelect]);

  return (
    <MenuItem
      accessibilityLabel={entry.accessibilityLabel}
      accessibilityRole={isMenu ? 'menuitem' : undefined}
      // `selected` rides alongside the `disabled` Pressable already reports.
      accessibilityState={{ selected: entry.active }}
      active={entry.active}
      // Web: RN maps `disabled` to the DOM attribute, which is not read on a
      // non-form element; `aria-disabled` is what leaves the row announced.
      aria-disabled={entry.disabled}
      className={entry.className}
      destructive={entry.destructive}
      disabled={entry.disabled}
      icon={entry.icon}
      iconBackgroundColor={entry.iconBackgroundColor}
      iconColor={entry.iconColor}
      iconPlaceholder={iconPlaceholder}
      label={entry.label}
      mode={entry.mode ?? mode}
      onPress={handlePress}
      reduce={reduce}
      size={entry.size ?? size}
      testID={entry.testID ?? (testID ? `${testID}-item-${entry.id}` : undefined)}
      trailing={entry.trailing}
    />
  );
}

/** Tells the bare-element shorthand apart from the four entry objects. */
function isElementEntry(entry: MenuEntry): entry is ReactElement {
  return isValidElement(entry);
}

/** An action row — the entry with no `type` of its own, or an explicit `'item'`. */
function isActionEntry(entry: RenderableEntry): entry is MenuActionEntry {
  return !isElementEntry(entry) && (entry.type ?? 'item') === 'item';
}

/** A `MenuEntry` with the falsy members dropped — what actually renders. */
type RenderableEntry = MenuActionEntry | MenuSeparatorEntry | MenuLabelEntry | MenuNodeEntry | ReactElement;

/** An entry paired with the React key the list renders it under. */
type KeyedEntry = { key: string; entry: RenderableEntry };

/**
 * Drops the falsy entries and pairs what is left with a key.
 *
 * An action row is keyed by its `id`. The other three have nothing intrinsic to
 * key by — a separator is not *about* anything — so they take an explicit `id`
 * when given one and otherwise fall back to a per-type running count
 * (`separator-0`, `separator-1`, …). That is positional, deliberately: entry
 * lists are authored in source rather than sorted or reordered at runtime, and
 * none of the three holds state that a re-key would lose. A `node` entry that
 * does hold state — an input mid-edit, a video mid-play — should carry an `id`.
 */
function keyEntries(entries: readonly MenuEntry[]): KeyedEntry[] {
  const counts = new Map<string, number>();
  const nextKey = (type: string) => {
    const seen = counts.get(type) ?? 0;
    counts.set(type, seen + 1);
    return `${type}-${seen}`;
  };

  return entries
    .filter((entry): entry is RenderableEntry => Boolean(entry))
    .map((entry) => {
      // An element written inline should not have to be keyed by its author, but
      // one that was keyed keeps that key — it may be identifying real state.
      if (isElementEntry(entry)) return { key: entry.key ?? nextKey('node'), entry };
      return { key: entry.id ?? nextKey(entry.type ?? 'item'), entry };
    });
}

/**
 * A menu list for the inside of an anchored panel — action rows, separators,
 * group captions and arbitrary nodes from one `entries` array.
 *
 * See the module header for the entry shapes and what the list handles on your
 * behalf (closing the panel, aligning labels, carrying the a11y semantics).
 *
 * @example
 * // Inside a dropdown: the render prop's `close` is what makes rows dismiss it.
 * <AdaptiveDropdown trigger={trigger}>
 *   {({ close }) => <Menu onClose={close} entries={entries} />}
 * </AdaptiveDropdown>
 */
export function Menu({
  entries,
  onClose,
  onSelect,
  size = 'md',
  mode = 'menu',
  iconGutter = 'auto',
  role = 'menu',
  accessibilityLabel,
  className,
  testID,
}: MenuProps) {
  const reduce = useReducedMotion();
  const scale = SIZE_SCALE[size];
  const isMenu = role === 'menu';

  const keyed = keyEntries(entries);
  // Reserve the icon slot on iconless rows only when the menu is actually mixed —
  // a list where nothing has an icon should not be indented by a phantom gutter.
  const hasIcon = keyed.some(({ entry }) => isActionEntry(entry) && Boolean(entry.icon));
  const iconPlaceholder = iconGutter === 'auto' ? hasIcon : iconGutter === 'on';

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
      // No padding, no background, no radius: the panel around it owns the frame.
      // A `View` is column by default, so the only class here is the inter-row gap.
      className={cn(mode === 'sidebar' && scale.gapClass, className)}
      role={isMenu ? 'menu' : undefined}
      testID={testID}
    >
      {keyed.map(({ key, entry }) => {
        // A caller writing an element inline should not have to key it, so the
        // Fragment carries the one `keyEntries` assigned and adds no node.
        if (isElementEntry(entry)) return <Fragment key={key}>{entry}</Fragment>;

        switch (entry.type) {
          case 'separator':
            return <MenuSeparator className={cn(scale.separatorClass, entry.className)} key={key} />;
          case 'label':
            return (
              <MenuLabel className={cn(scale.labelClass, entry.className)} key={key}>
                {entry.label}
              </MenuLabel>
            );
          case 'node':
            return (
              <View className={entry.className} key={key}>
                {entry.node}
              </View>
            );
          default:
            return (
              <MenuRow
                entry={entry}
                iconPlaceholder={iconPlaceholder && !entry.icon}
                isMenu={isMenu}
                key={key}
                mode={mode}
                onClose={onClose}
                onSelect={onSelect}
                reduce={reduce}
                size={size}
                testID={testID}
              />
            );
        }
      })}
    </View>
  );
}
