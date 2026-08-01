/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the grid, its drag session and its hover controller are one render layer */
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
import {
  chunkEntries,
  GLYPH_BOX_HEIGHT,
  GLYPH_BOX_WIDTH,
  glyphBoxCorner,
  gridMetrics,
  ROW_STRIDE,
  tileHitAt,
  tilesInRect,
} from './file-system-icons-grid';
import { DragGhost, IconRow } from './file-system-icons-tile';
import type { FileSystemMarqueeController, FileSystemMarqueeRect } from './file-system-marquee';
import { FileSystemMarqueeBox, useFileSystemMarquee, useMarqueeGate } from './file-system-marquee';
import type { FileSystemViewProps } from './file-system-view';
import { useEntryActivation } from './use-entry-activation';
import { FS_DRAG_CONTAINER_TEST_ID, useDragSources } from './use-file-system-drag';
import { type UseIconsDragReturn, useIconsViewDrag } from './use-file-system-icons-drag';

// Selection is off via `select-none` on the grid surface below; `touchAction` has
// no utility class and is absent from RN's ViewStyle, so it stays an inline web
// style — clamped only during a drag, so ordinary touch scrolling is unaffected.
type WebViewStyle = ViewStyle & { touchAction?: string };
const WEB_DRAGGING_STYLE: WebViewStyle | null = Platform.OS === 'web' ? { touchAction: 'none' } : null;

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
  marquee: FileSystemMarqueeController;
  onLayout: (event: LayoutChangeEvent) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  rows: FileSystemEntry[][];
  tileWidth: number;
};

type UseIconsGridParams = {
  draggable: boolean;
  entries: FileSystemEntry[];
  onMarquee: (covered: readonly string[], base: ReadonlySet<string> | null) => void;
  onMove: FileSystemViewProps['onMove'];
  selectedPaths: ReadonlySet<string>;
  /** `false` outside `selectionMode="multiple"` — see `useFileSystemMarquee`. */
  marqueeEnabled: boolean;
};

type UseIconsHoverParams = {
  columnsRef: MutableRefObject<number>;
  containerRef: RefObject<View | null>;
  /** Past the last entry the grid has slots but no tiles — nothing to highlight. */
  entryCount: number;
  /** The entry index a drop would commit to, read live — see the resolver below. */
  getTargetIndex: () => number | null;
  isDragging: () => boolean;
  scrollOffsetRef: MutableRefObject<number>;
  /** Flat indexes of the selected entries. Selected tiles suppress normal hover. */
  selectedIndexesRef: MutableRefObject<ReadonlySet<number>>;
  tileWidthRef: MutableRefObject<number>;
};

/**
 * Hover controller for the tile grid, marking glyph boxes rather than whole tiles:
 * that box is the tile's state surface, so hover, selection and a pending drop all
 * describe the same rect.
 *
 * `tileAt` clamps to the nearest tile, which is what a drag wants — a drop should
 * commit somewhere. Hover is the stricter question, so the hit is rejected unless
 * the pointer is inside the tile's own box: no highlight in the grid padding or
 * the gaps between tiles. It is also suppressed on the selected tile, whose
 * `bg-surface-selected` box already marks it and reads as a flicker under a hover.
 */
function useIconsHover({
  columnsRef,
  containerRef,
  entryCount,
  getTargetIndex,
  isDragging,
  scrollOffsetRef,
  selectedIndexesRef,
  tileWidthRef,
}: UseIconsHoverParams): FileSystemHoverController {
  const resolve = useCallback(
    (localX: number, localY: number) => {
      const lookup = { columns: columnsRef.current, scrollOffset: scrollOffsetRef.current, tileWidth: tileWidthRef.current };
      // Under a drag the highlight is placed from the drop target instead of the
      // pointer, so it cannot disagree with the label chip that names the same
      // index: the source tile does not stay lit, a file passed over never lights
      // up, and the pointer may sit in a gap while the target is a real folder.
      if (isDragging()) {
        const target = getTargetIndex();
        return target === null ? null : glyphBoxCorner(target, lookup);
      }
      const hit = tileHitAt(localX, localY, lookup, entryCount);
      if (hit === null || selectedIndexesRef.current.has(hit)) return null;
      return glyphBoxCorner(hit, lookup);
    },
    [columnsRef, entryCount, getTargetIndex, isDragging, scrollOffsetRef, selectedIndexesRef, tileWidthRef],
  );
  return useFileSystemHover({ containerRef, isDragging, resolve });
}

/**
 * Measures the grid, chunks the entries into rows, and opens the drag session.
 * The column count and tile width live in refs as well as in the render output:
 * the session's index resolver reads them on every pointer move, and refs keep
 * a resize from tearing down the session mid-drag.
 */
