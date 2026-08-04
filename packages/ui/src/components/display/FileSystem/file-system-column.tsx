/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the column pane, its drag session and its overlay parts are one render layer */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: geometry constants and hit-test helpers are exported alongside the column they size */
// One pane of the columns view: a fixed-width, vertically scrolling list of a
// single folder's children. Memoized on scalar selection props so pressing
// into a deep trail only re-renders the columns whose rows actually change.

import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, ListRenderItemInfo, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { FlatList, Image, Pressable, View } from 'react-native';
import { HeartLine as Heart } from 'rn-motion-ui-icons/icons/heart-line';
import { PinLine as Pin } from 'rn-motion-ui-icons/icons/pin-line';
import { RightLine as ChevronRight } from 'rn-motion-ui-icons/icons/right-line';
import { cn } from '../../../lib/cn';
import { useThemeColors } from '../../../theme/use-theme-color';
import { HoldContextMenu } from '../../menus/HoldContextMenu/hold-context-menu';
import { Text } from '../../typography/Text/text';
import type {
  FileSystemContextMenuAction,
  FileSystemEntry,
  FileSystemExternalDropEvent,
  FileSystemIndex,
  FileSystemItem,
} from './file-system.types';
import { useContextMenu } from './file-system-context-menu';
import {
  FileSystemHoverHighlight,
  FileSystemSourceHighlight,
  FS_HOVER_TEST_ID,
  useFileSystemRowHover,
} from './file-system-hover';
import { FileSystemFolderGlyph, FileTypeIcon } from './file-system-icons';
import { filePreviewUrls, folderHasChildren } from './file-system-index';
import { FileSystemMarqueeBox, type FileSystemMarqueeRect, useFileSystemMarquee, useMarqueeGate } from './file-system-marquee';
import type { FileSystemSelectionMode } from './file-system-selection';
import { fileSystemEntryTestID } from './file-system-test-id';
import { FileSystemEmptyState } from './file-system-view';
import { useEntryLongPress } from './use-entry-activation';
import { FS_DRAG_CONTAINER_TEST_ID } from './use-file-system-drag';
import { useFileSystemExternalDrop } from './use-file-system-external-drop';

const LOADING_LABEL = 'Loading…';

/** Column geometry (px). Rows are uniform so `getItemLayout` stays exact. */
export const COLUMN_WIDTH = 240;
export const COLUMN_ROW_HEIGHT = 28;
const COLUMN_ROW_GAP = 1;

export const COLUMN_ROW_STRIDE = COLUMN_ROW_HEIGHT + COLUMN_ROW_GAP;
const COLUMN_GLYPH_SIZE = 18;
const COLUMN_ICON_SIZE = 16;
const COLUMN_CHEVRON_SIZE = 14;
const COLUMN_PIN_ICON_SIZE = 10;
const COLUMN_FAV_ICON_SIZE = 10;

/** Top/bottom padding inside the FlatList's content container (p-1.5 = 6 px). */
export const COLUMN_PADDING = 6;

