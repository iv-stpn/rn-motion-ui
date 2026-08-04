/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the view and its row/header/overlay parts are one render layer */
// The list view: a disclosure tree with Name / Date Modified / Size columns.
// Here the rows come from the sorted index (see file-system-rows) and render through a FlatList, so the same
// folder-first ordering and per-folder disclosure survive without the DOM.

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  View,
  type ViewStyle,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { cn } from '../../../lib/cn';
import { ChevronDown, ChevronRight, ChevronUp, Heart, Pin } from '../../../lib/icons';
import { useThemeColors } from '../../../theme/use-theme-color';
import { ThemedIcon } from '../../icon/themed-icon';
import { HoldContextMenu } from '../../menus/HoldContextMenu/hold-context-menu';
import { Text } from '../../typography/Text/text';
import type {
  FileSystemContextMenuAction,
  FileSystemEntry,
  FileSystemItem,
  FileSystemSortKey,
  FileSystemSortState,
} from './file-system.types';
import { useBackgroundContextMenu, useContextMenu } from './file-system-context-menu';
import { formatByteSize, formatTimestamp } from './file-system-format';
import {
  FileSystemHoverHighlight,
  FileSystemSourceHighlight,
  FS_HOVER_TEST_ID,
  useFileSystemRowHover,
} from './file-system-hover';
import { FileSystemFolderGlyph, FileTypeIcon } from './file-system-icons';
import { FileSystemMarqueeBox, type FileSystemMarqueeRect, useFileSystemMarquee, useMarqueeGate } from './file-system-marquee';
import type { FileSystemRow } from './file-system-rows';
import { flattenFileSystemRows, toggleExpandedPath } from './file-system-rows';
import { fileSystemEntryTestID } from './file-system-test-id';
import type { FileSystemViewProps } from './file-system-view';
import { useEntryActivation, useEntryLongPress } from './use-entry-activation';
import { FS_DRAG_CONTAINER_TEST_ID, FS_ROW_HEIGHT, useDragSources, useFileSystemDrag } from './use-file-system-drag';
import { useFileSystemDragWeb } from './use-file-system-drag-web';
import { useFileSystemExternalDrop } from './use-file-system-external-drop';

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

// Selection is off via `select-none` on the body below; `touchAction` has no
// Tailwind utility and is absent from RN's ViewStyle, so it stays an inline web
// style — clamped only during a drag, so ordinary touch scrolling is unaffected
// the rest of the time.
type WebViewStyle = ViewStyle & { touchAction?: string };
const WEB_DRAGGING_STYLE: WebViewStyle | null = Platform.OS === 'web' ? { touchAction: 'none' } : null;

/** Content-container top padding (py-1 = 4 px): where row 0 starts. */
const LIST_PADDING_TOP = 4;

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

/**
 * Container-local top-left of a row, or `null` for no row. Takes the live scroll
 * offset because a drag can scroll the list out from under the row it lifted, so
 * the source position is not fixed for the length of the drag.
 */
function rowOrigin(index: number | null, scrollOffset: number) {
  if (index === null) return null;
  return { x: 0, y: index * FS_ROW_HEIGHT + LIST_PADDING_TOP - scrollOffset };
}

type DropHighlightProps = { targetIndex: number | null; scrollOffset: number };

/** Border outline over the row currently under the pointer (drop feedback). */
function DropHighlight({ targetIndex, scrollOffset }: DropHighlightProps) {
  if (targetIndex === null) return null;
  return (
    <View
      className="pointer-events-none absolute right-0 left-0 z-[3] rounded-md border border-primary"
      style={{ height: FS_ROW_HEIGHT, top: targetIndex * FS_ROW_HEIGHT + LIST_PADDING_TOP - scrollOffset }}
    />
  );
}

type DragPreviewProps = { label: string; pos: Animated.ValueXY };

