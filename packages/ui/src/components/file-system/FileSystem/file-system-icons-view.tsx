/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the grid, its marquee and its hover controller are one render layer */
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
  Pressable,
  View,
} from 'react-native';
import { useActiveDrag } from '../../gestures/use-drag-store';
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
import { IconRow } from './file-system-icons-tile';
import type { FileSystemMarqueeController, FileSystemMarqueeRect } from './file-system-marquee';
import { FileSystemMarqueeBox, useFileSystemMarquee, useMarqueeGate } from './file-system-marquee';
import { FS_DRAG_CONTAINER_TEST_ID } from './file-system-test-id';
import type { FileSystemViewProps } from './file-system-view';
import { useEntryActivation } from './use-entry-activation';
import { useFileSystemDragScroll } from './use-file-system-drag-scroll';

/** Stable empty data for the frame before the width is known — see below. */
const NO_ROWS: FileSystemEntry[][] = [];

// ── Grid + drag session ────────────────────────────────────────────────────────

const keyExtractor = (row: FileSystemEntry[]) => row[0]?.path ?? '';
const getItemLayout = (_: ArrayLike<FileSystemEntry[]> | null | undefined, index: number) => ({
  index,
  length: ROW_STRIDE,
  offset: ROW_STRIDE * index,
});

type IconsGrid = {
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
  selectedPaths: ReadonlySet<string>;
  /** `false` outside `selectionMode="multiple"` — see `useFileSystemMarquee`. */
  marqueeEnabled: boolean;
};