/** Container-local point → row index, or null for padding / gap / past-last-row. */
export function columnRowHitAt(_localX: number, localY: number, scrollOffset: number, rowCount: number): number | null {
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

/** Container-local top-left of a row, or `null` for no row. */
function columnRowOrigin(index: number | null, scrollOffset: number) {
  if (index === null) return null;
  return { x: 0, y: index * COLUMN_ROW_STRIDE + COLUMN_PADDING - scrollOffset };
}

type ColumnDropHighlightProps = { targetIndex: number | null; scrollOffset: number };

/** Border outline over the row currently under the pointer (drop feedback). */
function ColumnDropHighlight({ targetIndex, scrollOffset }: ColumnDropHighlightProps) {
  if (targetIndex === null) return null;
  return (
    <View
      className="pointer-events-none absolute right-0 left-0 z-[3] rounded-md border border-primary"
      style={{ height: COLUMN_ROW_HEIGHT, top: targetIndex * COLUMN_ROW_STRIDE + COLUMN_PADDING - scrollOffset }}
    />
  );
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
  renderEntryIcon?: (entry: FileSystemEntry, size: number) => ReactNode | null | undefined;
  /** Already resolved for this entry by the column — see `fileSystemEntryTestID`. */
  testID?: string;
};

/** The row's leading glyph: folder, cover thumbnail, or file-type icon. */
function ColumnRowGlyph({
  entry,
  isSelected,
  renderEntryIcon,
}: Pick<ColumnRowProps, 'entry' | 'isSelected' | 'renderEntryIcon'>) {
  if (entry.kind === 'folder')
    return renderEntryIcon?.(entry, COLUMN_GLYPH_SIZE) ?? <FileSystemFolderGlyph size={COLUMN_GLYPH_SIZE} />;

  const coverUrl = filePreviewUrls(entry)[0];
  if (coverUrl)
    return (
      renderEntryIcon?.(entry, COLUMN_ICON_SIZE) ?? (
        <Image
          className="shrink-0 rounded-[3px] bg-white"
          resizeMode="cover"
          source={{ uri: coverUrl }}
          style={{ height: COLUMN_ICON_SIZE, width: COLUMN_ICON_SIZE }}
        />
      )
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
  renderEntryIcon,
  testID,
}: ColumnRowProps) {
  const colors = useThemeColors();
  const handlePress = useCallback((event: GestureResponderEvent) => onActivate(entry, event), [entry, onActivate]);
  const hasChildren = entry.kind === 'folder' && folderHasChildren(index, entry);

  const { menuProps, onLongPress: openContextMenu } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);
  const onLongPress = useEntryLongPress(entry, onSelectLongPress, openContextMenu);

  return (
    <HoldContextMenu {...menuProps} style={{ marginBottom: COLUMN_ROW_GAP }}>
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
        <ColumnRowGlyph entry={entry} isSelected={isSelected} renderEntryIcon={renderEntryIcon} />
        {entry.pinnedAt ? <Pin color={isSelected ? colors.white : colors.primary} size={COLUMN_PIN_ICON_SIZE} /> : null}
        <Text className={cn('flex-1', isSelected && 'text-white')} numberOfLines={1} size="sm">
          {entry.name}
        </Text>
        {entry.favoritedAt ? <Heart color={isSelected ? colors.white : colors.danger} size={COLUMN_FAV_ICON_SIZE} /> : null}
        {hasChildren ? (
          <ChevronRight color={isSelected ? colors.white : colors['muted-foreground']} size={COLUMN_CHEVRON_SIZE} />
        ) : null}
      </Pressable>
    </HoldContextMenu>
  );
}

/**
 * Drag state passed from the columns view for any active cross-column drag that
 * touches this pane. `null` means the drag is active but this pane is not involved.
 */
export type ColumnDragState =
  | { kind: 'source'; rowIndex: number }
  | { kind: 'row-target'; rowIndex: number }
  | { kind: 'column-target' }
  | null;

