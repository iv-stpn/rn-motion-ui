/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The gallery's filmstrip: one small tile per entry, scrolling horizontally
// under the stage. The active tile is kept in view as the selection moves,
// including when it arrives from another view.

import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  type GestureResponderEvent,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  View,
} from 'react-native';
import { cn } from '../../lib/cn';
import type { FileSystemContextMenuAction, FileSystemEntry, FileSystemFileItem, FileSystemItem } from './file-system.types';
import { useContextMenu } from './file-system-context-menu';
import { FileSystemFolderGlyph } from './file-system-icons';
import { FileSystemMarqueeBox, type FileSystemMarqueeRect, useFileSystemMarquee, useMarqueeGate } from './file-system-marquee';
import type { FileSystemSelectionMode } from './file-system-selection';
import { fileSystemEntryTestID } from './file-system-test-id';
import { FileVisual } from './file-system-visual';
import { useEntryLongPress } from './use-entry-activation';

/** Filmstrip geometry (px). Uniform tiles keep `getItemLayout` exact. */
const STRIP_TILE_SIZE = 56;
const STRIP_TILE_GAP = 6;
const STRIP_TILE_STRIDE = STRIP_TILE_SIZE + STRIP_TILE_GAP;
const STRIP_FOLDER_GLYPH_SIZE = 36;
const STRIP_THUMBNAIL_WIDTH = 34;
const STRIP_ASPECT_RATIO = 0.78;
/** Left/right padding inside the FlatList's content container (p-2 = 8 px). */
const STRIP_PADDING = 8;

/** Container-local point → tile index, or null for padding / gap / past-last-tile. */
function stripTileHitAt(localX: number, _localY: number, scrollOffset: number, tileCount: number): number | null {
  const contentX = localX + scrollOffset - STRIP_PADDING;
  if (contentX < 0) return null;
  const tileIndex = Math.floor(contentX / STRIP_TILE_STRIDE);
  if (tileIndex >= tileCount) return null;
  const intraX = contentX - tileIndex * STRIP_TILE_STRIDE;
  if (intraX >= STRIP_TILE_SIZE) return null; // inside the gap
  return tileIndex;
}

/** Content-frame rect → paths of every tile it overlaps (horizontal). */
function stripTilesInRect(rect: FileSystemMarqueeRect, entries: FileSystemEntry[]): readonly string[] {
  const left = rect.x - STRIP_PADDING;
  const right = rect.x + rect.width - STRIP_PADDING;
  const result: string[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const tileLeft = i * STRIP_TILE_STRIDE;
    if (tileLeft >= right) break;
    if (tileLeft + STRIP_TILE_SIZE > left) {
      const entry = entries[i];
      if (entry) result.push(entry.path);
    }
  }
  return result;
}

type StripTileProps = {
  entry: FileSystemEntry;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  /** This tile is the one on the stage. Always also selected, bar the fallback to entry 0. */
  isActive: boolean;
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  /** Long-press toggles this tile's selection; `undefined` leaves the gesture to the context menu. */
  onSelectLongPress?: (entry: FileSystemEntry) => void;
  renderFilePreview?: (file: FileSystemFileItem) => ReactNode;
  /** Already resolved for this entry by the strip — see `fileSystemEntryTestID`. */
  testID?: string;
};

function StripTile({
  entry,
  getContextMenuActions,
  isActive,
  isSelected,
  onActivate,
  onContextMenuAction,
  onSelectLongPress,
  renderFilePreview,
  testID,
}: StripTileProps) {
  const handlePress = useCallback((event: GestureResponderEvent) => onActivate(entry, event), [entry, onActivate]);
  const {
    wrapperRef,
    onLongPress: openContextMenu,
    contextMenuNode,
  } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);
  const onLongPress = useEntryLongPress(entry, onSelectLongPress, openContextMenu);

  return (
    <View ref={wrapperRef} style={{ marginRight: STRIP_TILE_GAP }}>
      <Pressable
        accessibilityLabel={entry.name}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected || isActive }}
        // See ListRow: native reads the state, web reads the ARIA attribute.
        aria-selected={isSelected || isActive}
        // The fill marks membership of the selection; the border marks which
        // member the stage is showing, so a multi-selection reads as several
        // filled tiles with one outlined.
        className={cn(
          'items-center justify-center rounded-md border border-transparent p-1',
          (isActive || isSelected) && 'bg-surface-selected',
          isActive && 'border-border',
        )}
        onLongPress={onLongPress}
        onPress={handlePress}
        style={{ height: STRIP_TILE_SIZE, width: STRIP_TILE_SIZE }}
        testID={testID}
      >
        {entry.kind === 'folder' ? (
          <FileSystemFolderGlyph size={STRIP_FOLDER_GLYPH_SIZE} />
        ) : (
          <FileVisual
            file={entry}
            previewAspectRatio={STRIP_ASPECT_RATIO}
            renderFilePreview={renderFilePreview}
            width={STRIP_THUMBNAIL_WIDTH}
          />
        )}
        {contextMenuNode}
      </Pressable>
    </View>
  );
}

