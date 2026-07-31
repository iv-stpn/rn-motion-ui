/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the view and its row/header/overlay parts are one render layer */
// The list view: a disclosure tree with Name / Date Modified / Size columns.
// The web version drives @pierre/trees; here the rows come from the sorted
// index (see file-system-rows) and render through a FlatList, so the same
// folder-first ordering and per-folder disclosure survive without the DOM.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { cn } from '../../lib/cn';
import { ChevronDown, ChevronRight, ChevronUp } from '../../lib/icons';
import { ThemedIcon } from '../Icon/themed-icon';
import { Text } from '../Text/text';
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
import type { FileSystemRow } from './file-system-rows';
import { flattenFileSystemRows, toggleExpandedPath } from './file-system-rows';
import { fileSystemEntryTestID } from './file-system-test-id';
import type { FileSystemViewProps } from './file-system-view';
import { useEntryActivation, useEntryLongPress } from './use-entry-activation';
import { FS_DRAG_CONTAINER_TEST_ID, FS_ROW_HEIGHT, useDragSources, useFileSystemDrag } from './use-file-system-drag';
import { useFileSystemDragWeb } from './use-file-system-drag-web';

const NAME_LABEL = 'Name';
const DATE_LABEL = 'Date Modified';
const SIZE_LABEL = 'Size';
const MISSING_VALUE = '—';

const INDENT_PER_LEVEL = 14;
/** The chevron lane, reserved on file rows too so names stay aligned. */
const CHEVRON_SIZE = 18;
const ICON_SIZE = 16;
const FOLDER_GLYPH_SIZE = 18;
/** Below this the date column drops out, leaving name + size. */
const DATE_COLUMN_MIN_WIDTH = 420;

// Web-only style props (userSelect / touchAction are absent from RN's ViewStyle).
// Selection is off for the whole body; touchAction is clamped only during a drag
// so ordinary touch scrolling is unaffected the rest of the time.
type WebViewStyle = ViewStyle & { userSelect?: string; touchAction?: string };
const WEB_BODY_STYLE: WebViewStyle | null = Platform.OS === 'web' ? { userSelect: 'none' } : null;
const WEB_DRAGGING_STYLE: WebViewStyle | null = Platform.OS === 'web' ? { userSelect: 'none', touchAction: 'none' } : null;

/** Content-container top padding (py-1 = 4 px): where row 0 starts. */
const LIST_PADDING_TOP = 4;
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
      pointerEvents="none"
      className="absolute right-0 left-0 z-[3] rounded-md border border-primary"
      style={{ height: FS_ROW_HEIGHT, top: targetIndex * FS_ROW_HEIGHT + LIST_PADDING_TOP - scrollOffset }}
    />
  );
}

type DragPreviewProps = { label: string; pos: Animated.ValueXY };