/** Floating label chip that tracks the pointer during a drag (no re-renders). */
function DragPreview({ label, pos }: DragPreviewProps) {
  return (
    <Animated.View className="pointer-events-none absolute top-0 left-0 z-[4]" style={{ transform: pos.getTranslateTransform() }}>
      <View className="rounded-md border border-border bg-surface-4 px-2 py-1">
        <Text className="text-foreground" numberOfLines={1} size="xs">
          {label}
        </Text>
      </View>
    </Animated.View>
  );
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

type ListRowProps = {
  childCount: number | undefined;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
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
 * The chevron is a sibling of the row button rather than a child of it, laid
 * over the lane the row's own padding reserves: a button inside a button is
 * invalid HTML, and on web both Pressables resolve to one. Nothing about the
 * press behaviour changes — RNW's press responder stops the click before it
 * reaches an ancestor Pressable, so tapping the chevron never also activated the
 * row, and the same holds for the responder on native.
 */
function ListRow({
  childCount,
  getContextMenuActions,
  isSelected,
  onActivate,
  onContextMenuAction,
  onSelectLongPress,
  onToggleExpanded,
  renderEntryIcon,
  row,
  showDate,
  testID,
}: ListRowProps) {
  const { entry, isExpandable, isExpanded, level } = row;
  const handlePress = useCallback((event: GestureResponderEvent) => onActivate(entry, event), [entry, onActivate]);
  const handleToggle = useCallback(() => onToggleExpanded(entry.path), [entry.path, onToggleExpanded]);
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
  const textClassName = isSelected ? 'text-white' : 'text-foreground';
  const metaClassName = isSelected ? 'text-white' : 'text-muted-foreground';
  const colors = useThemeColors();

  const { menuProps, onLongPress: openContextMenu } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);
  const onLongPress = useEntryLongPress(entry, onSelectLongPress, openContextMenu);

  return (
    <HoldContextMenu {...menuProps}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        // Both, deliberately: `accessibilityState` is what native reads, and
        // react-native-web maps `aria-selected` but not `accessibilityState`, so
        // on web the fill would otherwise be the only thing saying "picked".
        aria-selected={isSelected}
        // Hover is not a class here: it is one sliding node behind the rows, so it
        // can keep tracking under the drag's pointer capture. See file-system-hover.
        className={cn('flex-row items-center gap-1 rounded-md px-2', isSelected && 'bg-info')}
        onLongPress={onLongPress}
        onPress={handlePress}
        style={{ height: FS_ROW_HEIGHT, paddingLeft: chevronLaneLeft(level) }}
        testID={testID}
      >
        {/* The chevron's lane, held open on file rows too so names stay aligned
            across kinds. On a folder row the control below sits over this box. */}
        <View style={{ width: CHEVRON_SIZE }} />
        {entry.kind === 'folder'
          ? (renderEntryIcon?.(entry, FOLDER_GLYPH_SIZE) ?? <FileSystemFolderGlyph size={FOLDER_GLYPH_SIZE} />)
          : (renderEntryIcon?.(entry, ICON_SIZE) ?? <FileTypeIcon fileName={entry.name} size={ICON_SIZE} />)}
        {entry.pinnedAt ? <Pin color={isSelected ? colors.white : colors.primary} size={PIN_ICON_SIZE} /> : null}
        <Text className={cn('flex-1', textClassName)} numberOfLines={1} size="sm">
          {entry.name}
        </Text>
        {entry.favoritedAt ? <Heart color={isSelected ? colors.white : colors.danger} size={FAV_ICON_SIZE} /> : null}
        {showDate ? (
          <Text className={cn('w-44', metaClassName)} numberOfLines={1} size="xs">
            {formatTimestamp(entry.updatedAt ?? entry.createdAt) ?? MISSING_VALUE}
          </Text>
        ) : null}
        <Text className={cn('w-20 text-right', metaClassName)} numberOfLines={1} numeric={true} size="xs">
          {entry.kind === 'folder' ? itemCountLabel(childCount) : (formatByteSize(entry.size) ?? MISSING_VALUE)}
        </Text>
      </Pressable>
      {/* Over the lane held open above — see this component's note on why it is a
          sibling of the row rather than a child. Full row height, so the target is
          the whole lane rather than just the glyph. */}
      {isExpandable ? (
        <Pressable
          accessibilityLabel={isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          // See the row above: native reads the state, web reads the ARIA attribute.
          aria-expanded={isExpanded}
          className="absolute top-0 items-center justify-center"
          onPress={handleToggle}
          style={{ height: FS_ROW_HEIGHT, left: chevronLaneLeft(level), width: CHEVRON_SIZE }}
        >
          <ThemedIcon icon={ChevronIcon} token={isSelected ? 'white' : 'muted-foreground'} size={14} />
        </Pressable>
      ) : null}
    </HoldContextMenu>
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
  const [width, setWidth] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const flatListRef = useRef<FlatList<FileSystemRow> | null>(null);
  const containerRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
  const containerHeightRef = useRef(0);
  const rowCountRef = useRef(0);
  const rowsRef = useRef<FileSystemRow[]>([]);

  const rows = useMemo(() => flattenFileSystemRows({ currentPath, expanded, index }), [currentPath, expanded, index]);
  rowCountRef.current = rows.length;
  rowsRef.current = rows;
  // A Shift-range runs through the rows as they are drawn — an expanded folder's
  // children included, since they sit between their parent and its next sibling.
  const orderedPaths = useMemo(() => rows.map((row) => row.entry.path), [rows]);
  const showDate = width === 0 || width >= DATE_COLUMN_MIN_WIDTH;

  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
    containerHeightRef.current = event.nativeEvent.layout.height;
  }, []);
  const toggleExpanded = useCallback((path: string) => setExpanded((previous) => toggleExpandedPath(previous, path)), []);

  const getDragSources = useDragSources(selectedPaths);

  const { session, previewPos, drag, nativeGesture } = useFileSystemDrag({
    containerHeightRef,
    // The rows start below the content container's top padding — without this the
    // resolved row is one boundary off from the one under the pointer.
    contentOffsetTop: LIST_PADDING_TOP,
    enabled: draggable,
    flatListRef,
    getDragSources,
    onMove,
    rows,
    scrollOffsetRef,
  });
  useFileSystemDragWeb({ containerRef, enabled: draggable, session });

  // External drop — attaches to the same scrollable container as the internal
  // drag so pointer-position resolution uses the same coordinate frame and row
  // geometry. Folder rows get a per-row border highlight; file rows and empty
  // space get a background overlay (same fallback the non-list views show).
  const { isOver: isExternalDropOver, targetIndex: externalTargetIndex } = useFileSystemExternalDrop({
    containerRef,
    contentOffsetTop: LIST_PADDING_TOP,
    currentPath,
    onExternalDrop,
    rowHeight: FS_ROW_HEIGHT,
    rows,
    scrollOffsetRef,
  });

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
    // getTargetIndex omitted: DropHighlight handles drag indication; hover is suppressed during drag
    isDragging: session.isActive,
    offsetTop: LIST_PADDING_TOP,
    scrollOffsetRef,
    selectedIndexesRef,
    stride: FS_ROW_HEIGHT,
  });

  const hitTest = useCallback(
    (localX: number, localY: number) => rowHitAt(localX, localY, scrollOffsetRef.current, rowCountRef.current),
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
      if (draggable) setScrollOffset(offset);
    },
    [draggable, hover, marquee],
  );

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemRow>) => (
      <ListRow
        childCount={index.children.get(item.entry.path)?.length}
        getContextMenuActions={getContextMenuActions}
        isSelected={selectedPaths.has(item.entry.path)}
        onActivate={activate}
        onContextMenuAction={onContextMenuAction}
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
      getContextMenuActions,
      index,
      onContextMenuAction,
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
  const useNativePan = draggable && Platform.OS !== 'web' && nativeGesture !== null;
  const body = useNativePan ? <GestureDetector gesture={nativeGesture}>{list}</GestureDetector> : list;

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
        style={drag.active ? WEB_DRAGGING_STYLE : null}
        testID={FS_DRAG_CONTAINER_TEST_ID.list}
        onPress={handleBackgroundPress}
        onLongPress={bgLongPress}
      >
        {/* Both before the list, so they paint behind the rows — see FileSystemHoverHighlight. */}
        <FileSystemHoverHighlight controller={hover} height={FS_ROW_HEIGHT} testID={FS_HOVER_TEST_ID.list} />
        <FileSystemSourceHighlight height={FS_ROW_HEIGHT} origin={rowOrigin(drag.draggedIndex, scrollOffset)} />
        {body}
        {/* External drop: folder rows get a per-row border; file rows and empty
            space get a background overlay. Mutually exclusive with the internal
            drag highlight — both use the same pointer capture, so only one can
            be active at a time. */}
        {isExternalDropOver && externalTargetIndex === null ? (
          <View className="pointer-events-none absolute inset-0 border border-foreground/20 border-dashed bg-foreground/[0.03]" />
        ) : null}
        {isExternalDropOver && externalTargetIndex !== null ? (
          <DropHighlight scrollOffset={scrollOffset} targetIndex={externalTargetIndex} />
        ) : null}
        {drag.active ? (
          <>
            <DropHighlight scrollOffset={scrollOffset} targetIndex={drag.targetIndex} />
            <DragPreview label={drag.previewLabel} pos={previewPos} />
          </>
        ) : null}
        <FileSystemMarqueeBox controller={marquee} />
        {bgMenuNode}
      </Pressable>
    </View>
  );
}