export type FileSystemGalleryStripProps = {
  activePath: string | null;
  entries: FileSystemEntry[];
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  /** Called when the user presses empty space in the strip — clears the selection. */
  onClearSelection?: () => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onMarquee: (covered: readonly string[], base: ReadonlySet<string> | null) => void;
  onSelectLongPress?: (entry: FileSystemEntry) => void;
  renderFilePreview?: (file: FileSystemFileItem) => ReactNode;
  selectedPaths: ReadonlySet<string>;
  selectionMode: FileSystemSelectionMode;
  /** The browser's root `testID`; each tile derives its own from it. */
  testID?: string;
};

export function FileSystemGalleryStrip({
  activePath,
  entries,
  getContextMenuActions,
  onActivate,
  onClearSelection,
  onContextMenuAction,
  onMarquee,
  onSelectLongPress,
  renderFilePreview,
  selectedPaths,
  selectionMode,
  testID,
}: FileSystemGalleryStripProps) {
  const listRef = useRef<FlatList<FileSystemEntry>>(null);
  const containerRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
  const tileCountRef = useRef(0);
  tileCountRef.current = entries.length;
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const hitTest = useCallback(
    (localX: number, localY: number) => stripTileHitAt(localX, localY, scrollOffsetRef.current, tileCountRef.current),
    [],
  );
  const { canStartMarqueeAt } = useMarqueeGate(hitTest);

  const marquee = useFileSystemMarquee({
    canStartAt: canStartMarqueeAt,
    containerRef,
    enabled: selectionMode === 'multiple',
    getScrollOffset: useCallback(() => scrollOffsetRef.current, []),
    getSelectedPaths: useCallback(() => selectedPaths, [selectedPaths]),
    horizontal: true,
    onMarquee,
    resolve: useCallback((rect: FileSystemMarqueeRect) => stripTilesInRect(rect, entriesRef.current), []),
  });

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.x;
      marquee.refresh();
    },
    [marquee],
  );

  // The strip follows the selection rather than driving it, so a file picked in
  // another view (or stepped past with the keyboard on web) scrolls into view.
  // biome-ignore lint/plugin: scrolling an imperative list handle to the active tile is an effect on a ref, not derivable state
  useEffect(() => {
    if (!activePath) return;
    const index = entries.findIndex((entry) => entry.path === activePath);
    if (index >= 0) listRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0.5 });
  }, [activePath, entries]);

  const renderTile = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemEntry>) => (
      <StripTile
        entry={item}
        getContextMenuActions={getContextMenuActions}
        isActive={item.path === activePath}
        isSelected={selectedPaths.has(item.path)}
        onActivate={onActivate}
        onContextMenuAction={onContextMenuAction}
        onSelectLongPress={onSelectLongPress}
        renderFilePreview={renderFilePreview}
        testID={fileSystemEntryTestID(testID, item.path)}
      />
    ),
    [
      activePath,
      getContextMenuActions,
      onActivate,
      onContextMenuAction,
      onSelectLongPress,
      renderFilePreview,
      selectedPaths,
      testID,
    ],
  );

  const keyExtractor = useCallback((entry: FileSystemEntry) => entry.path, []);
  const getItemLayout = useCallback(
    (_data: ArrayLike<FileSystemEntry> | null | undefined, index: number) => ({
      index,
      length: STRIP_TILE_STRIDE,
      offset: STRIP_TILE_STRIDE * index,
    }),
    [],
  );

  return (
    <Pressable
      ref={containerRef}
      className="relative shrink-0 select-none border-border border-t bg-surface-2"
      onPress={onClearSelection}
    >
      <FlatList
        contentContainerClassName="p-2"
        data={entries}
        getItemLayout={getItemLayout}
        horizontal={true}
        keyExtractor={keyExtractor}
        onScroll={onScroll}
        ref={listRef}
        renderItem={renderTile}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
      />
      <FileSystemMarqueeBox controller={marquee} />
    </Pressable>
  );
}
