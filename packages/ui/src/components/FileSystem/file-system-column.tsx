/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// One pane of the columns view: a fixed-width, vertically scrolling list of a
// single folder's children. Memoized on scalar selection props so pressing
// into a deep trail only re-renders the columns whose rows actually change.

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  type GestureResponderEvent,
  Image,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  View,
} from 'react-native';
import { cn } from '../../lib/cn';
import { ChevronRight } from '../../lib/icons';
import { useThemeColors } from '../../theme/use-theme-color';
import { Text } from '../Text/text';
import type { FileSystemContextMenuAction, FileSystemEntry, FileSystemIndex, FileSystemItem } from './file-system.types';
import { useContextMenu } from './file-system-context-menu';
import { FileSystemFolderGlyph, FileTypeIcon } from './file-system-icons';
import { filePreviewUrls, folderHasChildren } from './file-system-index';
import { FileSystemMarqueeBox, type FileSystemMarqueeRect, useFileSystemMarquee, useMarqueeGate } from './file-system-marquee';
import type { FileSystemSelectionMode } from './file-system-selection';
import { fileSystemEntryTestID } from './file-system-test-id';
import { FileSystemEmptyState } from './file-system-view';
import { useEntryLongPress } from './use-entry-activation';

const LOADING_LABEL = 'Loading…';

/** Column geometry (px). Rows are uniform so `getItemLayout` stays exact. */
// biome-ignore lint/style/useComponentExportOnlyModules: the width belongs with the column it sizes — the view reads it to lay out the preview pane beside one column
export const COLUMN_WIDTH = 240;
const COLUMN_ROW_HEIGHT = 28;
const COLUMN_ROW_GAP = 1;
const COLUMN_ROW_STRIDE = COLUMN_ROW_HEIGHT + COLUMN_ROW_GAP;
const COLUMN_GLYPH_SIZE = 18;
const COLUMN_ICON_SIZE = 16;
const COLUMN_CHEVRON_SIZE = 14;
/** Top/bottom padding inside the FlatList's content container (p-1.5 = 6 px). */
const COLUMN_PADDING = 6;

/** Container-local point → row index, or null for padding / gap / past-last-row. */
function columnRowHitAt(_localX: number, localY: number, scrollOffset: number, rowCount: number): number | null {
  const contentY = localY + scrollOffset - COLUMN_PADDING;
  if (contentY < 0) return null;
  const rowIndex = Math.floor(contentY / COLUMN_ROW_STRIDE);
  if (rowIndex >= rowCount) return null;
  const intraRow = contentY - rowIndex * COLUMN_ROW_STRIDE;
  if (intraRow >= COLUMN_ROW_HEIGHT) return null; // inside the gap
  return rowIndex;
}

/** Content-frame rect → paths of every row it overlaps. */
function columnRowsInRect(rect: FileSystemMarqueeRect, entries: FileSystemEntry[]): readonly string[] {
  const top = rect.y - COLUMN_PADDING;
  const bottom = rect.y + rect.height - COLUMN_PADDING;
  const result: string[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const rowTop = i * COLUMN_ROW_STRIDE;
    if (rowTop >= bottom) break;
    if (rowTop + COLUMN_ROW_HEIGHT > top) {
      const entry = entries[i];
      if (entry) result.push(entry.path);
    }
  }
  return result;
}

type ColumnRowProps = {
  entry: FileSystemEntry;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  index: FileSystemIndex;
  isOnTrail: boolean;
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  /** Long-press toggles this row's selection; `undefined` leaves the gesture to the context menu. */
  onSelectLongPress?: (entry: FileSystemEntry) => void;
  /** Already resolved for this entry by the column — see `fileSystemEntryTestID`. */
  testID?: string;
};

/** The row's leading glyph: folder, cover thumbnail, or file-type icon. */
function ColumnRowGlyph({ entry, isSelected }: Pick<ColumnRowProps, 'entry' | 'isSelected'>) {
  if (entry.kind === 'folder') return <FileSystemFolderGlyph size={COLUMN_GLYPH_SIZE} />;

  const coverUrl = filePreviewUrls(entry)[0];
  if (coverUrl)
    return (
      <Image
        className="shrink-0 rounded-[3px] bg-white"
        resizeMode="cover"
        source={{ uri: coverUrl }}
        style={{ height: COLUMN_ICON_SIZE, width: COLUMN_ICON_SIZE }}
      />
    );

  // A selected row sits on the primary surface, the inverse of the pane behind
  // it, so the icon palette flips with it.
  return <FileTypeIcon fileName={entry.name} size={COLUMN_ICON_SIZE} surface={isSelected ? 'inverted' : 'theme'} />;
}

