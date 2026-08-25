/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the column pane, its drag session and its overlay parts are one render layer */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: geometry constants and hit-test helpers are exported alongside the column they size */
// One pane of the columns view: a fixed-width, vertically scrolling list of a
// single folder's children. Memoized on scalar selection props so pressing
// into a deep trail only re-renders the columns whose rows actually change.

import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import type { GestureResponderEvent, ListRenderItemInfo, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { FlatList, Image, Pressable, View } from 'react-native';
import { HeartFill as Heart } from 'rn-motion-ui-icons/icons/heart-fill';
import { PinFill as Pin } from 'rn-motion-ui-icons/icons/pin-fill';
import { RightLine as ChevronRight } from 'rn-motion-ui-icons/icons/right-line';
import { cn } from '../../../../lib/cn';
import { useThemeColors } from '../../../../theme/use-theme-color';
import { useIsLifting } from '../../../gestures/DragManager/multi-drag-scope';
import type { DragRect, DragzoneEntry, DragzoneRenderState } from '../../../gestures/drag.types';
import { rectsIntersect } from '../../../gestures/drag-geometry';
import { useDragScope } from '../../../gestures/drag-scope';
import { shiftZoneRects } from '../../../gestures/drag-store';
import { useActiveDrag } from '../../../gestures/use-drag-store';
import { HoldItem } from '../../../menus/HoldMenu/hold-menu';
import { Text } from '../../../typography/Text/text';
import { FileSystemFolderGlyph, FileTypeIcon } from '../../FileIcon/file-icons';
import { useFileSystemDragOptions } from '../hooks/use-file-system-drag-options';
import { useFileSystemDragScroll } from '../hooks/use-file-system-drag-scroll';
import { useFileSystemRowAnimation } from '../hooks/use-file-system-row-animation';
import { useFileSystemRowInteraction } from '../hooks/use-file-system-row-interaction';
import { filePreviewUrls, folderHasChildren } from '../logic/file-system-index';
import type { FileSystemSelectionMode } from '../logic/file-system-selection';
import { FS_DRAG_CONTAINER_TEST_ID, fileSystemEntryTestID } from '../logic/file-system-test-id';
import { FileSystemDropzone, isZoneInScrollableContent } from '../shell/file-system-dropzone';
import type {
  FileSystemContextMenuAction,
  FileSystemEntry,
  FileSystemExternalDropEvent,
  FileSystemIndex,
  FileSystemItem,
  FileSystemMoveEvent,
} from '../types/file-system.types';
import { FileSystemAnimatedRow } from './file-system-animated-row';
import { FileSystemHoverHighlight, FS_HOVER_TEST_ID, useFileSystemRowHover } from './file-system-hover';
import { FileSystemMarqueeBox, type FileSystemMarqueeRect, useFileSystemMarquee, useMarqueeGate } from './file-system-marquee';
import { FileSystemEmptyState } from './file-system-view';

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

/**
 * Loses to any row zone it overlaps, so the pane only takes a drop the rows did
 * not want. Negative rather than zero because a row zone nested inside this one
 * would win on depth anyway — the explicit number says so where it is read.
 */
const COLUMN_ZONE_PRIORITY = -1;

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

/**
 * The tint a row in flight keeps for the length of the drag — see the list view's
 * note. Every row the drag carries takes it, across every pane it spans.
 */
const LIFTING_ROW_CLASS = 'bg-surface-contrast';

/**
 * The mark over a whole pane a release would land in. Absolutely positioned, so it
 * never adds to the pane's fixed width or shifts the rows under it.
 *
 * Two faces for two questions. A drag from inside the component is asking *which
 * folder* it lands in, and the answer is this pane, so it rings — the same primary
 * border a folder row's own outline uses, one step out. A drag from outside is
 * asking whether files are taken here at all, and that is the dashed hatch the rest
 * of the component answers with.
 */
type ColumnDropSurfaceProps = { external: boolean };

function ColumnDropSurface({ external }: ColumnDropSurfaceProps) {
  return (
    <View
      className={cn(
        'pointer-events-none absolute inset-0 z-[3]',
        external
          ? 'border-[1.5px] border-foreground/20 border-dashed bg-foreground/[0.03]'
          : 'rounded-lg border-[1.5px] border-info',
      )}
    />
  );
}

type ColumnRowProps = {
  draggable: boolean;
  entry: FileSystemEntry;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  index: FileSystemIndex;
  isOnTrail: boolean;
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onExternalDrop?: (event: FileSystemExternalDropEvent) => void;
  onMove?: (event: FileSystemMoveEvent) => void;
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
  if (coverUrl) {
    const imageSize = { height: COLUMN_ICON_SIZE, width: COLUMN_ICON_SIZE };
    return (
      renderEntryIcon?.(entry, COLUMN_ICON_SIZE) ?? (
        <Image className="shrink-0 rounded-[3px] bg-white" resizeMode="cover" source={{ uri: coverUrl }} style={imageSize} />
      )
    );
  }
  // A selected row sits on the primary surface, the inverse of the pane behind
  // it, so the icon palette flips with it.
  return <FileTypeIcon fileName={entry.name} size={COLUMN_ICON_SIZE} surface={isSelected ? 'inverted' : 'theme'} />;
}

/**
 * Renders its own drag source and drop target rather than delegating to a shell:
 * the hold gesture, context menu, and multi-drag payload are resolved here and
 * forwarded to `HoldItem dragOptions`.
 *
 * The row gap (`marginBottom`) lives on the outermost element so the drop zone's
 * box matches the row exactly — a zone that included the gap would claim a pointer
 * sitting between two rows.
 */
function ColumnRow({
  draggable,
  entry,
  getContextMenuActions,
  index,
  isOnTrail,
  isSelected,
  onActivate,
  onContextMenuAction,
  onExternalDrop,
  onMove,
  onSelectLongPress,
  renderEntryIcon,
  testID,
}: ColumnRowProps) {
  const colors = useThemeColors();
  const hasChildren = entry.kind === 'folder' && folderHasChildren(index, entry);

  const { handleOpenChange, handlePress, handlePressIn, menuProps, onHoldAction } = useFileSystemRowInteraction({
    entry,
    getContextMenuActions,
    onActivate,
    onContextMenuAction,
    onSelectLongPress,
  });
  const dragOptions = useFileSystemDragOptions(entry, draggable);

  const isLifting = useIsLifting(entry.path);

  const renderBody = (isOver: boolean) => {
    // A selected row muted during drag; a drop target lit like a selection.
    const isActive = (isSelected && !isLifting) || isOver;

    return (
      // No `marginBottom` here: see the comment on the outermost element below.
      <View className={cn(isLifting && LIFTING_ROW_CLASS)} style={{ height: COLUMN_ROW_HEIGHT }}>
        <HoldItem items={menuProps.items} dragOptions={dragOptions} onHold={onHoldAction} onOpenChange={handleOpenChange}>
          <Pressable
            accessibilityLabel={entry.name}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            // See ListRow: native reads the state, web reads the ARIA attribute.
            aria-selected={isSelected}
            className={cn(
              'flex-row items-center gap-2 px-2',
              isActive && 'bg-info',
              !isActive && isOnTrail && 'bg-surface-selected',
              !(isActive || isOnTrail) && 'hover:bg-surface-hover',
            )}
            onPress={handlePress}
            onPressIn={handlePressIn}
            style={{ height: COLUMN_ROW_HEIGHT }}
            testID={testID}
          >
            <ColumnRowGlyph entry={entry} isSelected={isActive} renderEntryIcon={renderEntryIcon} />
            {entry.pinnedAt ? <Pin color={isActive ? colors.white : colors.primary} size={COLUMN_PIN_ICON_SIZE} /> : null}
            <Text className={cn('flex-1', isActive && 'text-white')} numberOfLines={1} size="sm">
              {entry.name}
            </Text>
            {entry.favoritedAt ? <Heart color={isActive ? colors.white : colors.danger} size={COLUMN_FAV_ICON_SIZE} /> : null}
            {hasChildren ? (
              <ChevronRight color={isActive ? colors.white : colors['muted-foreground']} size={COLUMN_CHEVRON_SIZE} />
            ) : null}
          </Pressable>
        </HoldItem>
      </View>
    );
  };

  // The gap belongs here so the zone's box is exactly the row's: a zone that
  // included the gap would claim a pointer sitting between two rows.
  return entry.kind === 'folder' ? (
    <View style={{ marginBottom: COLUMN_ROW_GAP }}>
      <FileSystemDropzone destination={entry.path} disabled={!draggable} onExternalDrop={onExternalDrop} onMove={onMove}>
        {({ isOver }: DragzoneRenderState) => renderBody(isOver)}
      </FileSystemDropzone>
    </View>
  ) : (
    <View style={{ marginBottom: COLUMN_ROW_GAP }}>{renderBody(false)}</View>
  );
}

export type FileSystemColumnProps = {
  /** Whether this pane's rows drag, and whether its zones take a drop. */
  draggable: boolean;
  entries: FileSystemEntry[];
  /** Path of the folder this column displays — the destination for a drop that misses every row. */
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
  /** Called when a drop lands on one of this pane's folder rows, or on the pane itself. */
  onMove?: (event: FileSystemMoveEvent) => void;
  onSelectLongPress?: (entry: FileSystemEntry) => void;
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
  draggable,
  entries,
  folderPath,
  getContextMenuActions,
  index,
  isLoading,
  onActivate,
  onContextMenuAction,
  onExternalDrop,
  onMarquee,
  onMove,
  onSelectLongPress,
  renderEntryIcon,
  selectedPaths,
  selectionMode,
  testID,
  trailChildPath,
}: FileSystemColumnProps) {
  // Each pane is its own ordering: a Shift-range runs through the column the
  // press landed in, never across the trail into a sibling folder's contents.
  const { augmentedEntries, onExitComplete } = useFileSystemRowAnimation(entries, folderPath, (entry) => entry.path);
  const orderedPaths = useMemo(() => augmentedEntries.map((entry) => entry.path), [augmentedEntries]);
  const activate = useCallback(
    (entry: FileSystemEntry, event?: GestureResponderEvent) => onActivate(entry, event, orderedPaths),
    [onActivate, orderedPaths],
  );

  const containerRef = useRef<View | null>(null);
  const flatListRef = useRef<FlatList<FileSystemEntry> | null>(null);
  const scrollOffsetRef = useRef(0);
  const rowCountRef = useRef(0);
  rowCountRef.current = augmentedEntries.length;
  const entriesRef = useRef(augmentedEntries);
  entriesRef.current = augmentedEntries;

  // A drag near this pane's top or bottom edge scrolls it, so a folder below the
  // fold is reachable without releasing.
  const scrollTo = useCallback((offset: number) => flatListRef.current?.scrollToOffset({ animated: false, offset }), []);
  useFileSystemDragScroll({ containerRef, enabled: draggable, scrollOffsetRef, scrollTo });

  const activeDrag = useActiveDrag();
  const isDragging = useCallback(() => activeDrag !== null, [activeDrag]);
  // The manager this pane's zones registered under — the scope the scroll
  // correction applies to, so a second FileSystem on the page keeps its own boxes.
  const { managerPath } = useDragScope();
  // This pane's own box, measured once per drag. The scroll correction below
  // applies only to zones INSIDE this pane — a sibling column's rows move with
  // that column's scroll, not this one's, and the pane/body fallbacks do not
  // move at all — so the predicate needs the pane's frame to test against.
  const viewportRef = useRef<DragRect | null>(null);
  // biome-ignore lint/plugin: measuring the pane once per drag for a scroll correction is a layout side-effect, not derived render state
  useEffect(() => {
    if (activeDrag === null) {
      viewportRef.current = null;
      return;
    }
    containerRef.current?.measureInWindow((x, y, width, height) => {
      viewportRef.current = { height, width, x, y };
    });
  }, [activeDrag]);
  const isInThisPane = useCallback((entry: DragzoneEntry) => {
    const viewport = viewportRef.current;
    return isZoneInScrollableContent(entry) && viewport !== null && entry.rect !== null && rectsIntersect(entry.rect, viewport);
  }, []);

  const hover = useFileSystemRowHover({
    containerRef,
    count: augmentedEntries.length,
    // No `getTargetIndex`: each folder row's own zone paints the pending drop, so
    // the sliding highlight has nothing to say during a drag.
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
      // Same correction as the desktop list view: the store's cached zone rects
      // are window boxes from the last measure, and a scroll moves this pane's
      // rows without any layout event — the hit test and the shared drop
      // indicator would resolve against pre-scroll positions mid-drag. Scoped to
      // the zones inside THIS pane's box so a sibling column's rows (and the
      // static fallbacks) keep their own correct boxes.
      const delta = offset - scrollOffsetRef.current;
      scrollOffsetRef.current = offset;
      if (delta !== 0) shiftZoneRects(0, delta, managerPath, isInThisPane);
      hover.refresh();
      marquee.refresh();
    },
    [hover, isInThisPane, managerPath, marquee],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedPaths is the trigger; not read in the body but must be in the deps to re-fire on selection change
  // biome-ignore lint/plugin: re-resolve is a side-effect on an Animated value, not render state
  useEffect(() => {
    hover.refresh();
    marquee.refresh();
  }, [hover, marquee, selectedPaths]);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemEntry & { _animStatus?: string }>) => {
      const isEntering = item._animStatus === 'entering';
      const isExiting = item._animStatus === 'exiting';
      const exitHandler = isExiting ? () => onExitComplete(item.path) : () => undefined;

      return (
        <FileSystemAnimatedRow
          height={COLUMN_ROW_HEIGHT}
          isEntering={isEntering}
          isExiting={isExiting}
          onExitComplete={exitHandler}
        >
          <ColumnRow
            draggable={draggable}
            entry={item}
            index={index}
            getContextMenuActions={getContextMenuActions}
            isOnTrail={item.kind === 'folder' && item.path === trailChildPath}
            isSelected={selectedPaths.has(item.path)}
            onActivate={activate}
            onContextMenuAction={onContextMenuAction}
            onExternalDrop={onExternalDrop}
            onMove={onMove}
            onSelectLongPress={onSelectLongPress}
            renderEntryIcon={renderEntryIcon}
            testID={fileSystemEntryTestID(testID, item.path)}
          />
        </FileSystemAnimatedRow>
      );
    },
    [
      activate,
      draggable,
      getContextMenuActions,
      index,
      onContextMenuAction,
      onExitComplete,
      onExternalDrop,
      onMove,
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

  const list = (
    <View className="relative flex-1">
      {/* Before the list, so it paints behind the rows — see FileSystemHoverHighlight. */}
      <FileSystemHoverHighlight controller={hover} height={COLUMN_ROW_HEIGHT} testID={FS_HOVER_TEST_ID.columns} />
      <FlatList
        ref={flatListRef}
        contentContainerClassName="p-1.5"
        data={augmentedEntries}
        extraData={selectedPaths}
        getItemLayout={getItemLayout}
        keyExtractor={keyExtractor}
        onScroll={onScroll}
        renderItem={renderRow}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        // Nested inside the consumer's own ScrollView — Android only scrolls a
        // child of a scroll container when it opts into nested scrolling.
        nestedScrollEnabled={true}
        // Off: Android's default true wrongly detaches visible cells when the
        // list is nested inside a ScrollView.
        removeClippedSubviews={false}
      />
      <FileSystemMarqueeBox controller={marquee} />
    </View>
  );

  // The spinner stands in for the list only on a first load. A pane that already
  // has rows keeps showing them while a refresh runs — replacing them would blank
  // the trail the user is reading.
  const body = isLoading && entries.length === 0 ? <FileSystemEmptyState isLoading={true} label={LOADING_LABEL} /> : list;

  return (
    <Pressable
      ref={containerRef}
      className="shrink-0 select-none border-border border-r-[1.5px]"
      style={{ width: COLUMN_WIDTH }}
      testID={FS_DRAG_CONTAINER_TEST_ID.column}
    >
      {/* The pane's own fallback target, one step under every folder row's zone: a
          drop that lands on a file row, in the padding, or past the last row belongs
          to the folder this pane *is*. That is what makes a trail droppable at every
          level — the columns view has no single "current folder", so the body-level
          zone the other views fall back to would name the wrong one here. */}
      <FileSystemDropzone
        background={true}
        className="min-h-0 flex-1"
        destination={folderPath}
        disabled={!draggable}
        onExternalDrop={onExternalDrop}
        onMove={onMove}
        priority={COLUMN_ZONE_PRIORITY}
      >
        {({ external, isOver }: DragzoneRenderState) => (
          <>
            {body}
            {/* Two marks, because they answer different questions. A drag from
                inside is asking which folder it lands in, so the whole pane rings.
                One from outside is asking whether the component takes files at
                all, which is what the dashed hatch says everywhere else. */}
            {isOver ? <ColumnDropSurface external={external} /> : null}
          </>
        )}
      </FileSystemDropzone>
    </Pressable>
  );
}

export const FileSystemColumn = memo(FileSystemColumnImpl);
