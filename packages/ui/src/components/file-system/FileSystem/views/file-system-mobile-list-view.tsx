/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the view and its row/overlay parts are one render layer */
// The mobile list view: a flat two-line list for touch.
//
// No header and no disclosure tree — a phone has no column header to click and no
// room for a tree. Each row carries a visible kebab (the same `FileSystemMobileMenu`
// the grid tiles use), and long-press is the way into multi-select: once anything
// is selected the kebab yields to a checkbox. The same hold that joins the
// selection keeps dragging past the escape slop, lifting the multi-selection onto
// a folder row — the drag wiring mirrors the desktop list view (`ListRow`), with
// no hover anywhere: a phone has no right button and no pointer to hover with.

import { useCallback, useMemo, useRef } from 'react';
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { FlatList, Pressable, View } from 'react-native';
import { HeartFill as Heart } from 'rn-motion-ui-icons/icons/heart-fill';
import { PinFill as Pin } from 'rn-motion-ui-icons/icons/pin-fill';
import { cn } from '../../../../lib/cn';
import { useThemeColors } from '../../../../theme/use-theme-color';
import { useIsLifting } from '../../../gestures/DragManager/multi-drag-scope';
import { useDragScope } from '../../../gestures/drag-scope';
import { shiftZoneRects } from '../../../gestures/drag-store';
import { HoldItem } from '../../../menus/HoldMenu/hold-menu';
import { Text } from '../../../typography/Text/text';
import { FileSystemFolderGlyph, FileTypeIcon } from '../../FileIcon/file-icons';
import { useEntryActivation } from '../hooks/use-entry-activation';
import { useFileSystemAutoScroll } from '../hooks/use-file-system-auto-scroll';
import { useFileSystemDragOptions } from '../hooks/use-file-system-drag-options';
import { useFileSystemDragScroll } from '../hooks/use-file-system-drag-scroll';
import { useFileSystemRowInteraction } from '../hooks/use-file-system-row-interaction';
import { type FileSystemScrubHit, useFileSystemScrubSession } from '../hooks/use-file-system-scrub';
import { formatFileSystemStats } from '../logic/file-system-format';
import { fileSystemEntryTestID } from '../logic/file-system-test-id';
import { FileSystemDropzone, isZoneInScrollableContent } from '../shell/file-system-dropzone';
import type {
  FileSystemEntry,
  FileSystemExternalDropEvent,
  FileSystemMoveEvent,
  FileSystemViewProps,
} from '../types/file-system.types';
import { FileSystemMobileMenu } from './file-system-mobile-menu';

/** A two-line row, taller than the desktop list's single line. */
const MOBILE_ROW_HEIGHT = 56;
/** Vertical breathing room between rows — the list's item separator. */
const VERTICAL_ROW_GAP = 8;
/** The full stride one row occupies in the list (row + gap), used by `getItemLayout` and the scrub's row mapping. */
const ROW_STRIDE = MOBILE_ROW_HEIGHT + VERTICAL_ROW_GAP;
const ICON_SIZE = 22;
const FOLDER_GLYPH_SIZE = 24;
const PIN_ICON_SIZE = 10;
const FAV_ICON_SIZE = 10;

const keyExtractor = (entry: FileSystemEntry) => entry.path;

/** The vertical gap between rows. A plain spacer — the stride arithmetic in
 *  `getItemLayout` and the scrub already account for it. */
function MobileRowSeparator() {
  return <View style={{ height: VERTICAL_ROW_GAP }} />;
}

/**
 * Fixed-height rows make the `FlatList`'s content height arithmetic, so it can
 * reserve the full scroll extent up front instead of measuring rows as they mount —
 * the same `getItemLayout` the desktop list view hands its `FlatList`. The stride
 * includes the vertical gap, so separators are accounted for in the same arithmetic.
 */
const getItemLayout = (_data: ArrayLike<FileSystemEntry> | null | undefined, index: number) => ({
  length: ROW_STRIDE,
  offset: ROW_STRIDE * index,
  index,
});

/** The `FlatList` render-item shape — `item` alone, named so the render prop signature stays readable. */
type MobileListRenderItem = { item: FileSystemEntry };