function useIconsGrid({ draggable, entries, marqueeEnabled, onMarquee, onMove, selectedPaths }: UseIconsGridParams): IconsGrid {
  const [width, setWidth] = useState(0);
  const flatListRef = useRef<FlatList | null>(null);
  const containerRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
  const containerHeightRef = useRef(0);
  const columnsRef = useRef(1);
  const tileWidthRef = useRef(0);
  const selectedIndexesRef = useRef<ReadonlySet<number>>(new Set());
  selectedIndexesRef.current = useMemo(() => {
    const indexes = new Set<number>();
    entries.forEach((entry, entryIndex) => {
      if (selectedPaths.has(entry.path)) indexes.add(entryIndex);
    });
    return indexes;
  }, [entries, selectedPaths]);

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

  // The one hit test both gestures are cut from: a press is on a tile, where a
  // drag lifts, or it is not, where the selection box starts. Reading the refs
  // rather than the render values keeps the two resolvers stable across resizes.
  const entryCount = entries.length;
  const hitTest = useCallback(
    (localX: number, localY: number) =>
      tileHitAt(
        localX,
        localY,
        { columns: columnsRef.current, scrollOffset: scrollOffsetRef.current, tileWidth: tileWidthRef.current },
        entryCount,
      ),
    [entryCount],
  );
  const { canBeginDragAt, canStartMarqueeAt } = useMarqueeGate(hitTest);

  const dragSession = useIconsViewDrag({
    canBeginAt: canBeginDragAt,
    columnsRef,
    containerHeightRef,
    containerRef,
    enabled: draggable,
    entries,
    flatListRef,
    getDragSources: useDragSources(selectedPaths),
    onMove,
    scrollOffsetRef,
    tileWidthRef,
  });

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const selectedRef = useRef(selectedPaths);
  selectedRef.current = selectedPaths;

  const marquee = useFileSystemMarquee({
    canStartAt: canStartMarqueeAt,
    containerRef,
    enabled: marqueeEnabled,
    getScrollOffset: useCallback(() => scrollOffsetRef.current, []),
    getSelectedPaths: useCallback(() => selectedRef.current, []),
    onMarquee,
    resolve: useCallback(
      (rect: FileSystemMarqueeRect) =>
        tilesInRect(rect, { columns: columnsRef.current, tileWidth: tileWidthRef.current }, entriesRef.current.length).map(
          (index) => entriesRef.current[index]?.path ?? '',
        ),
      [],
    ),
  });

  const hover = useIconsHover({
    columnsRef,
    containerRef,
    entryCount: entries.length,
    getTargetIndex: dragSession.getTargetIndex,
    isDragging: dragSession.isDragging,
    scrollOffsetRef,
    selectedIndexesRef,
    tileWidthRef,
  });

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      // The pointer sits still while the tiles move under it, so the highlight has
      // to re-resolve — including while a drag auto-scrolls the grid. The band is
      // anchored in the content frame, so it has to be re-placed for the same
      // reason, and re-resolved: scrolling grows the region it covers.
      hover.refresh();
      marquee.refresh();
    },
    [hover, marquee],
  );

  return { ...dragSession, containerRef, flatListRef, hover, marquee, onLayout, onScroll, rows, tileWidth };
}

// ── View ───────────────────────────────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: drag, hover, context-menu, and tile layout are tightly coupled around shared state — splitting would scatter interdependent logic
export function FileSystemIconsView({
  draggable = false,
  entries,
  folderName,
  getBackgroundContextMenuActions,
  getContextMenuActions,
  loadPreviewImageUrl,
  onBackgroundContextMenuAction,
  onContextMenuAction,
  onMove,
  onOpen,
  onSelect,
  onMarquee,
  pageUrlCache,
  renderFilePreview,
  selectedPaths,
  selectionMode,
  testID,
}: FileSystemViewProps) {
  // The grid lays its tiles out in entry order, so the entry list *is* the
  // ordering a Shift-range runs through.
  const orderedPaths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);
  const {
    containerRef,
    drag,
    draggedEntry,
    dragTargetPath,
    flatListRef,
    hover,
    marquee,
    nativeGesture,
    onLayout,
    onScroll,
    previewPos,
    rows,
    tileWidth,
  } = useIconsGrid({
    draggable,
    entries,
    marqueeEnabled: selectionMode === 'multiple',
    onMarquee,
    onMove,
    selectedPaths,
  });
  const draggedPaths = useMemo(() => new Set(drag.draggedPaths), [drag.draggedPaths]);

  // When selection changes the pointer hasn't moved, so the highlight won't
  // self-dismiss — re-resolve explicitly so a just-selected tile hides it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedPaths is the trigger; it is not read in the body but must be in the deps to re-fire on selection change
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

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemEntry[]>) => (
      <IconRow
        draggedPaths={draggedPaths}
        dragTargetPath={dragTargetPath}
        getContextMenuActions={getContextMenuActions}
        loadPreviewImageUrl={loadPreviewImageUrl}
        onActivate={activate}
        onContextMenuAction={onContextMenuAction}
        onSelectLongPress={selectLongPress}
        pageUrlCache={pageUrlCache}
        renderFilePreview={renderFilePreview}
        row={item}
        selectedPaths={selectedPaths}
        testID={testID}
        tileWidth={tileWidth}
      />
    ),
    [
      activate,
      draggedPaths,
      dragTargetPath,
      getContextMenuActions,
      loadPreviewImageUrl,
      onContextMenuAction,
      pageUrlCache,
      renderFilePreview,
      selectedPaths,
      selectLongPress,
      testID,
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
        className="relative min-h-0 flex-1 select-none"
        style={drag.active ? WEB_DRAGGING_STYLE : null}
        testID={FS_DRAG_CONTAINER_TEST_ID.icons}
        onPress={handleBackgroundPress}
        onLongPress={backgroundMenu.onLongPress}
      >
        {/* Before the grid, so it paints behind the tiles — see FileSystemHoverHighlight.
            Sized to the glyph box, not the tile: that box is what selection fills
            and a drop marks, so all three states land on one rect. `rounded-lg`
            and the size match IconTileFace's box exactly. */}
        <FileSystemHoverHighlight
          className="rounded-lg"
          controller={hover}
          height={GLYPH_BOX_HEIGHT}
          testID={FS_HOVER_TEST_ID.icons}
          width={GLYPH_BOX_WIDTH}
        />
        {body}
        {/* After the grid, so the band paints over the tiles it is sweeping. */}
        <FileSystemMarqueeBox controller={marquee} />
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
