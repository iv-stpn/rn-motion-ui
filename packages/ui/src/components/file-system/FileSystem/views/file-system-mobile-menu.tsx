/** biome-ignore-all lint/style/useExportsLast: the two testID suffixes belong with the control that derives them */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: the testID suffixes are part of the control's public contract */
// The per-entry trailing control shared by the two mobile views.
//
// Two shapes, one slot. When nothing is selected it is a kebab — tapping it opens
// the entry's context menu through the same `HoldContextMenu`/`useContextMenu`
// plumbing the desktop views use, but summoned on a tap rather than a hold, and
// the same tap selects the entry (the menu's `onHold` rides any activation, a tap
// included). Once anything is selected it becomes a checkbox, checked for the
// selected entry and empty otherwise, so the mobile views reveal a multi-select
// surface the moment a long-press picks the first item.

import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { CheckCircleFill } from 'rn-motion-ui-icons/icons/check-circle-fill';
import { More2Line as More } from 'rn-motion-ui-icons/icons/more-2-line';
import { RoundLine } from 'rn-motion-ui-icons/icons/round-line';
import { ThemedIcon } from '../../../icon/themed-icon';
import { HoldContextMenu } from '../../../menus/HoldContextMenu/hold-context-menu';
import { useFileSystemScrubGesture } from '../hooks/use-file-system-scrub';
import { type ContextMenuHookReturn, useContextMenu } from '../shell/file-system-context-menu';
import type { FileSystemContextMenuAction, FileSystemEntry, FileSystemItem } from '../types/file-system.types';

/** Suffix the kebab's `testID` appends to the entry's — `<root>-entry-<path>-kebab`. */
export const MOBILE_KEBAB_SUFFIX = '-kebab';
/** Suffix the checkbox's `testID` appends to the entry's — `<root>-entry-<path>-checkbox`. */
export const MOBILE_CHECKBOX_SUFFIX = '-checkbox';

type FileSystemMobileMenuProps = {
  entry: FileSystemEntry;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  /** Any entry selected — the kebab yields to a checkbox. */
  selecting: boolean;
  isSelected: boolean;
  onToggleSelect: (entry: FileSystemEntry) => void;
  /** Start a scrub drag from this entry's checkbox, at the finger's window position — only wired while `selecting`. */
  onScrubStart: (entry: FileSystemEntry, x: number, y: number) => void;
  /** The finger's window position during a scrub. */
  onScrubMove: (x: number, y: number) => void;
  /** The scrub ended. */
  onScrubEnd: () => void;
  /** The entry's resolved `testID` (`<root>-entry-<path>`), which the control derives its own from. */
  testID?: string;
};

type MobileCheckboxProps = Pick<
  FileSystemMobileMenuProps,
  'entry' | 'isSelected' | 'onToggleSelect' | 'onScrubStart' | 'onScrubMove' | 'onScrubEnd' | 'testID'
>;

