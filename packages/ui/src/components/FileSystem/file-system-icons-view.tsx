/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The icons view: a Finder-style tile grid. The web original leans on CSS
// `auto-fill` plus a hand-rolled virtual window; here the measured viewport
// width picks a column count and the entries are pre-chunked into rows so a
// FlatList can window them.

import { type RefObject, useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
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
import { cn } from '../../lib/cn';
import { Text } from '../Text/text';
import type { FileSystemEntry } from './file-system.types';
import { useContextMenu } from './file-system-context-menu';
import { FileSystemFolderGlyph } from './file-system-icons';
import type { FileSystemViewProps } from './file-system-view';
import { FileVisual } from './file-system-visual';
import { useEntryActivation } from './use-entry-activation';
import { FS_DRAG_CONTAINER_TEST_ID } from './use-file-system-drag';
import { type UseIconsDragReturn, useIconsViewDrag } from './use-file-system-icons-drag';

// Tile geometry (px). Tiles have a fixed height — a glyph box plus a reserved
// two-line label — so every row shares one stride and windowing stays exact.
const GRID_PADDING = 12;
const MIN_TILE_WIDTH = 104;
const TILE_GAP = 4;
const ROW_GAP = 12;
const GLYPH_BOX_HEIGHT = 64;
const TILE_HEIGHT = 102;
const ROW_STRIDE = TILE_HEIGHT + ROW_GAP;
const FOLDER_GLYPH_SIZE = 52;
/** Landscape thumbnails get the wider face so they fill the tile. */
const LANDSCAPE_RATIO = 1.2;
const PORTRAIT_TILE_WIDTH = 48;
const LANDSCAPE_TILE_WIDTH = 76;
const TILE_PREVIEW_RATIO = 0.78;

type GridMetrics = { columns: number; tileWidth: number };

// Web-only style props (userSelect / touchAction are absent from RN's ViewStyle).
type WebViewStyle = ViewStyle & { userSelect?: string; touchAction?: string };
const WEB_BODY_STYLE: WebViewStyle | null = Platform.OS === 'web' ? { userSelect: 'none' } : null;
const WEB_DRAGGING_STYLE: WebViewStyle | null = Platform.OS === 'web' ? { userSelect: 'none', touchAction: 'none' } : null;

/** Stable empty data for the frame before the width is known — see below. */
const NO_ROWS: FileSystemEntry[][] = [];

function gridMetrics(width: number): GridMetrics {
  const available = Math.max(0, width - GRID_PADDING * 2);
  const columns = Math.max(1, Math.floor((available + TILE_GAP) / (MIN_TILE_WIDTH + TILE_GAP)));
  return { columns, tileWidth: Math.floor((available - TILE_GAP * (columns - 1)) / columns) };
}

function chunkEntries(entries: FileSystemEntry[], columns: number): FileSystemEntry[][] {
  const rows: FileSystemEntry[][] = [];
  for (let i = 0; i < entries.length; i += columns) rows.push(entries.slice(i, i + columns));
  return rows;
}

type DragPreviewProps = { label: string; pos: Animated.ValueXY };

function DragPreview({ label, pos }: DragPreviewProps) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{ left: 0, position: 'absolute', top: 0, transform: pos.getTranslateTransform(), zIndex: 4 }}
    >
      <View className="rounded-md border border-border bg-surface-4 px-2 py-1">
        <Text className="text-foreground" numberOfLines={1} size="xs">
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Tile + row ─────────────────────────────────────────────────────────────────

type IconTileProps = Pick<
  FileSystemViewProps,
  'getContextMenuActions' | 'loadPreviewImageUrl' | 'onContextMenuAction' | 'pageUrlCache' | 'renderFilePreview'
> & {
  entry: FileSystemEntry;
  isDropTarget: boolean;
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry) => void;
  width: number;
};