export type FileSystemColumnProps = {
  entries: FileSystemEntry[];
  /** Drag render state for any active cross-column drag that touches this pane. */
  dragState?: ColumnDragState;
  /** Path of the folder this column displays — used to scope external drop to this pane. */
  folderPath: string;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  index: FileSystemIndex;
  isLoading: boolean;
  /** Takes this pane's ordering as its third argument — see `orderedPaths` below. */
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent, orderedPaths?: readonly string[]) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  /** Called when an external item (OS file, drag chip) is dropped onto this column. */
  onExternalDrop?: (event: FileSystemExternalDropEvent) => void;
  onMarquee: (covered: readonly string[], base: ReadonlySet<string> | null) => void;
  onSelectLongPress?: (entry: FileSystemEntry) => void;
  /**
   * Called from the column's onScroll so the parent can track the vertical scroll
   * offset for drop-target resolution.
   */
  onScrollOffsetChange?: (offset: number) => void;
  renderEntryIcon?: (entry: FileSystemEntry, size: number) => ReactNode | null | undefined;
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

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: hover, marquee, and row layout are tightly coupled around shared refs — splitting would scatter interdependent state
function FileSystemColumnImpl({
  dragState,
  entries,
  folderPath,
  getContextMenuActions,
  index,
  isLoading,
  onActivate,
  onContextMenuAction,
  onExternalDrop,
  onMarquee,
  onSelectLongPress,
  onScrollOffsetChange,
  renderEntryIcon,
  selectedPaths,
  selectionMode,
  testID,
  trailChildPath,
}: FileSystemColumnProps) {
  // Each pane is its own ordering: a Shift-range runs through the column the
  // Each pane is its own ordering: a Shift-range runs through the column the
  // press landed in, never across the trail into a sibling folder's contents.
  const orderedPaths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const activate = useCallback(
    (entry: FileSystemEntry, event?: GestureResponderEvent) => onActivate(entry, event, orderedPaths),
    [onActivate, orderedPaths],
  );

  const containerRef = useRef<View | null>(null);
  const flatListRef = useRef<FlatList<FileSystemEntry> | null>(null);
  const scrollOffsetRef = useRef(0);
  const rowCountRef = useRef(0);
  rowCountRef.current = entries.length;
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  // Scroll offset as render state — only tracked when this pane participates in
  // a cross-column drag (dragState defined), so overlays re-position as the list
  // scrolls under a held drag.
  const [scrollOffset, setScrollOffset] = useState(0);

  // Feed hover from the drag state rather than a session: the columns drag lives
  // at the view level, so the column receives its resolved target as a prop.
  const getTargetIndex = useCallback(() => (dragState?.kind === 'row-target' ? dragState.rowIndex : null), [dragState]);
  const isDragging = useCallback(() => dragState !== null, [dragState]);

  const hover = useFileSystemRowHover({
    containerRef,
    count: entries.length,
    getTargetIndex,
    isDragging,
    offsetTop: COLUMN_PADDING,
    scrollOffsetRef,
    stride: COLUMN_ROW_STRIDE,
  });

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
      const offset = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = offset;
      hover.refresh();
      marquee.refresh();
      onScrollOffsetChange?.(offset);
      // Track scroll state when this pane participates in drag so overlays stay
      // in sync as the list scrolls beneath a held drag.
      if (dragState !== undefined) setScrollOffset(offset);
    },
    [dragState, hover, marquee, onScrollOffsetChange],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedPaths is the trigger; not read in the body but must be in the deps to re-fire on selection change
  // biome-ignore lint/plugin: re-resolve is a side-effect on an Animated value, not render state
  useEffect(() => {
    hover.refresh();
    marquee.refresh();
  }, [hover, marquee, selectedPaths]);

  // Sync scroll state when a drag starts so overlays are positioned correctly
  // even if the list was already scrolled before the drag began.
  // biome-ignore lint/plugin: re-resolve scroll state on drag start is a side-effect on a ref, not render state
  useEffect(() => {
    if (dragState !== null && dragState !== undefined) setScrollOffset(scrollOffsetRef.current);
  }, [dragState]);

  // External (OS / page element) drag-and-drop — one row target per folder row,
  // falling back to the whole column when hovering over a file or padding.
  const externalDropRows = useMemo(
    () => entries.map((entry) => ({ entry, isExpandable: entry.kind === 'folder', isExpanded: false, level: 0 })),
    [entries],
  );
  const { isOver: isExternalDropOver, targetIndex: externalTargetIndex } = useFileSystemExternalDrop({
    containerRef,
    contentOffsetTop: COLUMN_PADDING,
    currentPath: folderPath,
    onExternalDrop,
    rowHeight: COLUMN_ROW_STRIDE,
    rows: externalDropRows,
    scrollOffsetRef,
  });

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
        renderEntryIcon={renderEntryIcon}
        testID={fileSystemEntryTestID(testID, item.path)}
      />
    ),
    [
      activate,
      getContextMenuActions,
      index,
      onContextMenuAction,
      onSelectLongPress,
      renderEntryIcon,
      selectedPaths,
      testID,
      trailChildPath,
    ],
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

  const sourceRowIndex = dragState?.kind === 'source' ? dragState.rowIndex : null;

  return (
    <Pressable
      ref={containerRef}
      className="shrink-0 select-none border-border border-r"
      style={{ width: COLUMN_WIDTH }}
      testID={FS_DRAG_CONTAINER_TEST_ID.column}
    >
      {/* Overlay ring for column-level drop target — absolutely positioned so it
          never adds to the column's width or shifts the list content. */}
      {dragState?.kind === 'column-target' ? (
        <View className="pointer-events-none absolute inset-0 z-[3] rounded-lg border-2 border-primary" />
      ) : null}
      {isLoading && entries.length === 0 ? (
        <FileSystemEmptyState isLoading={true} label={LOADING_LABEL} />
      ) : (
        <View className="relative flex-1">
          {/* Both before the list, so they paint behind the rows — see FileSystemHoverHighlight. */}
          <FileSystemHoverHighlight controller={hover} height={COLUMN_ROW_HEIGHT} testID={FS_HOVER_TEST_ID.columns} />
          <FileSystemSourceHighlight height={COLUMN_ROW_HEIGHT} origin={columnRowOrigin(sourceRowIndex, scrollOffset)} />
          <FlatList
            ref={flatListRef}
            contentContainerClassName="p-1.5"
            data={entries}
            getItemLayout={getItemLayout}
            keyExtractor={keyExtractor}
            onScroll={onScroll}
            renderItem={renderRow}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          />
          {dragState?.kind === 'row-target' ? (
            <ColumnDropHighlight scrollOffset={scrollOffset} targetIndex={dragState.rowIndex} />
          ) : null}
          {isExternalDropOver && externalTargetIndex === null ? (
            <View className="pointer-events-none absolute inset-0 border border-foreground/20 border-dashed bg-foreground/[0.03]" />
          ) : null}
          {isExternalDropOver && externalTargetIndex !== null ? (
            <ColumnDropHighlight scrollOffset={scrollOffset} targetIndex={externalTargetIndex} />
          ) : null}
          <FileSystemMarqueeBox controller={marquee} />
        </View>
      )}
    </Pressable>
  );
}

export const FileSystemColumn = memo(FileSystemColumnImpl);