/** The selection-mode shape: a checkbox whose tap toggles the entry in or out of the selection, and whose hold-drag scrubs a run. */
function MobileCheckbox({
  entry,
  isSelected,
  onToggleSelect,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
  testID,
}: MobileCheckboxProps) {
  const handleToggle = useCallback(() => onToggleSelect(entry), [entry, onToggleSelect]);
  // Pre-bind the entry so the gesture's `onStart` position can still tell the view
  // which entry the scrub began on — the entry names the start row/tile, the
  // position lets the view calibrate the finger→content offset off it.
  const handleScrubStart = useCallback((x: number, y: number) => onScrubStart(entry, x, y), [entry, onScrubStart]);

  const gesture = useFileSystemScrubGesture({ onStart: handleScrubStart, onMove: onScrubMove, onEnd: onScrubEnd });

  const checkbox = (
    <Pressable
      accessibilityLabel={isSelected ? `Deselect ${entry.name}` : `Select ${entry.name}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      // Both, deliberately: native reads `accessibilityState`, RNW maps `aria-checked` — see Checkbox.
      aria-checked={isSelected}
      className="size-7 items-center justify-center"
      onPress={handleToggle}
      testID={testID ? `${testID}${MOBILE_CHECKBOX_SUFFIX}` : undefined}
    >
      <ThemedIcon icon={isSelected ? CheckCircleFill : RoundLine} size={20} token={isSelected ? 'primary' : 'muted-foreground'} />
    </Pressable>
  );

  // The scrub is native-only (`null` on web). `collapsable={false}` keeps the gesture
  // host in the Android hierarchy inside the enclosing ScrollView — the same note the
  // hold/drag primitives carry.
  return gesture === null ? (
    checkbox
  ) : (
    <GestureDetector gesture={gesture}>
      <View collapsable={false}>{checkbox}</View>
    </GestureDetector>
  );
}

type MobileKebabProps = Pick<FileSystemMobileMenuProps, 'entry' | 'onToggleSelect' | 'testID'> & {
  /**
   * The entry's menu state, resolved by the slot so the slot and the kebab read
   * the same `open` — the slot's shape decision depends on it.
   */
  menuProps: ContextMenuHookReturn['menuProps'];
};

/**
 * The default shape: a kebab whose tap opens the entry's context menu — and,
 * through the same gesture, selects the entry.
 *
 * `HoldContextMenu` wires its `onHold` prop through `afterHold`, which
 * `openMenu` fires on *any* activation, a tap included — so passing the
 * additive toggle here makes a kebab tap select the entry (row highlighted,
 * selection mode on) at the same moment the menu opens. The slot keeps the
 * kebab mounted while this menu is open, so the selection the tap just produced
 * cannot unmount the menu underneath it (see `FileSystemMobileMenu`).
 */
function MobileKebab({ entry, menuProps, onToggleSelect, testID }: MobileKebabProps) {
  // Stable handle for `HoldContextMenu onHold`, which rides `afterHold` — a
  // fresh arrow per render would rebuild the hook's `latest` ref on every
  // render of the slot.
  const handleHold = useCallback(() => onToggleSelect(entry), [entry, onToggleSelect]);

  return (
    <HoldContextMenu
      accessibilityLabel={`More actions for ${entry.name}`}
      activateOn="tap"
      onHold={handleHold}
      trigger="pressable"
      testID={testID ? `${testID}${MOBILE_KEBAB_SUFFIX}` : undefined}
      {...menuProps}
    >
      <View className="size-7 items-center justify-center">
        <ThemedIcon icon={More} size={16} token="muted-foreground" />
      </View>
    </HoldContextMenu>
  );
}

/**
 * The kebab-or-checkbox trailing control. `selecting` picks the shape; a `null`
 * return hides it entirely when there is no context menu to offer and no
 * selection to toggle into.
 *
 * One wrinkle: while the kebab's *own* menu is open the kebab stays in the slot
 * even though `selecting` is true. The kebab tap both opens the menu and selects
 * the entry (see `MobileKebab`), and the overlay lives in a Modal rendered by the
 * kebab's `HoldContextMenu` — flipping the slot to the checkbox under the open
 * menu would unmount that menu in the same commit that produced it. The flip
 * waits for the menu to close; `selecting` alone decides the shape from then on.
 */
export function FileSystemMobileMenu(props: FileSystemMobileMenuProps) {
  // Resolved here, not inside `MobileKebab`, so the slot's shape decision and
  // the kebab's menu read the same `open` state.
  const { menuProps } = useContextMenu(props.entry, props.getContextMenuActions, props.onContextMenuAction);
  if (!props.getContextMenuActions) return props.selecting ? <MobileCheckbox {...props} /> : null;
  if (props.selecting && !menuProps.open) return <MobileCheckbox {...props} />;
  return <MobileKebab entry={props.entry} menuProps={menuProps} onToggleSelect={props.onToggleSelect} testID={props.testID} />;
}
