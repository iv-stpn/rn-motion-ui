/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the grid, its marquee and its hover controller are one render layer */
// The icons view: a Finder-style tile grid. The web original leans on CSS
// `auto-fill` plus a hand-rolled virtual window; here the measured viewport
// width picks a column count and the tiles are laid out flat with flex-wrap so a
// Reanimated layout transition can slide every tile to its new slot when a
// sibling is added or removed.

import { type MutableRefObject, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import { useActiveDrag } from '../../gestures/use-drag-store';
import type { FileSystemEntry } from './file-system.types';
import { FileSystemAnimatedTile } from './file-system-animated-tile';
import { useBackgroundContextMenu } from './file-system-context-menu';
import {
  type FileSystemHoverController,
  FileSystemHoverHighlight,
  FS_HOVER_TEST_ID,
  useFileSystemHover,
} from './file-system-hover';
import {
  GLYPH_BOX_HEIGHT,
  GLYPH_BOX_WIDTH,
  GRID_PADDING,
  glyphBoxCorner,
  gridMetrics,
  ROW_GAP,
  TILE_GAP,
  tileHitAt,
  tilesInRect,
} from './file-system-icons-grid';
import { IconTile } from './file-system-icons-tile';
import type { FileSystemMarqueeController, FileSystemMarqueeRect } from './file-system-marquee';
import { FileSystemMarqueeBox, useFileSystemMarquee, useMarqueeGate } from './file-system-marquee';
import { FS_DRAG_CONTAINER_TEST_ID, fileSystemEntryTestID } from './file-system-test-id';
import type { FileSystemViewProps } from './file-system-view';
import { useEntryActivation } from './use-entry-activation';
import { useFileSystemDragScroll } from './use-file-system-drag-scroll';

// ── Grid + drag session ────────────────────────────────────────────────────────

type IconsGrid = {
  containerRef: RefObject<View | null>;
  scrollRef: RefObject<ScrollView | null>;
  hover: FileSystemHoverController;
  marquee: FileSystemMarqueeController;
  onLayout: (event: LayoutChangeEvent) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Measured viewport width — tiles render only once this lands (see `useIconsGrid`). */
  width: number;
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
 * Measures the grid and resolves the column count and tile width. The column count
 * and tile width live in refs as well as in the render output: the marquee and hover
 * resolvers read them on every pointer move, and refs keep a resize from rebuilding
 * a resolver mid-gesture.
 */
function useIconsGrid({ draggable, entries, marqueeEnabled, onMarquee, selectedPaths }: UseIconsGridParams): IconsGrid {
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
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
  const scrollTo = useCallback((offset: number) => scrollRef.current?.scrollTo({ y: offset, animated: false }), []);
  useFileSystemDragScroll({ containerRef, enabled: draggable, scrollOffsetRef, scrollTo });

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

  return { containerRef, hover, marquee, onLayout, onScroll, scrollRef, tileWidth, width };
}

// ── View ───────────────────────────────────────────────────────────────────────

export function FileSystemIconsView({
  currentPath,
  draggable = false,
  entries,
  fileFilter,
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
  // A filter is a view concern: while one is active, items dropping out of the
  // list are being *filtered*, not removed, so nothing should animate. When the
  // filter is engaged or disengaged the whole grid swaps instantly — handled by
  // keying the grid below rather than diffing entries.
  const filterActive = fileFilter !== null;
  const animated = !filterActive;

  // The grid lays its tiles out in entry order, so the entry list *is* the
  // ordering a Shift-range runs through.
  const orderedPaths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);
  const { containerRef, hover, marquee, onLayout, onScroll, scrollRef, tileWidth, width } = useIconsGrid({
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

  // A wholesale swap — the very first layout, a folder change, or the filter
  // engaging/disengaging — remounts the grid (key change) so `skipEntering` and
  // `skipExiting` drop the mass enter/exit. In-folder adds/removes/moves keep the
  // same key, so their tiles animate normally via `FileSystemAnimatedTile`.
  const gridKey = `${currentPath}\u0000${filterActive ? 'filtered' : 'all'}`;

  const grid = (
    <ScrollView
      ref={scrollRef}
      className="flex-1"
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      {width > 0 ? (
        <LayoutAnimationConfig key={gridKey} skipEntering={true} skipExiting={true}>
          <View className="flex-row flex-wrap" style={{ columnGap: TILE_GAP, padding: GRID_PADDING, rowGap: ROW_GAP }}>
            {entries.map((entry) => (
              <FileSystemAnimatedTile animated={animated} key={entry.path} width={tileWidth}>
                <IconTile
                  draggable={draggable}
                  entry={entry}
                  getContextMenuActions={getContextMenuActions}
                  isSelected={selectedPaths.has(entry.path)}
                  loadPreviewImageUrl={loadPreviewImageUrl}
                  onActivate={activate}
                  onContextMenuAction={onContextMenuAction}
                  onExternalDrop={onExternalDrop}
                  onMove={onMove}
                  onSelectLongPress={selectLongPress}
                  pageUrlCache={pageUrlCache}
                  renderEntryIcon={renderEntryIcon}
                  renderFilePreview={renderFilePreview}
                  testID={fileSystemEntryTestID(testID, entry.path)}
                  width={tileWidth}
                />
              </FileSystemAnimatedTile>
            ))}
          </View>
        </LayoutAnimationConfig>
      ) : null}
    </ScrollView>
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
        {grid}
        {/* After the grid, so the band paints over the tiles it is sweeping. The
            drag ghost is drawn by the manager's overlay now, above this whole
            subtree, so nothing about it is mounted here. */}
        <FileSystemMarqueeBox controller={marquee} />
        {bgMenuNode}
      </Pressable>
    </View>
  );
}
