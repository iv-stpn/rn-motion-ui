/** biome-ignore-all lint/style/useExportsLast: the two testID suffixes belong with the control that derives them */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: the testID suffixes are part of the control's public contract */
// The per-entry trailing control shared by the two mobile views.
//
// Two shapes, one slot. When nothing is selected it is a kebab — tapping it opens
// the entry's context menu through the same `HoldItem`/`useContextMenu`
// plumbing the desktop views use, but summoned on a tap rather than a hold, and
// the same tap selects the entry (the menu's `onHold` rides any activation, a tap
// included). Once anything is selected it becomes a checkbox, checked for the
// selected entry and empty otherwise, so the mobile views reveal a multi-select
// surface the moment a long-press picks the first item.

import { useCallback, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { CheckCircleFill } from 'rn-motion-ui-icons/icons/check-circle-fill';
import { More2Line as More } from 'rn-motion-ui-icons/icons/more-2-line';
import { RoundLine } from 'rn-motion-ui-icons/icons/round-line';
import { useReducedMotion } from '../../../../hooks/use-reduced-motion';
import { ThemedIcon } from '../../../icon/themed-icon';
import { HoldItem } from '../../../menus/HoldMenu/hold-menu';
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
  /** This entry is under the finger right now during a scrub — the checkbox it owns bounces. */
  isScrubTarget: boolean;
};

type MobileCheckboxProps = Pick<
  FileSystemMobileMenuProps,
  'entry' | 'isSelected' | 'onToggleSelect' | 'onScrubStart' | 'onScrubMove' | 'onScrubEnd' | 'testID' | 'isScrubTarget'
>;

/** The selection-mode shape: a checkbox whose tap toggles the entry in or out of the selection, and whose hold-drag scrubs a run. */
function MobileCheckbox({
  entry,
  isSelected,
  isScrubTarget,
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

  // The drag-select cue: as the scrub crosses onto this checkbox, give it a quick
  // squeeze then a spring back — the same "you are on me" pulse the tick haptic
  // signals in the hand. Only the entry under the finger animates; a reduced-motion
  // preference pins the scale at full size.
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);

  // biome-ignore lint/plugin: triggering a Reanimated withSequence on a shared value in response to a prop change requires a side effect
  useEffect(() => {
    if (!isScrubTarget || reduce) {
      scale.value = 1;
      return;
    }
    scale.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 14, stiffness: 220, mass: 0.6 }));
  }, [isScrubTarget, reduce, scale]);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const checkbox = (
    <Animated.View style={scaleStyle}>
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
        <ThemedIcon
          icon={isSelected ? CheckCircleFill : RoundLine}
          size={20}
          token={isSelected ? 'primary' : 'muted-foreground'}
        />
      </Pressable>
    </Animated.View>
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
  /** Selection mode has taken the slot: keep the kebab mounted but inert and glyph-less. */
  disabled: boolean;
};

/**
 * The default shape: a kebab whose tap opens the entry's context menu — and,
 * through the same gesture, selects the entry.
 *
 * `HoldItem` fires its `onHold` prop on *any* activation, a tap included — so
 * passing the additive toggle here makes a kebab tap select the entry (row
 * highlighted, selection mode on) at the same moment the menu opens. The slot
 * keeps the kebab mounted while this menu is open, so the selection the tap just
 * produced cannot unmount the menu underneath it (see `FileSystemMobileMenu`).
 */
function MobileKebab({ disabled, entry, menuProps, onToggleSelect, testID }: MobileKebabProps) {
  // Stable handle for `HoldItem onHold` — a fresh arrow per render would
  // rebuild the hook's `latest` ref on every render of the slot.
  const handleHold = useCallback(() => onToggleSelect(entry), [entry, onToggleSelect]);

  return (
    <HoldItem
      activateOn="tap"
      disabled={disabled}
      items={menuProps.items}
      onHold={handleHold}
      onOpenChange={menuProps.onOpenChange}
      // While the checkbox takes the slot the kebab must not stay queryable — the
      // stories assert the kebab is gone once selection mode is on.
      testID={disabled || !testID ? undefined : `${testID}${MOBILE_KEBAB_SUFFIX}`}
    >
      {disabled ? null : (
        /* The button role the kebab exposes: `HoldItem`'s wrapper carries the tap
           (and its twin), while this element is the accessible name — the same
           `role="button"` the old `trigger="pressable"` rendered. A `View`, not a
           `Pressable`: a Pressable's responder swallows the click (its `onClick`
           calls `stopPropagation` even with no `onPress`), which would starve the
           wrapper's tap, so the press must not double-fire. */
        <View
          accessibilityLabel={`More actions for ${entry.name}`}
          accessibilityRole="button"
          className="size-7 items-center justify-center"
        >
          <ThemedIcon icon={More} size={16} token="muted-foreground" />
        </View>
      )}
    </HoldItem>
  );
}

/**
 * The kebab-or-checkbox trailing control. `selecting` picks the shape; a `null`
 * return hides it entirely when there is no context menu to offer and no
 * selection to toggle into.
 *
 * The kebab's `HoldItem` stays mounted for the slot's whole life, and `selecting`
 * only disables it and hides its glyph while the checkbox takes the slot. That is
 * the performance fix: the old code swapped the two shapes, so unselecting the
 * last entry remounted a `HoldItem` (plus its portal twin) for every row at once —
 * the multi-second stall. Keeping it mounted also removes the old wrinkle of
 * deferring the flip while the kebab's own menu is open; the menu's `HoldItem`
 * never unmounts, so nothing has to wait for it to close.
 */
export function FileSystemMobileMenu(props: FileSystemMobileMenuProps) {
  // Resolved here, not inside `MobileKebab`, so the slot's shape decision and
  // the kebab's menu read the same `open` state.
  const { menuProps } = useContextMenu(props.entry, props.getContextMenuActions, props.onContextMenuAction);
  if (!props.getContextMenuActions) return props.selecting ? <MobileCheckbox {...props} /> : null;
  // The checkbox appears once selection mode is on and the kebab's own menu (if
  // any) has closed; the kebab stays mounted underneath it, disabled.
  const showCheckbox = props.selecting && !menuProps.open;
  return (
    <>
      <MobileKebab
        disabled={showCheckbox}
        entry={props.entry}
        menuProps={menuProps}
        onToggleSelect={props.onToggleSelect}
        testID={props.testID}
      />
      {showCheckbox ? <MobileCheckbox {...props} /> : null}
    </>
  );
}
