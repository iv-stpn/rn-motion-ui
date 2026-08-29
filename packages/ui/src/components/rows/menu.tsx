// biome-ignore-all lint/style/useExportsLast: the entry types head the module so the components below read against them
// biome-ignore-all lint/style/useComponentExportOnlyModules: the separator metric is exported alongside the components
/**
 * Menu — the list that goes *inside* a dropdown, a popover or a context menu.
 *
 * The anchored surfaces in this package (`AdaptiveDropdown`, `HoverMenu`,
 * `Popover`) each own a panel: where it sits, how it opens,
 * when it closes. None of them own what is in it, so every consumer ends up
 * hand-rolling the same `View` of `MenuItem`s, the same hairline between groups,
 * and the same icon-gutter bookkeeping. This is that list, once.
 *
 * ## It is the inside, not the frame
 *
 * The list draws no surface, no border, no radius and no width. Rows run edge to
 * edge horizontally and separators span the full width, because a row's press
 * highlight reaching the panel's sides is what makes it read as a menu row rather
 * than a floating button.
 *
 * The one thing it does own is its **vertical** inset. A row flush against a
 * rounded panel edge is wrong in every panel that holds this list, so the list
 * caps itself top and bottom rather than making four containers each remember to.
 * The frame around it stays the caller's:
 *
 * ```tsx
 * // Surface, radius and width are the panel's; the top and bottom inset is the list's.
 * <AdaptiveDropdown trigger={trigger} width={260}>
 *   {({ close }) => <Menu entries={entries} onClose={close} />}
 * </AdaptiveDropdown>
 * ```
 *
 * Pass `className="py-*"` to retune that inset, or `py-0` to drop it — a panel
 * that has to predict its own height before layout wants a number it pinned
 * itself, which is what the file-system background menu does.
 *
 * The list renders a single `View` to hang `role="menu"`, the accessible name and
 * that inset on — a `Fragment` would be marginally leaner and would leave the
 * menu semantics with nowhere to live.
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
 * - **Names every entry for tests.** Give the list a `testID` and each entry
 *   derives one from it, so a row, a caption or a separator can be reached
 *   without a role query. See {@link MenuProps.testID}.
 * - **Carries the semantics.** `role="menu"` on the list, `menuitem` on each row,
 *   selected/disabled state on both a11y trees. A group caption is
 *   `presentation` — readable, never offered as a dead command. Set
 *   `role="none"` when the panel around it already announces itself as a menu.
 *
 * ## What it deliberately does not do
 *
 * **No frame.** No background, no border, no radius, no horizontal padding, no
 * width, no scrolling. The rows go edge to edge and the surface around them
 * belongs to whatever is holding it — `AdaptiveDropdown`'s panel, a `Card`, a
 * sidebar column. A menu that painted its own
 * surface would sit as a second visible box inside the first one.
 *
 * The vertical inset is the exception, and the reason is that it is not really
 * part of the frame: it is the space the first and last row need from the panel's
 * rounded corners, which is the same in every panel. Horizontal padding is not,
 * so it stays out — indent the rows and the highlight stops reaching the edge.
 *
 * The list element that remains is not a frame; it carries `role="menu"`, the
 * accessible name, that vertical inset, and the gap between the individually
 * rounded rows of `'sidebar'` mode.
 */

import { Fragment, isValidElement, type ReactElement, type ReactNode, useCallback } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { MotiView } from '../../moti/components/view';
import { MENU_ITEM_STAGGER_MS, MOTION_STANDARD, TIMING_INSTANT } from '../../theme/motion';
import { Text } from '../typography/Text/text';
import { MenuItem, type MenuItemIcon, type MenuItemMode, type MenuItemSize, type MenuVariant } from './menu-item';

export type { MenuVariant } from './menu-item';

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
export type MenuSeparatorEntry = { type: 'separator'; id?: string; className?: string; testID?: string };

