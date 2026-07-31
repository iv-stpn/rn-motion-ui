/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The gallery's filmstrip: one small tile per entry, scrolling horizontally
// under the stage. The active tile is kept in view as the selection moves,
// including when it arrives from another view.

import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { FlatList, type GestureResponderEvent, type ListRenderItemInfo, Pressable, View } from 'react-native';
import { cn } from '../../lib/cn';
import type { FileSystemContextMenuAction, FileSystemEntry, FileSystemFileItem, FileSystemItem } from './file-system.types';
import { useContextMenu } from './file-system-context-menu';
import { FileSystemFolderGlyph } from './file-system-icons';
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
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onSelectLongPress?: (entry: FileSystemEntry) => void;
  renderFilePreview?: (file: FileSystemFileItem) => ReactNode;
  selectedPaths: ReadonlySet<string>;
  /** The browser's root `testID`; each tile derives its own from it. */
  testID?: string;
};

export function FileSystemGalleryStrip({
  activePath,
  entries,
  getContextMenuActions,
  onActivate,
  onContextMenuAction,
  onSelectLongPress,
  renderFilePreview,
  selectedPaths,
  testID,
}: FileSystemGalleryStripProps) {
  const listRef = useRef<FlatList<FileSystemEntry>>(null);

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
    <FlatList
      className="shrink-0 border-border border-t bg-surface-2"
      contentContainerClassName="p-2"
      data={entries}
      getItemLayout={getItemLayout}
      horizontal={true}
      keyExtractor={keyExtractor}
      ref={listRef}
      renderItem={renderTile}
      showsHorizontalScrollIndicator={false}
    />
  );
}