type MobileListRowProps = {
  childCount: number | undefined;
  draggable: boolean;
  ensureChildren?: (folderPath: string) => void;
  entry: FileSystemEntry;
  getContextMenuActions?: FileSystemViewProps['getContextMenuActions'];
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: FileSystemViewProps['onContextMenuAction'];
  onExternalDrop?: (event: FileSystemExternalDropEvent) => void;
  onMove?: (event: FileSystemMoveEvent) => void;
  onSelectLongPress: ((entry: FileSystemEntry) => void) | undefined;
  onToggleSelect: (entry: FileSystemEntry) => void;
  onScrubStart: (entry: FileSystemEntry, x: number, y: number) => void;
  onScrubMove: (x: number, y: number) => void;
  onScrubEnd: () => void;
  renderEntryIcon?: FileSystemViewProps['renderEntryIcon'];
  selecting: boolean;
  testID?: string;
  /** This row is under the finger right now during a scrub — its checkbox bounces. */
  isScrubTarget: boolean;
};

/**
 * One row: icon, then a two-line stack (name over stats), with the kebab/checkbox
 * overlaid to the right like the list view's disclosure chevron — a sibling, never
 * a child of the row button, so the two Pressables never nest.
 */
function MobileListRow({
  childCount,
  draggable,
  ensureChildren,
  entry,
  getContextMenuActions,
  isSelected,
  onActivate,
  onContextMenuAction,
  onExternalDrop,
  onMove,
  onSelectLongPress,
  onToggleSelect,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
  renderEntryIcon,
  selecting,
  testID,
  isScrubTarget,
}: MobileListRowProps) {
  const colors = useThemeColors();

  // The row has no menu of its own — the kebab is the menu. Passing no
  // `getContextMenuActions` keeps `HoldItem` inert (empty items), so a
  // hold fires only `onHoldAction` (the multi-select join) rather than a panel.
  const { handleOpenChange, handlePress, handlePressIn, menuProps, onHoldAction } = useFileSystemRowInteraction({
    entry,
    getContextMenuActions: undefined,
    onActivate,
    onContextMenuAction: undefined,
    onSelectLongPress,
  });

  // `dragOptions` upgrades the inert hold to a `<HoldDraggable>`: the hold still
  // toggles the selection, then a move past the escape slop lifts the multi-drag
  // payload. Undefined when dragging is off, which keeps the hold a plain
  // `Holdable` with no drag at all.
  const dragOptions = useFileSystemDragOptions(entry, draggable);
  // Every row the drag carries fades, not just the one that was grabbed — which
  // is the whole point of dragging a selection.
  const isDragSource = useIsLifting(entry.path);

  // Only a selection lights the row; a row mid-drag dims instead, and the drop
  // target gets the info outline — the same split the desktop list draws. The
  // selected wash is a translucent `info` tint (not a solid fill), so the row
  // keeps its normal foreground text and only the background shifts.
  const isActive = isSelected && !isDragSource;
  const textClassName = 'text-foreground';
  const metaClassName = 'text-muted-foreground';
  const stats = formatFileSystemStats(entry, childCount);

  // The lifted ghost is a copy of the Pressable, so the card it needs to stay
  // visible against the page rides on the Pressable — the same class that marks
  // the source as the one being dragged. `rounded-lg` keeps the card's corners
  // matching the selected pill.
  const dragSourceClassName = isDragSource ? 'rounded-lg bg-surface-3 shadow-lg' : undefined;

  const row = (
    <View className="relative" style={{ height: MOBILE_ROW_HEIGHT }}>
      <HoldItem
        hapticFeedback="Medium"
        items={menuProps.items}
        dragOptions={dragOptions}
        onHold={onHoldAction}
        onOpenChange={handleOpenChange}
      >
        <Pressable
          accessibilityLabel={entry.name}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          // Both, deliberately: native reads `accessibilityState`, RNW maps `aria-selected`.
          aria-selected={isSelected}
          className={cn('flex-row items-center gap-2 rounded-lg px-3 pr-8', isActive && 'bg-info/15', dragSourceClassName)}
          onPress={handlePress}
          // Resets the hold-vs-tap latch on the way in, so a fresh press cannot
          // inherit the previous one's hold (the desktop rows do the same).
          onPressIn={handlePressIn}
          style={{ height: MOBILE_ROW_HEIGHT }}
          testID={testID}
        >
          {entry.kind === 'folder'
            ? (renderEntryIcon?.(entry, FOLDER_GLYPH_SIZE) ?? <FileSystemFolderGlyph size={FOLDER_GLYPH_SIZE} />)
            : (renderEntryIcon?.(entry, ICON_SIZE) ?? <FileTypeIcon fileName={entry.name} size={ICON_SIZE} />)}
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-1">
              {entry.pinnedAt ? <Pin color={colors.primary} size={PIN_ICON_SIZE} /> : null}
              <Text className={cn('min-w-0', textClassName)} numberOfLines={1} size="sm">
                {entry.name}
              </Text>
              {entry.favoritedAt ? <Heart color={colors.danger} size={FAV_ICON_SIZE} /> : null}
            </View>
            {stats ? (
              <Text className={metaClassName} numberOfLines={1} size="xs">
                {stats}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </HoldItem>
      {/* The kebab/checkbox, laid over the row's reserved right edge. */}
      <View className="absolute right-0 items-center justify-center" style={{ height: MOBILE_ROW_HEIGHT }}>
        <FileSystemMobileMenu
          entry={entry}
          getContextMenuActions={getContextMenuActions}
          isScrubTarget={isScrubTarget}
          isSelected={isSelected}
          onContextMenuAction={onContextMenuAction}
          onScrubStart={onScrubStart}
          onScrubMove={onScrubMove}
          onScrubEnd={onScrubEnd}
          onToggleSelect={onToggleSelect}
          selecting={selecting}
          testID={testID}
        />
      </View>
    </View>
  );

  // A file row is never a drop target. A folder row keeps its dropzone mounted
  // whether or not dragging is on — `disabled` refuses everything when it is
  // not, because swapping the wrapper for a plain View on a prop change is a
  // structural DOM mutation that can tear an in-flight drag down.
  if (entry.kind !== 'folder') return row;

  // No outline of its own: the drag scope's shared leaf paints the drop
  // indicator once, at the over zone's rect, so a crossing never re-renders the
  // row body (plain children bail on the stable element reference).
  return (
    <FileSystemDropzone
      destination={entry.path}
      disabled={!draggable}
      onDropCompleted={ensureChildren}
      onExternalDrop={onExternalDrop}
      onMove={onMove}
    >
      {row}
    </FileSystemDropzone>
  );
}

export function FileSystemMobileListView({
  draggable = false,
  ensureChildren,
  entries,
  getContextMenuActions,
  index,
  onContextMenuAction,
  onDeselectMarquee,
  onExternalDrop,
  onMarquee,
  onMove,
  onOpen,
  onSelect,
  renderEntryIcon,
  selectedPaths,
  selectionMode,
  testID,
}: FileSystemViewProps) {
  // Rows render in entry order, so the entry list *is* the Shift-range ordering.
  const orderedPaths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  // Only the hold is borrowed from the shared activation hook: a long press is
  // the touch way into multi-select. The tap is this view's own — see below.
  const { onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);

  const selecting = selectedPaths.size > 0;
  const toggleSelect = useCallback(
    (entry: FileSystemEntry) => onSelect(entry, { additive: true }, orderedPaths),
    [onSelect, orderedPaths],
  );

  // A single tap opens the entry outright — a phone has no double-click, so the
  // tap must not first select. Only a hold enters selection mode; once anything
  // is selected a tap toggles that entry's selection, the standard mobile
  // file-manager behaviour (the checkboxes are the toggle surface, and the row
  // tap mirrors them).
  const activate = useCallback(
    (entry: FileSystemEntry) => (selecting ? toggleSelect(entry) : onOpen(entry)),
    [onOpen, selecting, toggleSelect],
  );

  const containerRef = useRef<View | null>(null);
  const flatListRef = useRef<FlatList<FileSystemEntry> | null>(null);
  const scrollOffsetRef = useRef(0);
  // The manager this view's zones registered under — the scope the scroll
  // correction applies to, so a second FileSystem on the page keeps its own boxes.
  const { managerPath } = useDragScope();

  // A drag near the top or bottom edge scrolls the list, so a folder below the
  // fold is reachable without releasing. Runs for external drags too.
  const scrollTo = useCallback((offset: number) => flatListRef.current?.scrollToOffset({ animated: false, offset }), []);
  useFileSystemDragScroll({ containerRef, enabled: draggable, scrollOffsetRef, scrollTo });

  // The same edge-scroll engine the drag above uses, driven by the scrub's pointer
  // stream instead — dragging to multi-select scrolls the list when the finger goes
  // above the visible rows (or below them).
  const {
    begin: beginAutoScroll,
    move: moveAutoScroll,
    end: endAutoScroll,
  } = useFileSystemAutoScroll({
    containerRef,
    scrollTo,
    scrollOffsetRef,
  });

  // Scrub geometry. The finger→row mapping is calibrated at drag start against the
  // one point both sides already agree on: the start entry's checkbox, whose content
  // position is `rowIndex * ROW_STRIDE + MOBILE_ROW_HEIGHT / 2` and whose window
  // position the gesture reports at `onStart`. That offset turns every later
  // `absoluteY` straight into a row. The one thing that *can* drift is the list
  // auto-scrolling mid-scrub, which moves the content under a fixed finger position —
  // so the mapping adds the scroll delta since calibration (see `resolveItemAt`).
  const scrubOriginRef = useRef<{ x: number; y: number } | null>(null);
  const scrubStartOffsetRef = useRef(0);

  const resolveItemAt = useCallback(
    (_x: number, y: number): FileSystemScrubHit => {
      const origin = scrubOriginRef.current;
      if (origin === null) return null;
      const contentY = y - origin.y + (scrollOffsetRef.current - scrubStartOffsetRef.current);
      if (contentY < 0) return { kind: 'beyond', side: 'above' };
      const rowIndex = Math.floor(contentY / ROW_STRIDE);
      const path = orderedPaths[rowIndex];
      if (path === undefined) return { kind: 'beyond', side: 'below' };
      return { kind: 'item', path };
    },
    [orderedPaths],
  );

  const scrubSession = { orderedPaths, selectedPaths, onMarquee, onDeselectMarquee, resolveItemAt };
  const { begin, move: moveScrub, end: endScrub, scrubTarget } = useFileSystemScrubSession(scrubSession);

  const beginScrub = useCallback(
    (entry: FileSystemEntry, _x: number, y: number) => {
      const rowIndex = orderedPaths.indexOf(entry.path);
      const checkboxCenterY = rowIndex * ROW_STRIDE + MOBILE_ROW_HEIGHT / 2;
      scrubOriginRef.current = { x: 0, y: y - checkboxCenterY };
      scrubStartOffsetRef.current = scrollOffsetRef.current;
      begin(entry);
      beginAutoScroll();
    },
    [begin, beginAutoScroll, orderedPaths],
  );

  const handleScrubMove = useCallback(
    (x: number, y: number) => {
      moveScrub(x, y);
      moveAutoScroll(x, y);
    },
    [moveScrub, moveAutoScroll],
  );

  const handleScrubEnd = useCallback(() => {
    endScrub();
    endAutoScroll();
  }, [endScrub, endAutoScroll]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      // Same correction as the desktop list view: the store's cached zone rects
      // are window boxes from the last measure, and a scroll moves the rows
      // without any layout event, so the drop targeting and the shared drop
      // indicator would resolve against pre-scroll positions mid-drag.
      const delta = offset - scrollOffsetRef.current;
      scrollOffsetRef.current = offset;
      if (delta !== 0) shiftZoneRects(0, delta, managerPath, isZoneInScrollableContent);
    },
    [managerPath],
  );

  const rowProps = useMemo(
    () => ({ draggable, ensureChildren, getContextMenuActions, onMove, renderEntryIcon, onContextMenuAction, onExternalDrop }),
    [draggable, ensureChildren, getContextMenuActions, onMove, renderEntryIcon, onContextMenuAction, onExternalDrop],
  );

  const renderRow = useCallback(
    ({ item }: MobileListRenderItem) => (
      <MobileListRow
        childCount={index.children.get(item.path)?.length}
        entry={item}
        isScrubTarget={scrubTarget === item.path}
        isSelected={selectedPaths.has(item.path)}
        onActivate={activate}
        onScrubStart={beginScrub}
        onScrubMove={handleScrubMove}
        onScrubEnd={handleScrubEnd}
        onSelectLongPress={selectLongPress}
        onToggleSelect={toggleSelect}
        selecting={selecting}
        testID={fileSystemEntryTestID(testID, item.path)}
        {...rowProps}
      />
    ),
    [
      activate,
      beginScrub,
      handleScrubEnd,
      handleScrubMove,
      index,
      scrubTarget,
      selectedPaths,
      selectLongPress,
      selecting,
      testID,
      toggleSelect,
      rowProps,
    ],
  );

  // The vertical gap between rows — see `MobileRowSeparator`.
  // `extraData` must change on both selection *and* the scrub's finger position:
  // the start entry's checkbox bounce fires from `scrubTarget` alone, before any
  // selection change, so `selectedPaths` on its own would not re-render the rows.
  const extraData = useMemo(() => ({ selectedPaths, scrubTarget }), [selectedPaths, scrubTarget]);

  return (
    <View className="min-h-0 flex-1" ref={containerRef}>
      <FlatList
        ref={flatListRef}
        className="flex-1"
        data={entries}
        extraData={extraData}
        getItemLayout={getItemLayout}
        ItemSeparatorComponent={MobileRowSeparator}
        keyExtractor={keyExtractor}
        onScroll={onScroll}
        renderItem={renderRow}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        removeClippedSubviews={false}
      />
    </View>
  );
}