function ColumnRow({
  entry,
  getContextMenuActions,
  index,
  isOnTrail,
  isSelected,
  onActivate,
  onContextMenuAction,
  onSelectLongPress,
  testID,
}: ColumnRowProps) {
  const colors = useThemeColors();
  const handlePress = useCallback((event: GestureResponderEvent) => onActivate(entry, event), [entry, onActivate]);
  const hasChildren = entry.kind === 'folder' && folderHasChildren(index, entry);

  const {
    wrapperRef,
    onLongPress: openContextMenu,
    contextMenuNode,
  } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);
  const onLongPress = useEntryLongPress(entry, onSelectLongPress, openContextMenu);

  return (
    <View ref={wrapperRef} style={{ marginBottom: COLUMN_ROW_GAP }}>
      <Pressable
        accessibilityLabel={entry.name}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        // See ListRow: native reads the state, web reads the ARIA attribute.
        aria-selected={isSelected}
        className={cn(
          'flex-row items-center gap-2 rounded-md px-2',
          isSelected && 'bg-info',
          !isSelected && isOnTrail && 'bg-surface-selected',
          !(isSelected || isOnTrail) && 'hover:bg-surface-hover',
        )}
        onLongPress={onLongPress}
        onPress={handlePress}
        style={{ height: COLUMN_ROW_HEIGHT }}
        testID={testID}
      >
        <ColumnRowGlyph entry={entry} isSelected={isSelected} />
        <Text className={cn('flex-1', isSelected && 'text-white')} numberOfLines={1} size="sm">
          {entry.name}
        </Text>
        {hasChildren ? (
          <ChevronRight color={isSelected ? colors.white : colors['muted-foreground']} size={COLUMN_CHEVRON_SIZE} />
        ) : null}
        {contextMenuNode}
      </Pressable>
    </View>
  );
}

export type FileSystemColumnProps = {
  entries: FileSystemEntry[];
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  index: FileSystemIndex;
  isLoading: boolean;
  /** Takes this pane's ordering as its third argument — see `orderedPaths` below. */
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent, orderedPaths?: readonly string[]) => void;
  /** Called when the user presses empty space in the column — clears the selection. */
  onClearSelection?: () => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onMarquee: (covered: readonly string[], base: ReadonlySet<string> | null) => void;
  onSelectLongPress?: (entry: FileSystemEntry) => void;
  /**
   * The whole selection, not this pane's share of it: a multi-selection can span
   * panes, so there is no per-column scalar that would say enough. Its identity
   * is stable while the selection holds, which is what keeps the memo below
   * worth having.
   */
  selectedPaths: ReadonlySet<string>;
  selectionMode: FileSystemSelectionMode;
  /** The child folder the trail continues through, highlighted as the path. */
  trailChildPath: string | null;
  /** The browser's root `testID`; each row derives its own from it. */
  testID?: string;
};

function FileSystemColumnImpl({
  entries,
  getContextMenuActions,
  index,
  isLoading,
  onActivate,
  onClearSelection,
  onContextMenuAction,
  onMarquee,
  onSelectLongPress,
  selectedPaths,
  selectionMode,
  testID,
  trailChildPath,
}: FileSystemColumnProps) {
  // Each pane is its own ordering: a Shift-range runs through the column the
  // press landed in, never across the trail into a sibling folder's contents.
  const orderedPaths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const activate = useCallback(
    (entry: FileSystemEntry, event?: GestureResponderEvent) => onActivate(entry, event, orderedPaths),
    [onActivate, orderedPaths],
  );

  const containerRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
  const rowCountRef = useRef(0);
  rowCountRef.current = entries.length;
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const hitTest = useCallback(
    (localX: number, localY: number) => columnRowHitAt(localX, localY, scrollOffsetRef.current, rowCountRef.current),
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
    resolve: useCallback((rect: FileSystemMarqueeRect) => columnRowsInRect(rect, entriesRef.current), []),
  });

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      marquee.refresh();
    },
    [marquee],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedPaths is the trigger; not read in the body but must be in the deps to re-fire on selection change
  // biome-ignore lint/plugin: re-resolve is a side-effect on an Animated value, not render state
  useEffect(() => {
    marquee.refresh();
  }, [marquee, selectedPaths]);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemEntry>) => (
      <ColumnRow
        entry={item}
        getContextMenuActions={getContextMenuActions}
        index={index}
        isOnTrail={item.kind === 'folder' && item.path === trailChildPath}
        isSelected={selectedPaths.has(item.path)}
        onActivate={activate}
        onContextMenuAction={onContextMenuAction}
        onSelectLongPress={onSelectLongPress}
        testID={fileSystemEntryTestID(testID, item.path)}
      />
    ),
    [activate, getContextMenuActions, index, onContextMenuAction, onSelectLongPress, selectedPaths, testID, trailChildPath],
  );

  const keyExtractor = useCallback((entry: FileSystemEntry) => entry.path, []);
  const getItemLayout = useCallback(
    (_data: ArrayLike<FileSystemEntry> | null | undefined, itemIndex: number) => ({
      index: itemIndex,
      length: COLUMN_ROW_STRIDE,
      offset: COLUMN_ROW_STRIDE * itemIndex,
    }),
    [],
  );

  return (
    <Pressable className="shrink-0 select-none border-border border-r" onPress={onClearSelection} style={{ width: COLUMN_WIDTH }}>
      {isLoading && entries.length === 0 ? (
        <FileSystemEmptyState isLoading={true} label={LOADING_LABEL} />
      ) : (
        <View ref={containerRef} className="relative flex-1">
          <FlatList
            contentContainerClassName="p-1.5"
            data={entries}
            getItemLayout={getItemLayout}
            keyExtractor={keyExtractor}
            onScroll={onScroll}
            renderItem={renderRow}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          />
          <FileSystemMarqueeBox controller={marquee} />
        </View>
      )}
    </Pressable>
  );
}

export const FileSystemColumn = React.memo(FileSystemColumnImpl);
