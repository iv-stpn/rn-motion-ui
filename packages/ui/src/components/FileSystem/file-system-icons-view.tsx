/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The icons view: a Finder-style tile grid. The web original leans on CSS
// `auto-fill` plus a hand-rolled virtual window; here the measured viewport
// width picks a column count and the entries are pre-chunked into rows so a
// FlatList can window them.

import { useCallback, useMemo, useState } from 'react';
import { FlatList, type LayoutChangeEvent, type ListRenderItemInfo, Pressable, View } from 'react-native';
import { cn } from '../../lib/cn';
import { Text } from '../Text/text';
import type { FileSystemEntry } from './file-system.types';
import { useContextMenu } from './file-system-context-menu';
import { FileSystemFolderGlyph } from './file-system-icons';
import type { FileSystemViewProps } from './file-system-view';
import { FileVisual } from './file-system-visual';
import { useEntryActivation } from './use-entry-activation';

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

/** Stable empty data for the frame before the width is known — see below. */
const NO_ROWS: FileSystemEntry[][] = [];

/**
 * How many `MIN_TILE_WIDTH` tiles fit the measured content box, and the width
 * they share once the gaps are taken out — the RN stand-in for CSS `auto-fill`.
 */
function gridMetrics(width: number): GridMetrics {
  const available = Math.max(0, width - GRID_PADDING * 2);
  const columns = Math.max(1, Math.floor((available + TILE_GAP) / (MIN_TILE_WIDTH + TILE_GAP)));
  return { columns, tileWidth: Math.floor((available - TILE_GAP * (columns - 1)) / columns) };
}

function chunkEntries(entries: FileSystemEntry[], columns: number): FileSystemEntry[][] {
  const rows: FileSystemEntry[][] = [];
  for (let index = 0; index < entries.length; index += columns) rows.push(entries.slice(index, index + columns));
  return rows;
}

type IconTileProps = Pick<
  FileSystemViewProps,
  'getContextMenuActions' | 'loadPreviewImageUrl' | 'onContextMenuAction' | 'pageUrlCache' | 'renderFilePreview'
> & {
  entry: FileSystemEntry;
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry) => void;
  width: number;
};

/** One grid tile: folder glyph or file thumbnail over a two-line name. */
function IconTile({
  entry,
  getContextMenuActions,
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
          className={cn('w-20 shrink-0 items-center justify-center rounded-lg p-1', isSelected && 'bg-surface-selected')}
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

type IconRowProps = Omit<IconTileProps, 'entry' | 'isSelected' | 'width'> & {
  row: FileSystemEntry[];
  selectedPath: string | null;
  tileWidth: number;
};

/**
 * One grid row. Tiles take the measured width rather than `flex-1` so a short
 * trailing row keeps the same column stride as a full one.
 */
function IconRow({ row, selectedPath, tileWidth, ...tileProps }: IconRowProps) {
  return (
    <View className="flex-row gap-1" style={{ marginBottom: ROW_GAP }}>
      {row.map((entry) => (
        <IconTile entry={entry} isSelected={entry.path === selectedPath} key={entry.path} width={tileWidth} {...tileProps} />
      ))}
    </View>
  );
}

export function FileSystemIconsView({
  entries,
  getContextMenuActions,
  loadPreviewImageUrl,
  onContextMenuAction,
  onOpen,
  onSelect,
  pageUrlCache,
  renderFilePreview,
  selectedPath,
}: FileSystemViewProps) {
  const [width, setWidth] = useState(0);
  const activate = useEntryActivation(onOpen, onSelect);
  const handleLayout = useCallback((event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width), []);

  const { columns, tileWidth } = gridMetrics(width);
  // Nothing is chunked until a width lands. Guessing a column count first would
  // mean re-chunking on the very next frame, and since a row is keyed by its
  // first entry every key would change — remounting all but one tile. A press
  // in flight over one of those tiles is then lost: the node is detached before
  // its `click` reaches React, which ignores events on unmounted fibers.
  const rows = useMemo(() => (width > 0 ? chunkEntries(entries, columns) : NO_ROWS), [columns, entries, width]);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemEntry[]>) => (
      <IconRow
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
      getContextMenuActions,
      loadPreviewImageUrl,
      onContextMenuAction,
      pageUrlCache,
      renderFilePreview,
      selectedPath,
      tileWidth,
    ],
  );

  const keyExtractor = useCallback((row: FileSystemEntry[]) => row[0]?.path ?? '', []);
  const getItemLayout = useCallback(
    (_data: ArrayLike<FileSystemEntry[]> | null | undefined, index: number) => ({
      index,
      length: ROW_STRIDE,
      offset: ROW_STRIDE * index,
    }),
    [],
  );

  return (
    <FlatList
      className="flex-1"
      contentContainerClassName="p-3"
      data={rows}
      getItemLayout={getItemLayout}
      keyExtractor={keyExtractor}
      onLayout={handleLayout}
      renderItem={renderRow}
      showsVerticalScrollIndicator={false}
    />
  );
}