/** A caption naming the group below it. Readable, never selectable. */
export type MenuLabelEntry = { type: 'label'; id?: string; label: ReactNode; className?: string; testID?: string };

/** Anything at all, dropped into the list as-is. */
export type MenuNodeEntry = { type: 'node'; id?: string; node: ReactNode; className?: string; testID?: string };

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
   * `'none'` drops the list's own role — for a panel that already carries
   * `role="menu"` itself, so the two don't nest one menu inside another. The
   * panels in this package leave the role to the list, which is the arrangement
   * that puts each `menuitem` directly inside the element owning `menu`.
   */
  role?: 'menu' | 'none';
  /**
   * Row style. `'base'` (default) is the CommandPalette look — icon leading, no
   * borders between rows. `'segmented'` is the hold-menu look — icon trailing,
   * a hairline below each row but the last, centred captions and solid band
   * separators. See {@link MenuVariant}. @default 'base'
   */
  variant?: MenuVariant;
  /** Accessible name for the list. */
  accessibilityLabel?: string;
  /**
   * Merged onto the list element. The only style that element carries of its own
   * is the vertical inset, so `py-*` here replaces it (`py-0` drops it) and
   * everything else is additive — see the note on the frame in the module header
   * before reaching for it.
   */
  className?: string;
  /**
   * Goes on the list element, and every entry derives its own from it:
   *
   * | Entry | testID |
   * | --- | --- |
   * | action row | `<testID>-item-<id>` |
   * | separator / caption / node | `<testID>-<id>` |
   *
   * An action row is named by its `id`, which it always has. The other three
   * are named by the React key instead — the same string, when they carry an
   * `id`, and a positional `separator-0` / `label-1` fallback when they don't,
   * which is the one name guaranteed not to collide with a neighbour.
   *
   * Any entry's own `testID` overrides its derived one, and with no `testID`
   * here nothing is named at all.
   */
  testID?: string;
};

/**
 * Per-size metrics — all of it *between* the rows, none of it around them: the
 * gap for the rounded rows of sidebar mode, the breathing room a separator takes
 * from its neighbours, and the caption's own padding (matching the row padding at
 * that size, so a group label lines up with the labels under it).
 *
 * The list's own vertical inset is not here on purpose: it is the gap the end
 * rows need from a rounded panel corner, which is a property of the panel rather
 * than of the row scale, so it is one fixed value at every size. See {@link Menu}.
 */
const SIZE_SCALE: Record<MenuItemSize, { gapClass: string; labelClass: string }> = {
  sm: { gapClass: 'gap-0.5', labelClass: 'px-2 pt-0.5 pb-1' },
  md: { gapClass: 'gap-0.5', labelClass: 'px-3 pt-0.5 pb-1.5' },
  lg: { gapClass: 'gap-1', labelClass: 'px-4 pt-1 pb-2' },
};
/** One text-size step below each menu size — keeps the caption subordinate to the rows. */
const LABEL_TEXT_SIZE: Record<MenuItemSize, 'xs' | 'sm' | 'base'> = { sm: 'xs', md: 'sm', lg: 'base' };

/**
 * Total vertical space a `separator` entry takes at each size.
 *
 * Published because a panel that places itself *before* it has been laid out has
 * to predict its own height, and a separator is the one entry whose height is
 * fixed in px rather than following a text line box — every other entry ends up
 * as tall as its text line box, which is a font measurement no caller can do
 * ahead of layout.
 *
 * The panel's height estimate (`HOLD_MENU_SEPARATOR_HEIGHT` in `menu-placement`)
 * mirrors the `md` value rather than importing it: that layout module is
 * deliberately free of component imports so it stays a pure unit under test. This
 * constant is what that mirror points at — retune the scale above and the two
 * numbers to check are here and in `HOLD_MENU_SEPARATOR_HEIGHT`.
 */
