/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the view and its row/header/overlay parts are one render layer */
// The list view: a disclosure tree with Name / Date Modified / Size columns.
// Here the rows come from the sorted index (see file-system-rows) and render through a FlatList, so the same
// folder-first ordering and per-folder disclosure survive without the DOM.

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { FlatList, Pressable, View } from 'react-native';
import { DownLine as ChevronDown } from 'rn-motion-ui-icons/icons/down-line';
import { HeartLine as Heart } from 'rn-motion-ui-icons/icons/heart-line';
import { PinLine as Pin } from 'rn-motion-ui-icons/icons/pin-line';
import { RightLine as ChevronRight } from 'rn-motion-ui-icons/icons/right-line';
import { UpLine as ChevronUp } from 'rn-motion-ui-icons/icons/up-line';
import { cn } from '../../../lib/cn';
import { useThemeColors } from '../../../theme/use-theme-color';
import { withMultiDragIds } from '../../gestures/DragManager/multi-drag';
import { useIsLifting, useMultiDragScope } from '../../gestures/DragManager/multi-drag-scope';
import type { DragzoneRenderState } from '../../gestures/drag.types';
import { useActiveDrag } from '../../gestures/use-drag-store';
import { ThemedIcon } from '../../icon/themed-icon';
import { HoldContextMenu, type HoldContextMenuDragOptions } from '../../menus/HoldContextMenu/hold-context-menu';
import { Text } from '../../typography/Text/text';
import { FileSystemFolderGlyph, FileTypeIcon } from './FileIcon/file-icons';
import type {
  FileSystemContextMenuAction,
  FileSystemEntry,
  FileSystemExternalDropEvent,
  FileSystemItem,
  FileSystemMoveEvent,
  FileSystemSortKey,
  FileSystemSortState,
} from './file-system.types';
import { useBackgroundContextMenu, useContextMenu } from './file-system-context-menu';
import { FileSystemDropzone } from './file-system-dropzone';
import { formatByteSize, formatTimestamp } from './file-system-format';
import { FileSystemHoverHighlight, FS_HOVER_TEST_ID, useFileSystemRowHover } from './file-system-hover';
import { FileSystemMarqueeBox, type FileSystemMarqueeRect, useFileSystemMarquee, useMarqueeGate } from './file-system-marquee';
import type { FileSystemRow } from './file-system-rows';
import { FS_ROW_HEIGHT, flattenFileSystemRows, toggleExpandedPath } from './file-system-rows';
import { FS_DRAG_CONTAINER_TEST_ID, fileSystemEntryTestID } from './file-system-test-id';
import type { FileSystemViewProps } from './file-system-view';
import { useEntryActivation } from './use-entry-activation';
import { useFileSystemDragScroll } from './use-file-system-drag-scroll';

const NAME_LABEL = 'Name';
const DATE_LABEL = 'Date Modified';
const SIZE_LABEL = 'Size';
const MISSING_VALUE = '—';

const INDENT_PER_LEVEL = 14;
/** The chevron lane, reserved on file rows too so names stay aligned. */
const CHEVRON_SIZE = 18;
/** The row's own left inset, matching the `px-2` its className sets. */
const ROW_PADDING_X = 8;
const ICON_SIZE = 16;
const FOLDER_GLYPH_SIZE = 18;
const PIN_ICON_SIZE = 10;
const FAV_ICON_SIZE = 10;
/** Below this the date column drops out, leaving name + size. */
const DATE_COLUMN_MIN_WIDTH = 420;

/** Content-container top padding (py-1 = 4 px): where row 0 starts. */
const LIST_PADDING_TOP = 4;

/**
 * The tint a row in flight keeps for the length of the drag. The sliding highlight
 * has moved to the drop target by then, so without this the rows the gesture is
 * actually about are the only ones on screen with no mark at all.
 */
const LIFTING_ROW_CLASS = 'rounded-md bg-muted';

/** Container-local point → row index, or null for padding / past-last-row. */
function rowHitAt(_localX: number, localY: number, scrollOffset: number, rowCount: number): number | null {
  const contentY = localY + scrollOffset - LIST_PADDING_TOP;
  if (contentY < 0) return null;
  const rowIndex = Math.floor(contentY / FS_ROW_HEIGHT);
  if (rowIndex >= rowCount) return null;
  return rowIndex;
}