function IconTile({
  entry,
  getContextMenuActions,
  isDropTarget,
  isSelected,
  onActivate,
  onContextMenuAction,
  width,
  ...visualProps
}: IconTileProps) {
  const handlePress = useCallback(() => onActivate(entry), [entry, onActivate]);
  const isLandscape = entry.kind === 'file' && (entry.previewAspectRatio ?? 0) > LANDSCAPE_RATIO;
  const { wrapperRef, onLongPress, contextMenuNode } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);

  return (
    <View ref={wrapperRef} style={{ width }}>
      <Pressable
        accessibilityLabel={entry.name}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        className="items-center gap-1.5"
        onLongPress={onLongPress}
        onPress={handlePress}
        style={{ height: TILE_HEIGHT, width }}
      >
        <View
          className={cn(
            'w-20 shrink-0 items-center justify-center rounded-lg p-1',
            isSelected && 'bg-surface-selected',
            isDropTarget && 'border-2 border-primary',
          )}
          style={{ height: GLYPH_BOX_HEIGHT }}
        >
          {entry.kind === 'folder' ? (
            <FileSystemFolderGlyph size={FOLDER_GLYPH_SIZE} />
          ) : (
            <FileVisual
              file={entry}
              previewAspectRatio={TILE_PREVIEW_RATIO}
              width={isLandscape ? LANDSCAPE_TILE_WIDTH : PORTRAIT_TILE_WIDTH}
              {...visualProps}
            />
          )}
        </View>
        <View className={cn('max-w-full rounded-sm px-1.5 py-px', isSelected && 'bg-primary')}>
          <Text
            className={cn('text-center leading-tight', isSelected ? 'text-primary-foreground' : 'text-foreground')}
            numberOfLines={2}
            size="xs"
          >
            {entry.name}
          </Text>
        </View>
        {contextMenuNode}
      </Pressable>
    </View>
  );
}

type IconRowProps = Omit<IconTileProps, 'entry' | 'isDropTarget' | 'isSelected' | 'width'> & {
  dragTargetPath: string | null;
  row: FileSystemEntry[];
  selectedPath: string | null;
  tileWidth: number;
};

function IconRow({ dragTargetPath, row, selectedPath, tileWidth, ...tileProps }: IconRowProps) {
  return (
    <View className="flex-row gap-1" style={{ marginBottom: ROW_GAP }}>
      {row.map((entry) => (
        <IconTile
          entry={entry}
          isDropTarget={entry.path === dragTargetPath}
          isSelected={entry.path === selectedPath}
          key={entry.path}
          width={tileWidth}
          {...tileProps}
        />
      ))}
    </View>
  );
}

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
  onLayout: (event: LayoutChangeEvent) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  rows: FileSystemEntry[][];
  tileWidth: number;
};

/**
 * Measures the grid, chunks the entries into rows, and opens the drag session.
 * The column count and tile width live in refs as well as in the render output:
 * the session's index resolver reads them on every pointer move, and refs keep
 * a resize from tearing down the session mid-drag.
 */
function useIconsGrid(entries: FileSystemEntry[], draggable: boolean, onMove: FileSystemViewProps['onMove']): IconsGrid {
  const [width, setWidth] = useState(0);
  const flatListRef = useRef<FlatList | null>(null);
  const containerRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
  const containerHeightRef = useRef(0);
  const columnsRef = useRef(1);
  const tileWidthRef = useRef(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
    containerHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
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

  return { ...dragSession, containerRef, flatListRef, onLayout, onScroll, rows, tileWidth };
}

// ── View ───────────────────────────────────────────────────────────────────────

export function FileSystemIconsView({
  draggable = false,
  entries,
  getContextMenuActions,
  loadPreviewImageUrl,
  onContextMenuAction,
  onMove,
  onOpen,
  onSelect,
  pageUrlCache,
  renderFilePreview,
  selectedPath,
}: FileSystemViewProps) {
  const activate = useEntryActivation(onOpen, onSelect);
  const { containerRef, drag, dragTargetPath, flatListRef, nativeGesture, onLayout, onScroll, previewPos, rows, tileWidth } =
    useIconsGrid(entries, draggable, onMove);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemEntry[]>) => (
      <IconRow
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
      <View
        ref={containerRef}
        className="relative min-h-0 flex-1"
        style={drag.active ? WEB_DRAGGING_STYLE : WEB_BODY_STYLE}
        testID={FS_DRAG_CONTAINER_TEST_ID.icons}
      >
        {body}
        {drag.active ? <DragPreview label={drag.previewLabel} pos={previewPos} /> : null}
      </View>
    </View>
  );
}
