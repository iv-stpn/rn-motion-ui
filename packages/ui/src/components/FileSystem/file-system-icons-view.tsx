/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The icons view: a Finder-style tile grid. The web original leans on CSS
// `auto-fill` plus a hand-rolled virtual window; here the measured viewport
// width picks a column count and the entries are pre-chunked into rows so a
// FlatList can window them.

import { type MutableRefObject, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
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
import type { FileSystemEntry } from './file-system.types';
import { useBackgroundContextMenu } from './file-system-context-menu';
import {
  type FileSystemHoverController,
  FileSystemHoverHighlight,
  FS_HOVER_TEST_ID,
  useFileSystemHover,
} from './file-system-hover';
import { chunkEntries, gridMetrics, ROW_STRIDE, TILE_HEIGHT, tileAt, tileCorner } from './file-system-icons-grid';
import { DragGhost, IconRow } from './file-system-icons-tile';
import type { FileSystemViewProps } from './file-system-view';
import { useEntryActivation } from './use-entry-activation';
import { FS_DRAG_CONTAINER_TEST_ID } from './use-file-system-drag';
import { type UseIconsDragReturn, useIconsViewDrag } from './use-file-system-icons-drag';

// Web-only style props (userSelect / touchAction are absent from RN's ViewStyle).
type WebViewStyle = ViewStyle & { userSelect?: string; touchAction?: string };
const WEB_BODY_STYLE: WebViewStyle | null = Platform.OS === 'web' ? { userSelect: 'none' } : null;
const WEB_DRAGGING_STYLE: WebViewStyle | null = Platform.OS === 'web' ? { userSelect: 'none', touchAction: 'none' } : null;

/** Stable empty data for the frame before the width is known — see below. */
const NO_ROWS: FileSystemEntry[][] = [];

// ── Grid + drag session ────────────────────────────────────────────────────────

const keyExtractor = (row: FileSystemEntry[]) => row[0]?.path ?? '';
const getItemLayout = (_: ArrayLike<FileSystemEntry[]> | null | undefined, index: number) => ({
  index,
  length: ROW_STRIDE,
  offset: ROW_STRIDE * index,
});

type IconsGrid = UseIconsDragReturn & {
  containerRef: RefObject<View | null>;
  flatListRef: RefObject<FlatList | null>;
  hover: FileSystemHoverController;
  onLayout: (event: LayoutChangeEvent) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  rows: FileSystemEntry[][];
  tileWidth: number;
};

type UseIconsHoverParams = {
  columnsRef: MutableRefObject<number>;
  containerRef: RefObject<View | null>;
  /** Past the last entry the grid has slots but no tiles — nothing to highlight. */
  entryCount: number;
  isDragging: () => boolean;
  scrollOffsetRef: MutableRefObject<number>;
  /** Flat index of the selected entry, or null. Selected tiles suppress normal hover. */
  selectedIndexRef: MutableRefObject<number | null>;
  tileWidthRef: MutableRefObject<number>;
};

/**
 * Hover controller for the tile grid. `tileAt` clamps to the nearest tile, which
 * is what a drag wants — a drop should commit somewhere. Hover is the stricter
 * question, so the hit is rejected unless the pointer is inside the tile's own
 * box: no highlight in the grid padding or the gaps between tiles.
 *
 * Hover is suppressed entirely during a drag — the label chip fill on `isDropTarget`
 * already marks the folder a drop would land in, so a second highlight is redundant.
 * It is also suppressed on the selected tile — its `bg-surface-selected` glyph box
 * already marks it, and a hover on top reads as a confusing flicker on click.
 */
function useIconsHover({
  columnsRef,
  containerRef,
  entryCount,
  isDragging,
  scrollOffsetRef,
  selectedIndexRef,
  tileWidthRef,
}: UseIconsHoverParams): FileSystemHoverController {
  const resolve = useCallback(
    (localX: number, localY: number) => {
      if (isDragging()) return null;
      const lookup = { columns: columnsRef.current, scrollOffset: scrollOffsetRef.current, tileWidth: tileWidthRef.current };
      const hit = tileAt(localX, localY, lookup);
      if (hit.index >= entryCount) return null;
      if (hit.index === selectedIndexRef.current) return null;
      const inside = localX >= hit.x && localX < hit.x + lookup.tileWidth && localY >= hit.y && localY < hit.y + TILE_HEIGHT;
      return inside ? tileCorner(hit.index, lookup) : null;
    },
    [columnsRef, entryCount, isDragging, scrollOffsetRef, selectedIndexRef, tileWidthRef],
  );
  return useFileSystemHover({ containerRef, isDragging, resolve });
}

/**
 * Measures the grid, chunks the entries into rows, and opens the drag session.
 * The column count and tile width live in refs as well as in the render output:
 * the session's index resolver reads them on every pointer move, and refs keep
 * a resize from tearing down the session mid-drag.
 */
function useIconsGrid(
  entries: FileSystemEntry[],
  draggable: boolean,
  onMove: FileSystemViewProps['onMove'],
  selectedPath: string | null,
): IconsGrid {
  const [width, setWidth] = useState(0);
  const flatListRef = useRef<FlatList | null>(null);
  const containerRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
  const containerHeightRef = useRef(0);
  const columnsRef = useRef(1);
  const tileWidthRef = useRef(0);
  const selectedIndexRef = useRef<number | null>(null);
  selectedIndexRef.current = selectedPath === null ? null : entries.findIndex((e) => e.path === selectedPath);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
    containerHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const { columns, tileWidth } = gridMetrics(width);
  columnsRef.current = columns;
  tileWidthRef.current = tileWidth;

  // Nothing is chunked until a width lands. Guessing a column count first would
  // mean re-chunking on the very next frame, and since a row is keyed by its
  // first entry every key would change — remounting all but one tile. A press
  // in flight over one of those tiles is then lost: the node is detached before
  // its `click` reaches React, which ignores events on unmounted fibers.
  const rows = useMemo(() => (width > 0 ? chunkEntries(entries, columns) : NO_ROWS), [columns, entries, width]);

  const dragSession = useIconsViewDrag({
    columnsRef,
    containerHeightRef,
    containerRef,
    enabled: draggable,
    entries,
    flatListRef,
    onMove,
    scrollOffsetRef,
    tileWidthRef,
  });

  const hover = useIconsHover({
    columnsRef,
    containerRef,
    entryCount: entries.length,
    isDragging: dragSession.isDragging,
    scrollOffsetRef,
    selectedIndexRef,
    tileWidthRef,
  });

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      // The pointer sits still while the tiles move under it, so the highlight has
      // to re-resolve — including while a drag auto-scrolls the grid.
      hover.refresh();
    },
    [hover],
  );

  return { ...dragSession, containerRef, flatListRef, hover, onLayout, onScroll, rows, tileWidth };
}