/** Content-frame rect → paths of every row it overlaps. */
function rowsInRect(rect: FileSystemMarqueeRect, rows: FileSystemRow[]): readonly string[] {
  const top = rect.y - LIST_PADDING_TOP;
  const bottom = rect.y + rect.height - LIST_PADDING_TOP;
  const result: string[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const rowTop = i * FS_ROW_HEIGHT;
    if (rowTop >= bottom) break;
    if (rowTop + FS_ROW_HEIGHT > top) {
      const row = rows[i];
      if (row) result.push(row.entry.path);
    }
  }
  return result;
}
const keyExtractor = (row: FileSystemRow) => row.entry.path;
const getItemLayout = (_data: ArrayLike<FileSystemRow> | null | undefined, index: number) => ({
  index,
  length: FS_ROW_HEIGHT,
  offset: FS_ROW_HEIGHT * index,
});

function itemCountLabel(count: number | undefined): string {
  if (count === undefined) return MISSING_VALUE;
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

type ColumnHeaderProps = {
  className?: string;
  label: string;
  onPress: (key: FileSystemSortKey) => void;
  sort: FileSystemSortState;
  sortKey: FileSystemSortKey;
};

/** One sortable header; the active column carries the direction chevron. */
function ColumnHeader({ className, label, onPress, sort, sortKey }: ColumnHeaderProps) {
  const isActive = sort.key === sortKey;
  const handlePress = useCallback(() => onPress(sortKey), [onPress, sortKey]);
  const DirectionIcon = sort.direction === 'asc' ? ChevronUp : ChevronDown;

  return (
    <Pressable accessibilityRole="button" className={cn('flex-row items-center gap-0.5 py-0.5', className)} onPress={handlePress}>
      <Text className={cn(isActive ? 'text-foreground' : 'text-muted-foreground')} numberOfLines={1} size="xs" weight="medium">
        {label}
      </Text>
      {isActive ? <ThemedIcon icon={DirectionIcon} variant="secondary" size={12} /> : null}
    </Pressable>
  );
}

/**
 * Left edge of a row's chevron lane. Read twice per row — once as the row's own
 * indented padding, once to place the disclosure control over the lane that
 * padding reserves — so the two can only agree.
 */
function chevronLaneLeft(level: number): number {
  return ROW_PADDING_X + level * INDENT_PER_LEVEL;
}

type RowChevronProps = { isExpanded: boolean; isSelected: boolean; level: number; name: string; onToggle: () => void };

/**
 * A folder row's disclosure control, laid over the lane the row's own padding
 * reserves.
 *
 * A sibling of the row button rather than a child of it: a button inside a button
 * is invalid HTML, and on web both Pressables resolve to one. Nothing about the
 * press behaviour changes — RNW's press responder stops the click before it
 * reaches an ancestor Pressable, so tapping the chevron never also activated the
 * row, and the same holds for the responder on native.
 *
 * Full row height, so the target is the whole lane rather than just the glyph.
 */
function RowChevron({ isExpanded, isSelected, level, name, onToggle }: RowChevronProps) {
  return (
    <Pressable
      accessibilityLabel={isExpanded ? `Collapse ${name}` : `Expand ${name}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      // See ListRow: native reads the state, web reads the ARIA attribute.
      aria-expanded={isExpanded}
      className="absolute top-0 items-center justify-center"
      onPress={onToggle}
      style={{ height: FS_ROW_HEIGHT, left: chevronLaneLeft(level), width: CHEVRON_SIZE }}
    >
      <ThemedIcon icon={isExpanded ? ChevronDown : ChevronRight} token={isSelected ? 'white' : 'muted-foreground'} size={14} />
    </Pressable>
  );
}

type ListRowProps = {
  childCount: number | undefined;
  draggable: boolean;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onExternalDrop?: (event: FileSystemExternalDropEvent) => void;
  onMove?: (event: FileSystemMoveEvent) => void;
  /** Long-press toggles this row's selection; `undefined` leaves the gesture to the context menu. */
  onSelectLongPress?: (entry: FileSystemEntry) => void;
  onToggleExpanded: (path: string) => void;
  renderEntryIcon?: (entry: FileSystemEntry, size: number) => ReactNode | null | undefined;
  row: FileSystemRow;
  showDate: boolean;
  /** Already resolved for this entry by the view — see `fileSystemEntryTestID`. */
  testID?: string;
};

/**
 * Disclosure chevron, icon, name, then the metadata columns.
 *
 * Owns the hold gesture (via `HoldContextMenu`), the context menu, and the drag
 * source. No separate shell component — the drop target wraps the row directly
 * for folder entries, and the drag is handled by `HoldContextMenu dragOptions`.
 */
function ListRow({
  childCount,
  draggable,
  getContextMenuActions,
  isSelected,
  onActivate,
  onContextMenuAction,
  onExternalDrop,
  onMove,
  onSelectLongPress,
  onToggleExpanded,
  renderEntryIcon,
  row,
  showDate,
  testID,
}: ListRowProps) {
  const { entry, isExpandable, isExpanded, level } = row;
  const handleToggle = useCallback(() => onToggleExpanded(entry.path), [entry.path, onToggleExpanded]);
  const colors = useThemeColors();

  const { menuProps } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);

  // Multi-drag: resolve the same payload MultiDraggable used to resolve
  const { getGroupData, renderPreview, resolveIds } = useMultiDragScope();
  const ids = useMemo(() => resolveIds(entry.path), [entry.path, resolveIds]);
  const multiData = useMemo(() => withMultiDragIds(getGroupData(ids), ids), [getGroupData, ids]);
  const dragOptions = useMemo<HoldContextMenuDragOptions | undefined>(
    () => (draggable ? { data: multiData, effectAllowed: 'move', preview: renderPreview?.(ids) } : undefined),
    [draggable, ids, multiData, renderPreview],
  );

  // A hold (menu-open or multi-select toggle) must not also register as a tap
  const heldRef = useRef(false);
  const onOpenChangeRef = useRef(menuProps.onOpenChange);
  onOpenChangeRef.current = menuProps.onOpenChange;
  const handleOpenChange = useCallback((open: boolean) => {
    if (open) heldRef.current = true;
    onOpenChangeRef.current(open);
  }, []);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (heldRef.current) {
        heldRef.current = false;
        return;
      }
      onActivate(entry, event);
    },
    [entry, onActivate],
  );

  // In multi-select mode, hold toggles selection instead of opening the menu.
  // heldRef is set so the finger release does not also fire as a tap.
  const onHoldAction = useMemo(
    () =>
      onSelectLongPress
        ? () => {
            heldRef.current = true;
            onSelectLongPress(entry);
          }
        : undefined,
    [entry, onSelectLongPress],
  );

  const handlePressIn = useCallback(() => {
    heldRef.current = false;
  }, []);

  const isLifting = useIsLifting(entry.path);

  const renderBody = (isOver: boolean) => {
    // A selected row muted during drag; a drop target lit like a selection.
    const isActive = (isSelected && !isLifting) || isOver;
    const textClassName = isActive ? 'text-white' : 'text-foreground';
    const metaClassName = isActive ? 'text-white' : 'text-muted-foreground';

    return (
      <View className={cn(isLifting && LIFTING_ROW_CLASS)} style={{ height: FS_ROW_HEIGHT }}>
        <HoldContextMenu {...menuProps} dragOptions={dragOptions} onHold={onHoldAction} onOpenChange={handleOpenChange}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            // Both, deliberately: `accessibilityState` is what native reads, and
            // react-native-web maps `aria-selected` but not `accessibilityState`, so
            // on web the fill would otherwise be the only thing saying "picked".
            aria-selected={isSelected}
            // Hover is not a class here: it is one sliding node behind the rows, so it
            // can keep tracking under the drag's pointer capture. See file-system-hover.
            className={cn('flex-row items-center gap-1 rounded-md px-2', isActive && 'bg-info')}
            onPress={handlePress}
            onPressIn={handlePressIn}
            style={{ height: FS_ROW_HEIGHT, paddingLeft: chevronLaneLeft(level) }}
            testID={testID}
          >
            {/* The chevron's lane, held open on file rows too so names stay aligned
                across kinds. On a folder row the control below sits over this box. */}
            <View style={{ width: CHEVRON_SIZE }} />
            {entry.kind === 'folder'
              ? (renderEntryIcon?.(entry, FOLDER_GLYPH_SIZE) ?? <FileSystemFolderGlyph size={FOLDER_GLYPH_SIZE} />)
              : (renderEntryIcon?.(entry, ICON_SIZE) ?? <FileTypeIcon fileName={entry.name} size={ICON_SIZE} />)}
            {entry.pinnedAt ? <Pin color={isActive ? colors.white : colors.primary} size={PIN_ICON_SIZE} /> : null}
            <Text className={cn('flex-1', textClassName)} numberOfLines={1} size="sm">
              {entry.name}
            </Text>
            {entry.favoritedAt ? <Heart color={isActive ? colors.white : colors.danger} size={FAV_ICON_SIZE} /> : null}
            {showDate ? (
              <Text className={cn('w-44', metaClassName)} numberOfLines={1} size="xs">
                {formatTimestamp(entry.updatedAt ?? entry.createdAt) ?? MISSING_VALUE}
              </Text>
            ) : null}
            <Text className={cn('w-20 text-right', metaClassName)} numberOfLines={1} numeric={true} size="xs">
              {entry.kind === 'folder' ? itemCountLabel(childCount) : (formatByteSize(entry.size) ?? MISSING_VALUE)}
            </Text>
          </Pressable>
          {isExpandable ? (
            <RowChevron isExpanded={isExpanded} isSelected={isActive} level={level} name={entry.name} onToggle={handleToggle} />
          ) : null}
        </HoldContextMenu>
      </View>
    );
  };

  return entry.kind === 'folder' ? (
    <FileSystemDropzone destination={entry.path} disabled={!draggable} onExternalDrop={onExternalDrop} onMove={onMove}>
      {/* The outline is drawn over the row, not around it: a border in the row's
          own box would resize it and shift every row below by a pixel. */}
      {({ isOver }: DragzoneRenderState) => renderBody(isOver)}
    </FileSystemDropzone>
  ) : (
    renderBody(false)
  );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: drag, hover, context-menu, and row layout are tightly coupled around shared state — splitting would scatter interdependent logic
export function FileSystemListView({
  currentPath,
  draggable = false,
  getBackgroundContextMenuActions,
  getContextMenuActions,
  index,
  onBackgroundContextMenuAction,
  onContextMenuAction,
  onExternalDrop,
  onMarquee,
  onMove,
  onOpen,
  onSelect,
  onSortColumnClick,
  renderEntryIcon,
  selectedPaths,
  selectionMode,
  sort,
  testID,
}: FileSystemViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>());
  /** `null` until the first layout pass — distinct from a measured zero. */
  const [width, setWidth] = useState<number | null>(null);

  const flatListRef = useRef<FlatList<FileSystemRow> | null>(null);
  const containerRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
  /** The drawn rows, readable from callbacks that outlive the render that made them. */
  const rowsRef = useRef<FileSystemRow[]>([]);

  const rows = useMemo(() => flattenFileSystemRows({ currentPath, expanded, index }), [currentPath, expanded, index]);
  rowsRef.current = rows;
  // A Shift-range runs through the rows as they are drawn — an expanded folder's
  // children included, since they sit between their parent and its next sibling.
  const orderedPaths = useMemo(() => rows.map((row) => row.entry.path), [rows]);
  // Shown before the first measurement so the header does not visibly gain a
  // column on mount at the widths where it belongs.
  const showDate = width === null || width >= DATE_COLUMN_MIN_WIDTH;

  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);

  const handleLayout = useCallback((event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width), []);
  const toggleExpanded = useCallback((path: string) => setExpanded((previous) => toggleExpandedPath(previous, path)), []);

  // A drag near the top or bottom edge scrolls the list, so a folder below the
  // fold is reachable without releasing. Runs for external drags too.
  useFileSystemDragScroll({ containerRef, enabled: draggable, flatListRef, scrollOffsetRef });

  const activeDrag = useActiveDrag();
  const isDragging = useCallback(() => activeDrag !== null, [activeDrag]);

  const selectedIndexesRef = useRef<ReadonlySet<number>>(new Set());
  selectedIndexesRef.current = useMemo(() => {
    const indexes = new Set<number>();
    rows.forEach((row, rowIndex) => {
      if (selectedPaths.has(row.entry.path)) indexes.add(rowIndex);
    });
    return indexes;
  }, [rows, selectedPaths]);

  const hover = useFileSystemRowHover({
    containerRef,
    count: rows.length,
    // No `getTargetIndex`: each folder row's own zone paints the pending drop now,
    // so the sliding highlight has nothing to say during a drag and suppresses itself.
    isDragging,
    offsetTop: LIST_PADDING_TOP,
    scrollOffsetRef,
    selectedIndexesRef,
    stride: FS_ROW_HEIGHT,
  });

  const hitTest = useCallback(
    (localX: number, localY: number) => rowHitAt(localX, localY, scrollOffsetRef.current, rowsRef.current.length),
    [],
  );
  const { canStartMarqueeAt } = useMarqueeGate(hitTest);

  const marquee = useFileSystemMarquee({
    canStartAt: canStartMarqueeAt,
    containerRef,
    enabled: selectionMode === 'multiple',
    getScrollOffset: useCallback(() => scrollOffsetRef.current, []),
    getSelectedPaths: useCallback(() => selectedPaths, [selectedPaths]),
    onMarquee,
    resolve: useCallback((rect: FileSystemMarqueeRect) => rowsInRect(rect, rowsRef.current), []),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedPaths is the trigger; not read in the body but must be in the deps to re-fire on selection change
  // biome-ignore lint/plugin: re-resolve is a side-effect on an Animated value, not render state
  useEffect(() => {
    hover.refresh();
    marquee.refresh();
  }, [hover, marquee, selectedPaths]);

  const { onLongPress: bgLongPress, menuNode: bgMenuNode } = useBackgroundContextMenu(
    containerRef,
    getBackgroundContextMenuActions,
    onBackgroundContextMenuAction,
  );
  const handleBackgroundPress = useCallback(() => onSelect(null), [onSelect]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = offset;
      // The pointer has not moved but the rows under it have, so the highlight has
      // to re-resolve — including while a drag auto-scrolls the list.
      hover.refresh();
      marquee.refresh();
    },
    [hover, marquee],
  );

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemRow>) => (
      <ListRow
        childCount={index.children.get(item.entry.path)?.length}
        draggable={draggable}
        getContextMenuActions={getContextMenuActions}
        isSelected={selectedPaths.has(item.entry.path)}
        onActivate={activate}
        onContextMenuAction={onContextMenuAction}
        onExternalDrop={onExternalDrop}
        onMove={onMove}
        onSelectLongPress={selectLongPress}
        onToggleExpanded={toggleExpanded}
        renderEntryIcon={renderEntryIcon}
        row={item}
        showDate={showDate}
        testID={fileSystemEntryTestID(testID, item.entry.path)}
      />
    ),
    [
      activate,
      draggable,
      getContextMenuActions,
      index,
      onContextMenuAction,
      onExternalDrop,
      onMove,
      renderEntryIcon,
      selectedPaths,
      selectLongPress,
      showDate,
      testID,
      toggleExpanded,
    ],
  );

  const list = (
    <FlatList
      ref={flatListRef}
      className="flex-1"
      contentContainerClassName="py-1"
      data={rows}
      getItemLayout={getItemLayout}
      keyExtractor={keyExtractor}
      onScroll={onScroll}
      renderItem={renderRow}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    />
  );

  return (
    <View className="min-h-0 flex-1" onLayout={handleLayout}>
      {/* The header's left padding matches a level-0 row: chevron lane + icon. */}
      <View className="shrink-0 flex-row items-center gap-1 border-border border-b py-1 pr-2 pl-2">
        {/* Chevron lane + icon + their gap — matches a level-0 row. */}
        <View style={{ width: CHEVRON_SIZE + ICON_SIZE + 4 }} />
        <ColumnHeader className="flex-1" label={NAME_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="name" />
        {showDate ? (
          <ColumnHeader className="w-44" label={DATE_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="updatedAt" />
        ) : null}
        <ColumnHeader className="w-20 justify-end" label={SIZE_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="size" />
      </View>
      <Pressable
        ref={containerRef}
        className="relative min-h-0 flex-1 select-none"
        testID={FS_DRAG_CONTAINER_TEST_ID.list}
        onPress={handleBackgroundPress}
        onLongPress={bgLongPress}
      >
        {/* Before the list, so it paints behind the rows — see FileSystemHoverHighlight. */}
        <FileSystemHoverHighlight controller={hover} height={FS_ROW_HEIGHT} testID={FS_HOVER_TEST_ID.list} />
        {/* No background zone here: a drop that misses every folder row belongs to the
            folder that is open, and that fallback is mounted once in file-system-body
            so all four views answer an empty-space drop the same way. */}
        {list}
        <FileSystemMarqueeBox controller={marquee} />
        {bgMenuNode}
      </Pressable>
    </View>
  );
}