type UseIconsHoverParams = {
  columnsRef: MutableRefObject<number>;
  containerRef: RefObject<View | null>;
  /** Past the last entry the grid has slots but no tiles — nothing to highlight. */
  entryCount: number;
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
 * `tileHitAt` clamps to the nearest tile, which is what a drag wants — a drop
 * should commit somewhere. Hover is the stricter question, so the hit is rejected
 * unless the pointer is inside the tile's own box: no highlight in the grid padding
 * or the gaps between tiles. It is also suppressed on the selected tile, whose
 * `bg-surface-selected` box already marks it and reads as a flicker under a hover.
 *
 * Under a drag it goes quiet entirely: each folder tile's own `<Dragzone>` fills
 * its label chip when a release would land there, so a second mark placed from the
 * pointer could only be a chance to disagree with it.
 */
function useIconsHover({
  columnsRef,
  containerRef,
  entryCount,
  isDragging,
  scrollOffsetRef,
  selectedIndexesRef,
  tileWidthRef,
}: UseIconsHoverParams): FileSystemHoverController {
  const resolve = useCallback(
    (localX: number, localY: number) => {
      if (isDragging()) return null;
      const lookup = { columns: columnsRef.current, scrollOffset: scrollOffsetRef.current, tileWidth: tileWidthRef.current };
      const hit = tileHitAt(localX, localY, lookup, entryCount);
      if (hit === null || selectedIndexesRef.current.has(hit)) return null;
      return glyphBoxCorner(hit, lookup);
    },
    [columnsRef, entryCount, isDragging, scrollOffsetRef, selectedIndexesRef, tileWidthRef],
  );
  return useFileSystemHover({ containerRef, resolve });
}

/**
 * Measures the grid and chunks the entries into rows. The column count and tile
 * width live in refs as well as in the render output: the marquee and hover
 * resolvers read them on every pointer move, and refs keep a resize from rebuilding
 * a resolver mid-gesture.
 */
function useIconsGrid({ draggable, entries, marqueeEnabled, onMarquee, selectedPaths }: UseIconsGridParams): IconsGrid {
  const [width, setWidth] = useState(0);
  const flatListRef = useRef<FlatList | null>(null);
  const containerRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
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

  const onLayout = useCallback((event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width), []);

  const { columns, tileWidth } = gridMetrics(width);
  columnsRef.current = columns;
  tileWidthRef.current = tileWidth;

  // Nothing is chunked until a width lands. Guessing a column count first would
  // mean re-chunking on the very next frame, and since a row is keyed by its
  // first entry every key would change — remounting all but one tile. A press
  // in flight over one of those tiles is then lost: the node is detached before
  // its `click` reaches React, which ignores events on unmounted fibers.
  const rows = useMemo(() => (width > 0 ? chunkEntries(entries, columns) : NO_ROWS), [columns, entries, width]);

  // Where the marquee may begin: on a tile the press belongs to that tile — its
  // own `<MultiDraggable>` lifts it — and off one it is the selection box's.
  // Reading the refs rather than the render values keeps the resolver stable
  // across resizes.
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
  const { canStartMarqueeAt } = useMarqueeGate(hitTest);

  // A drag near the top or bottom edge scrolls the grid, so a folder below the
  // fold is reachable without releasing.
  useFileSystemDragScroll({ containerRef, enabled: draggable, flatListRef, scrollOffsetRef });

  const activeDrag = useActiveDrag();
  const isDragging = useCallback(() => activeDrag !== null, [activeDrag]);

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
    isDragging,
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

  return { containerRef, flatListRef, hover, marquee, onLayout, onScroll, rows, tileWidth };
}

// ── View ───────────────────────────────────────────────────────────────────────

export function FileSystemIconsView({
  draggable = false,
  entries,
  getBackgroundContextMenuActions,
  getContextMenuActions,
  loadPreviewImageUrl,
  onBackgroundContextMenuAction,
  onContextMenuAction,
  onExternalDrop,
  onMove,
  onOpen,
  onSelect,
  onMarquee,
  pageUrlCache,
  renderEntryIcon,
  renderFilePreview,
  selectedPaths,
  selectionMode,
  testID,
}: FileSystemViewProps) {
  // The grid lays its tiles out in entry order, so the entry list *is* the
  // ordering a Shift-range runs through.
  const orderedPaths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);
  const { containerRef, flatListRef, hover, marquee, onLayout, onScroll, rows, tileWidth } = useIconsGrid({
    draggable,
    entries,
    marqueeEnabled: selectionMode === 'multiple',
    onMarquee,
    selectedPaths,
  });

  // When selection changes the pointer hasn't moved, so the highlight won't
  // self-dismiss — re-resolve explicitly so a just-selected tile hides it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedPaths is the trigger; it is not read in the body but must be in the deps to re-fire on selection change
  // biome-ignore lint/plugin: re-resolve is a side-effect on an Animated value, not render state
  useEffect(() => {
    hover.refresh();
  }, [hover, selectedPaths]);

  const { onLongPress: bgLongPress, menuNode: bgMenuNode } = useBackgroundContextMenu(
    containerRef,
    getBackgroundContextMenuActions,
    onBackgroundContextMenuAction,
  );
  const handleBackgroundPress = useCallback(() => onSelect(null), [onSelect]);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemEntry[]>) => (
      <IconRow
        draggable={draggable}
        getContextMenuActions={getContextMenuActions}
        loadPreviewImageUrl={loadPreviewImageUrl}
        onActivate={activate}
        onContextMenuAction={onContextMenuAction}
        onExternalDrop={onExternalDrop}
        onMove={onMove}
        onSelectLongPress={selectLongPress}
        pageUrlCache={pageUrlCache}
        renderEntryIcon={renderEntryIcon}
        renderFilePreview={renderFilePreview}
        row={item}
        selectedPaths={selectedPaths}
        testID={testID}
        tileWidth={tileWidth}
      />
    ),
    [
      activate,
      draggable,
      getContextMenuActions,
      loadPreviewImageUrl,
      onContextMenuAction,
      onExternalDrop,
      onMove,
      pageUrlCache,
      renderEntryIcon,
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
      extraData={selectedPaths}
      getItemLayout={getItemLayout}
      keyExtractor={keyExtractor}
      onScroll={onScroll}
      renderItem={renderRow}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    />
  );
  return (
    <View className="min-h-0 flex-1" onLayout={onLayout}>
      <Pressable
        ref={containerRef}
        className="relative min-h-0 flex-1 select-none"
        testID={FS_DRAG_CONTAINER_TEST_ID.icons}
        onPress={handleBackgroundPress}
        onLongPress={bgLongPress}
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
        {/* No background zone here: a drop that misses every folder tile belongs to
            the folder that is open, and that fallback is mounted once in
            file-system-body so all four views answer an empty-space drop alike. */}
        {list}
        {/* After the grid, so the band paints over the tiles it is sweeping. The
            drag ghost is drawn by the manager's overlay now, above this whole
            subtree, so nothing about it is mounted here. */}
        <FileSystemMarqueeBox controller={marquee} />
        {bgMenuNode}
      </Pressable>
    </View>
  );
}