// ── View ───────────────────────────────────────────────────────────────────────

export function FileSystemIconsView({
  currentPath,
  draggable = false,
  entries,
  getBackgroundContextMenuActions,
  getContextMenuActions,
  loadPreviewImageUrl,
  onBackgroundContextMenuAction,
  onContextMenuAction,
  onMove,
  onOpen,
  onSelect,
  pageUrlCache,
  renderFilePreview,
  selectedPath,
}: FileSystemViewProps) {
  const activate = useEntryActivation(onOpen, onSelect);
  const {
    containerRef,
    drag,
    draggedEntry,
    dragTargetPath,
    flatListRef,
    hover,
    nativeGesture,
    onLayout,
    onScroll,
    previewPos,
    rows,
    tileWidth,
  } = useIconsGrid(entries, draggable, onMove, selectedPath);
  const draggedPath = draggedEntry?.path ?? null;

  // When selection changes the pointer hasn't moved, so the highlight won't
  // self-dismiss — re-resolve explicitly so a just-selected tile hides it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedPath is the trigger; it is not read in the body but must be in the deps to re-fire on selection change
  // biome-ignore lint/plugin: re-resolve is a side-effect on an Animated value, not render state
  useEffect(() => {
    hover.refresh();
  }, [hover, selectedPath]);

  const folderTitle = currentPath.split('/').filter(Boolean).at(-1) ?? 'Files';
  const backgroundMenu = useBackgroundContextMenu(
    containerRef,
    getBackgroundContextMenuActions,
    onBackgroundContextMenuAction,
    folderTitle,
  );
  const handleBackgroundPress = useCallback(() => onSelect(null), [onSelect]);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemEntry[]>) => (
      <IconRow
        draggedPath={draggedPath}
        dragTargetPath={dragTargetPath}
        getContextMenuActions={getContextMenuActions}
        loadPreviewImageUrl={loadPreviewImageUrl}
        onActivate={activate}
        onContextMenuAction={onContextMenuAction}
        pageUrlCache={pageUrlCache}
        renderFilePreview={renderFilePreview}
        row={item}
        selectedPath={selectedPath}
        tileWidth={tileWidth}
      />
    ),
    [
      activate,
      draggedPath,
      dragTargetPath,
      getContextMenuActions,
      loadPreviewImageUrl,
      onContextMenuAction,
      pageUrlCache,
      renderFilePreview,
      selectedPath,
      tileWidth,
    ],
  );

  const list = (
    <FlatList
      ref={flatListRef}
      className="flex-1"
      contentContainerClassName="p-3"
      data={rows}
      getItemLayout={getItemLayout}
      keyExtractor={keyExtractor}
      onScroll={onScroll}
      renderItem={renderRow}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    />
  );
  const isNativeDrag = draggable && Platform.OS !== 'web' && nativeGesture !== null;
  const body = isNativeDrag ? <GestureDetector gesture={nativeGesture}>{list}</GestureDetector> : list;

  return (
    <View className="min-h-0 flex-1" onLayout={onLayout}>
      <Pressable
        ref={containerRef}
        className="relative min-h-0 flex-1"
        style={drag.active ? WEB_DRAGGING_STYLE : WEB_BODY_STYLE}
        testID={FS_DRAG_CONTAINER_TEST_ID.icons}
        onPress={handleBackgroundPress}
        onLongPress={backgroundMenu.onLongPress}
      >
        {/* Before the grid, so it paints behind the tiles — see FileSystemHoverHighlight.
            Sized to the glyph box, not the tile: that box is what selection fills
            and a drop outlines, so all three states mark one rect. */}
        <FileSystemHoverHighlight
          className="rounded-lg"
          controller={hover}
          height={TILE_HEIGHT}
          testID={FS_HOVER_TEST_ID.icons}
          width={tileWidth}
        />
        {body}
        {draggedEntry ? (
          <DragGhost
            entry={draggedEntry}
            loadPreviewImageUrl={loadPreviewImageUrl}
            pageUrlCache={pageUrlCache}
            pos={previewPos}
            renderFilePreview={renderFilePreview}
            width={tileWidth}
          />
        ) : null}
        {backgroundMenu.contextMenuNode}
      </Pressable>
    </View>
  );
}