export const MENU_SEPARATOR_HEIGHT: Record<MenuItemSize, number> = {
  sm: 5, // h-px (1px) + my-0.5 (2px ×2)
  md: 10, // h-0.5 (2px) + my-1   (4px ×2)
  lg: 16, // h-1   (4px) + my-1.5 (6px ×2)
};

export type MenuSeparatorProps = { className?: string; testID?: string; size?: MenuItemSize; variant?: MenuVariant };

const SEPARATOR_SIZE_CLASS: Record<MenuItemSize, string> = { sm: 'h-px my-0.5', md: 'h-0.5 my-1', lg: 'h-1 my-1.5' };

/**
 * The `'segmented'` separator: a solid band between groups, no margin. Its `md`
 * height (8 px) is mirrored by `HOLD_MENU_SEGMENTED_SEPARATOR_HEIGHT` in
 * `menu-placement`, so a panel that predicts its own height before layout can.
 */
const SEGMENTED_SEPARATOR_CLASS: Record<MenuItemSize, string> = { sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' };

/** The hairline between two groups. Exported so a `node` entry can draw a matching one. */
export function MenuSeparator({ className, testID, size = 'md', variant = 'base' }: MenuSeparatorProps) {
  const sizeClass = variant === 'segmented' ? SEGMENTED_SEPARATOR_CLASS[size] : SEPARATOR_SIZE_CLASS[size];
  return <View className={cn('bg-border', sizeClass, className)} testID={testID} />;
}

export type MenuLabelProps = {
  children: ReactNode;
  className?: string;
  testID?: string;
  size?: MenuItemSize;
  variant?: MenuVariant;
  /** Draws the hairline below a `'segmented'` caption, like the rows around it. */
  bottomBorder?: boolean;
};

/** The caption above a group. Exported for the same reason as {@link MenuSeparator}. */
export function MenuLabel({ children, className, testID, size = 'md', variant = 'base', bottomBorder = false }: MenuLabelProps) {
  // `'segmented'` titles are centred full rows — the hold-menu section header —
  // not the small left-aligned caption the base list uses.
  return (
    <View
      className={cn(
        variant === 'segmented' && 'min-h-10 items-center justify-center px-4',
        variant === 'segmented' && bottomBorder && 'border-border border-b-[1.5px]',
        className,
      )}
      role="presentation"
      testID={testID}
    >
      <Text className="text-muted-foreground" numberOfLines={1} size={LABEL_TEXT_SIZE[size]}>
        {children}
      </Text>
    </View>
  );
}

type MenuRowProps = {
  entry: MenuActionEntry;
  size: MenuItemSize;
  mode: MenuItemMode;
  variant: MenuVariant;
  bottomBorder: boolean;
  iconPlaceholder: boolean;
  isMenu: boolean;
  reduce: boolean;
  /** Zero-based position among action rows — drives the staggered enter delay. */
  index: number;
  onClose?: () => void;
  onSelect?: (entry: MenuActionEntry) => void;
  testID?: string;
};

/** One action row. Its own component so `onPress` is a stable per-row callback. */
function MenuRow({
  entry,
  size,
  mode,
  variant,
  bottomBorder,
  iconPlaceholder,
  isMenu,
  reduce,
  onClose,
  onSelect,
  testID,
  index,
}: MenuRowProps) {
  const handlePress = useCallback(() => {
    // Close first, then act: the panel starts leaving while the action runs, so
    // an action that navigates does not leave a modal stranded on the old screen.
    if (entry.closeOnSelect !== false) onClose?.();
    entry.onSelect?.();
    onSelect?.(entry);
  }, [entry, onClose, onSelect]);

  // Each row fades and slides in from the side, staggered 25 ms apart so the list
  // reads as arriving rather than popping into place. Reduced motion skips both
  // the travel and the stagger — the row appears in place.
  const staggerDelay = reduce ? 0 : index * MENU_ITEM_STAGGER_MS;

  return (
    <MotiView
      animate={{ opacity: 1, translateX: 0 }}
      from={reduce ? { opacity: 1 } : { opacity: 0, translateX: -8 }}
      transition={reduce ? TIMING_INSTANT : { ...MOTION_STANDARD, delay: staggerDelay }}
    >
      <MenuItem
        accessibilityLabel={entry.accessibilityLabel}
        accessibilityRole={isMenu ? 'menuitem' : undefined}
        // `selected` rides alongside the `disabled` Pressable already reports.
        accessibilityState={{ selected: entry.active }}
        active={entry.active}
        // Web: RN maps `disabled` to the DOM attribute, which is not read on a
        // non-form element; `aria-disabled` is what leaves the row announced.
        aria-disabled={entry.disabled}
        bottomBorder={bottomBorder}
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
        variant={variant}
      />
    </MotiView>
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
  variant = 'base',
  accessibilityLabel,
  className,
  testID,
}: MenuProps) {
  const reduce = useReducedMotion();
  const scale = SIZE_SCALE[size];
  const isMenu = role === 'menu';
  const segmented = variant === 'segmented';

  const keyed = keyEntries(entries);
  // Reserve the icon slot on iconless rows only when the menu is actually mixed —
  // a list where nothing has an icon should not be indented by a phantom gutter.
  // `'segmented'` has no leading gutter to reserve: its icons sit trailing.
  const hasIcon = keyed.some(({ entry }) => isActionEntry(entry) && Boolean(entry.icon));
  const iconPlaceholder = !segmented && (iconGutter === 'auto' ? hasIcon : iconGutter === 'on');

  // `'segmented'` draws a hairline below every row but the last, so name that
  // last row up front — the last action row or caption — instead of per entry.
  const lastRowKey = segmented
    ? keyed.filter(({ entry }) => isActionEntry(entry) || entry.type === 'label').at(-1)?.key
    : undefined;

  const list = (
    <View
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
      className={cn(mode === 'sidebar' && scale.gapClass, !segmented && 'py-(--menu-vertical-padding)', className)}
      role={isMenu ? 'menu' : undefined}
      testID={testID}
    >
      {(() => {
        let actionIndex = 0;
        return keyed.map(({ key, entry }) => {
          // A caller writing an element inline should not have to key it, so the
          // Fragment carries the one `keyEntries` assigned and adds no node.
          if (isElementEntry(entry)) return <Fragment key={key}>{entry}</Fragment>;

          // The non-action entries take the React key rather than the bare `id` an
          // action row uses: `key` is the one string `keyEntries` already
          // guarantees is unique across the list, so an unnamed separator gets a
          // stable `-separator-0` instead of colliding with its neighbours.
          const entryTestID = entry.testID ?? (testID ? `${testID}-${key}` : undefined);

          switch (entry.type) {
            case 'separator':
              return <MenuSeparator size={size} className={entry.className} key={key} testID={entryTestID} variant={variant} />;
            case 'label':
              return (
                <MenuLabel
                  bottomBorder={segmented && key !== lastRowKey}
                  className={cn(!segmented && scale.labelClass, entry.className)}
                  key={key}
                  size={size}
                  testID={entryTestID}
                  variant={variant}
                >
                  {entry.label}
                </MenuLabel>
              );
            case 'node':
              return (
                <View className={entry.className} key={key} testID={entryTestID}>
                  {entry.node}
                </View>
              );
            default:
              actionIndex += 1; // the `MenuRow` below also increments, but this is the one that counts for the stagger
              return (
                <MenuRow
                  bottomBorder={segmented && key !== lastRowKey}
                  entry={entry}
                  iconPlaceholder={iconPlaceholder && !entry.icon}
                  index={actionIndex}
                  isMenu={isMenu}
                  key={key}
                  mode={mode}
                  onClose={onClose}
                  onSelect={onSelect}
                  reduce={reduce}
                  size={size}
                  testID={testID}
                  variant={variant}
                />
              );
          }
        });
      })()}
    </View>
  );

  return list;
}