/** Floating label chip that tracks the pointer during a drag (no re-renders). */
function DragPreview({ label, pos }: DragPreviewProps) {
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute top-0 left-0 z-[4]"
      style={{ transform: pos.getTranslateTransform() }}
    >
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

type ListRowProps = {
  childCount: number | undefined;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  /** Long-press toggles this row's selection; `undefined` leaves the gesture to the context menu. */
  onSelectLongPress?: (entry: FileSystemEntry) => void;
  onToggleExpanded: (path: string) => void;
  row: FileSystemRow;
  showDate: boolean;
  /** Already resolved for this entry by the view — see `fileSystemEntryTestID`. */
  testID?: string;
};

/** Disclosure chevron, icon, name, then the metadata columns. */
function ListRow({
  childCount,
  getContextMenuActions,
  isSelected,
  onActivate,
  onContextMenuAction,
  onSelectLongPress,
  onToggleExpanded,
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

  const {
    wrapperRef,
    onLongPress: openContextMenu,
    contextMenuNode,
  } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);
  const onLongPress = useEntryLongPress(entry, onSelectLongPress, openContextMenu);

  return (
    <View ref={wrapperRef}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpandable ? isExpanded : undefined, selected: isSelected }}
        // Both, deliberately: `accessibilityState` is what native reads, and
        // react-native-web maps `aria-selected` but not `accessibilityState`, so
        // on web the fill would otherwise be the only thing saying "picked".
        aria-selected={isSelected}
        // Hover is not a class here: it is one sliding node behind the rows, so it
        // can keep tracking under the drag's pointer capture. See file-system-hover.
        className={cn('flex-row items-center gap-1 rounded-md px-2', isSelected && 'bg-info')}
        onLongPress={onLongPress}
        onPress={handlePress}
        style={{ height: FS_ROW_HEIGHT, paddingLeft: 8 + level * INDENT_PER_LEVEL }}
        testID={testID}
      >
        {isExpandable ? (
          <Pressable
            accessibilityLabel={isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
            accessibilityRole="button"
            className="items-center justify-center"
            onPress={handleToggle}
            style={{ width: CHEVRON_SIZE }}
          >
            <ThemedIcon icon={ChevronIcon} token={isSelected ? 'white' : 'muted-foreground'} size={14} />
          </Pressable>
        ) : (
          <View style={{ width: CHEVRON_SIZE }} />
        )}
        {entry.kind === 'folder' ? (
          <FileSystemFolderGlyph size={FOLDER_GLYPH_SIZE} />
        ) : (
          <FileTypeIcon fileName={entry.name} size={ICON_SIZE} />
        )}
        <Text className={cn('flex-1', textClassName)} numberOfLines={1} size="sm">
          {entry.name}
        </Text>
        {showDate ? (
          <Text className={cn('w-44', metaClassName)} numberOfLines={1} size="xs">
            {formatTimestamp(entry.updatedAt ?? entry.createdAt) ?? MISSING_VALUE}
          </Text>
        ) : null}
        <Text className={cn('w-20 text-right', metaClassName)} numberOfLines={1} numeric={true} size="xs">
          {entry.kind === 'folder' ? itemCountLabel(childCount) : (formatByteSize(entry.size) ?? MISSING_VALUE)}
        </Text>
        {contextMenuNode}
      </Pressable>
    </View>
  );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: drag, hover, context-menu, and row layout are tightly coupled around shared state — splitting would scatter interdependent logic
export function FileSystemListView({
  currentPath,
  draggable = false,
  folderName,
  getBackgroundContextMenuActions,
  getContextMenuActions,
  index,
  onBackgroundContextMenuAction,
  onContextMenuAction,
  onMove,
  onOpen,
  onSelect,
  onSortColumnClick,
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

  const rows = useMemo(() => flattenFileSystemRows({ currentPath, expanded, index }), [currentPath, expanded, index]);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedPaths is the trigger; not read in the body but must be in the deps to re-fire on selection change
  // biome-ignore lint/plugin: re-resolve is a side-effect on an Animated value, not render state
  useEffect(() => {
    hover.refresh();
  }, [hover, selectedPaths]);

  const backgroundMenu = useBackgroundContextMenu(
    containerRef,
    getBackgroundContextMenuActions,
    onBackgroundContextMenuAction,
    folderName,
  );
  const handleBackgroundPress = useCallback(() => onSelect(null), [onSelect]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = offset;
      // The pointer has not moved but the rows under it have, so the highlight has
      // to re-resolve — including while a drag auto-scrolls the list.
      hover.refresh();
      if (draggable) setScrollOffset(offset);
    },
    [draggable, hover],
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
        <View style={{ width: CHEVRON_SIZE + ICON_SIZE + 4 }} />
        <ColumnHeader className="flex-1" label={NAME_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="name" />
        {showDate ? (
          <ColumnHeader className="w-44" label={DATE_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="updatedAt" />
        ) : null}
        <ColumnHeader className="w-20 justify-end" label={SIZE_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="size" />
      </View>
      <Pressable
        ref={containerRef}
        className="relative min-h-0 flex-1"
        style={drag.active ? WEB_DRAGGING_STYLE : WEB_BODY_STYLE}
        testID={FS_DRAG_CONTAINER_TEST_ID.list}
        onPress={handleBackgroundPress}
        onLongPress={backgroundMenu.onLongPress}
      >
        {/* Both before the list, so they paint behind the rows — see FileSystemHoverHighlight. */}
        <FileSystemHoverHighlight controller={hover} height={FS_ROW_HEIGHT} testID={FS_HOVER_TEST_ID.list} />
        <FileSystemSourceHighlight height={FS_ROW_HEIGHT} origin={rowOrigin(drag.draggedIndex, scrollOffset)} />
        {body}
        {drag.active ? (
          <>
            <DropHighlight scrollOffset={scrollOffset} targetIndex={drag.targetIndex} />
            <DragPreview label={drag.previewLabel} pos={previewPos} />
          </>
        ) : null}
        {backgroundMenu.contextMenuNode}
      </Pressable>
    </View>
  );
}
