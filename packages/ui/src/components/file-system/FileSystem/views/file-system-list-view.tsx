/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the view and its row/header/overlay parts are one render layer */
// The list view: a disclosure tree with Name / Date Modified / Size columns.
// Here the rows come from the sorted index (see file-system-rows) and render through a FlatList, so the same
// folder-first ordering and per-folder disclosure survive without the DOM.

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { FlatList, Pressable, View } from 'react-native';
import { DownLine as ChevronDown } from 'rn-motion-ui-icons/icons/down-line';
import { HeartFill as Heart } from 'rn-motion-ui-icons/icons/heart-fill';
import { PinFill as Pin } from 'rn-motion-ui-icons/icons/pin-fill';
import { RightLine as ChevronRight } from 'rn-motion-ui-icons/icons/right-line';
import { UpLine as ChevronUp } from 'rn-motion-ui-icons/icons/up-line';
import { cn } from '../../../../lib/cn';
import { useThemeColors } from '../../../../theme/use-theme-color';
import { useIsLifting } from '../../../gestures/DragManager/multi-drag-scope';
import type { DragzoneAcceptEvent, DragzoneRenderState } from '../../../gestures/drag.types';
import { refreshDragzones } from '../../../gestures/drag-store';
import { useActiveDrag } from '../../../gestures/use-drag-store';
import { ThemedIcon } from '../../../icon/themed-icon';
import { HoldContextMenu, type HoldContextMenuDragOptions } from '../../../menus/HoldContextMenu/hold-context-menu';
import { Text } from '../../../typography/Text/text';
import { FileSystemFolderGlyph, FileTypeIcon } from '../../FileIcon/file-icons';
import { useEntryActivation } from '../hooks/use-entry-activation';
import { useFileSystemDragOptions } from '../hooks/use-file-system-drag-options';
import { useFileSystemDragScroll } from '../hooks/use-file-system-drag-scroll';
import { type AugmentedEntry, useFileSystemRowAnimation } from '../hooks/use-file-system-row-animation';
import { type FileSystemRowInteractionReturn, useFileSystemRowInteraction } from '../hooks/use-file-system-row-interaction';
import { formatByteSize, formatTimestamp } from '../logic/file-system-format';
import type { FileSystemRow } from '../logic/file-system-rows';
import { FS_ROW_HEIGHT, flattenFileSystemRows, toggleExpandedPath } from '../logic/file-system-rows';
import { FS_DRAG_CONTAINER_TEST_ID, FS_OVERLAY_DROPZONE_TEST_ID, fileSystemEntryTestID } from '../logic/file-system-test-id';
import { useBackgroundContextMenu } from '../shell/file-system-context-menu';
import { FileSystemDropzone } from '../shell/file-system-dropzone';
import type {
  FileSystemContextMenuAction,
  FileSystemEntry,
  FileSystemExternalDropEvent,
  FileSystemItem,
  FileSystemMoveEvent,
  FileSystemSortKey,
  FileSystemSortState,
} from '../types/file-system.types';
import { FileSystemAnimatedRow } from './file-system-animated-row';
import { FileSystemHoverHighlight, FS_HOVER_TEST_ID, useFileSystemRowHover } from './file-system-hover';
import { FileSystemMarqueeBox, type FileSystemMarqueeRect, useFileSystemMarquee, useMarqueeGate } from './file-system-marquee';
import type { FileSystemViewProps } from './file-system-view';

const NAME_LABEL = 'Name';
const DATE_LABEL = 'Date Modified';
const SIZE_LABEL = 'Size';
const MISSING_VALUE = '—';

const INDENT_PER_LEVEL = 14;
/** The chevron lane, reserved on file rows too so names stay aligned. */
const CHEVRON_SIZE = 18;
/** The row's own left inset, matching the `px-2` its className sets. */
const ROW_PADDING_X = 8;
const ICON_SIZE = 16;
const FOLDER_GLYPH_SIZE = 18;
const PIN_ICON_SIZE = 10;
const FAV_ICON_SIZE = 10;
/** Below this the date column drops out, leaving name + size. */
const DATE_COLUMN_MIN_WIDTH = 420;

/** Content-container top padding (py-1 = 4 px): where row 0 starts. */
const LIST_PADDING_TOP = 4;

/**
 * The tint a row in flight keeps for the length of the drag. The sliding highlight
 * has moved to the drop target by then, so without this the rows the gesture is
 * actually about are the only ones on screen with no mark at all.
 */
const LIFTING_ROW_CLASS = 'bg-muted';

/** Container-local point → row index, or null for padding / past-last-row. */
function rowHitAt(_localX: number, localY: number, scrollOffset: number, rowCount: number): number | null {
  const contentY = localY + scrollOffset - LIST_PADDING_TOP;
  if (contentY < 0) return null;
  const rowIndex = Math.floor(contentY / FS_ROW_HEIGHT);
  if (rowIndex >= rowCount) return null;
  return rowIndex;
}

/** Content-frame rect → paths of every row it overlaps. */
function rowsInRect(rect: FileSystemMarqueeRect, rows: FileSystemRow[]): readonly string[] {
  const top = rect.y - LIST_PADDING_TOP;
  const bottom = rect.y + rect.height - LIST_PADDING_TOP;
  const result: string[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const rowTop = i * FS_ROW_HEIGHT;
    if (rowTop >= bottom) break;
    if (rowTop + FS_ROW_HEIGHT > top) {
      const row = rows[i];
      if (row) result.push(row.entry.path);
    }
  }
  return result;
}
const keyExtractor = (row: FileSystemRow) => row.entry.path;
const getItemLayout = (_data: ArrayLike<FileSystemRow> | null | undefined, index: number) => ({
  index,
  length: FS_ROW_HEIGHT,
  offset: FS_ROW_HEIGHT * index,
});

function itemCountLabel(count: number | undefined): string {
  if (count === undefined) return MISSING_VALUE;
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

type ColumnHeaderProps = {
  className?: string;
  label: string;
  onPress: (key: FileSystemSortKey) => void;
  sort: FileSystemSortState;
  sortKey: FileSystemSortKey;
};

/** One sortable header; the active column carries the direction chevron. */
function ColumnHeader({ className, label, onPress, sort, sortKey }: ColumnHeaderProps) {
  const isActive = sort.key === sortKey;
  const handlePress = useCallback(() => onPress(sortKey), [onPress, sortKey]);
  const DirectionIcon = sort.direction === 'asc' ? ChevronUp : ChevronDown;

  return (
    <Pressable accessibilityRole="button" className={cn('flex-row items-center gap-0.5 py-0.5', className)} onPress={handlePress}>
      <Text className={cn(isActive ? 'text-foreground' : 'text-muted-foreground')} numberOfLines={1} size="xs" weight="medium">
        {label}
      </Text>
      {isActive ? <ThemedIcon icon={DirectionIcon} variant="secondary" size={12} /> : null}
    </Pressable>
  );
}

/**
 * Left edge of a row's chevron lane. Read twice per row — once as the row's own
 * indented padding, once to place the disclosure control over the lane that
 * padding reserves — so the two can only agree.
 */
function chevronLaneLeft(level: number): number {
  return ROW_PADDING_X + level * INDENT_PER_LEVEL;
}

type RowChevronProps = { isExpanded: boolean; isSelected: boolean; level: number; name: string; onToggle: () => void };

/**
 * A folder row's disclosure control, laid over the lane the row's own padding
 * reserves.
 *
 * A sibling of the row button rather than a child of it: a button inside a button
 * is invalid HTML, and on web both Pressables resolve to one. Nothing about the
 * press behaviour changes — RNW's press responder stops the click before it
 * reaches an ancestor Pressable, so tapping the chevron never also activated the
 * row, and the same holds for the responder on native.
 *
 * Full row height, so the target is the whole lane rather than just the glyph.
 */
function RowChevron({ isExpanded, isSelected, level, name, onToggle }: RowChevronProps) {
  return (
    <Pressable
      accessibilityLabel={isExpanded ? `Collapse ${name}` : `Expand ${name}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      // See ListRow: native reads the state, web reads the ARIA attribute.
      aria-expanded={isExpanded}
      className="absolute top-0 items-center justify-center"
      onPress={onToggle}
      style={{ height: FS_ROW_HEIGHT, left: chevronLaneLeft(level), width: CHEVRON_SIZE }}
    >
      <ThemedIcon icon={isExpanded ? ChevronDown : ChevronRight} token={isSelected ? 'white' : 'muted-foreground'} size={14} />
    </Pressable>
  );
}

/** How long a drag must hover over a folder before it uncollapses (ms). */
const SPRING_LOAD_DELAY_MS = 800;

/**
 * Invisible side-effect component: expands a collapsed folder when a drag
 * hovers over its dropzone for `SPRING_LOAD_DELAY_MS`. For a lazy-loaded
 * folder (`hasChildren`) it also triggers `ensureChildren` so the children
 * arrive while the drag is still held.
 *
 * The folder stays expanded after the drag leaves — it was a deliberate
 * action, like clicking the chevron.
 */
type SpringLoadEffectProps = {
  ensureChildren?: (folderPath: string) => void;
  folderPath: string;
  hasChildren: boolean;
  isExpanded: boolean;
  isOver: boolean;
  onToggleExpanded: (path: string) => void;
};

function SpringLoadEffect({
  ensureChildren,
  folderPath,
  hasChildren,
  isExpanded,
  isOver,
  onToggleExpanded,
}: SpringLoadEffectProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // biome-ignore lint/plugin: clearing pending timers on unmount is imperative teardown
  useEffect(() => {
    // Only start the timer when the drag enters a collapsed folder.
    if (isOver && !isExpanded) {
      timerRef.current = setTimeout(() => {
        // For a lazy-loaded folder, request children first so they arrive
        // while the drag is still held over the target.
        if (hasChildren) ensureChildren?.(folderPath);
        onToggleExpanded(folderPath);
      }, SPRING_LOAD_DELAY_MS);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOver, isExpanded, hasChildren, folderPath, onToggleExpanded, ensureChildren]);

  return null;
}

type ListRowBodyProps = {
  childCount: number | undefined;
  dragOptions: HoldContextMenuDragOptions | undefined;
  entry: FileSystemEntry;
  handleOpenChange: (open: boolean) => void;
  handlePress: (event: GestureResponderEvent) => void;
  handlePressIn: () => void;
  isExpandable: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  level: number;
  menuProps: FileSystemRowInteractionReturn['menuProps'];
  onHoldAction: (() => void) | undefined;
  onToggleExpanded: (path: string) => void;
  renderEntryIcon?: (entry: FileSystemEntry, size: number) => ReactNode | null | undefined;
  showDate: boolean;
  testID?: string;
};

/**
 * The pressable core of a list row: chevron lane, icon, name, then the metadata
 * columns, wrapped in the hold/context menu. The lift tint and the row highlight
 * are decided here, so a selected row that is mid-drag dims instead of lighting
 * up. Split out of `ListRow` so both the file shell and the folder dropzone can
 * render it as a child without a second function.
 */
function ListRowBody({
  childCount,
  dragOptions,
  entry,
  handleOpenChange,
  handlePress,
  handlePressIn,
  isExpandable,
  isExpanded,
  isSelected,
  level,
  menuProps,
  onHoldAction,
  onToggleExpanded,
  renderEntryIcon,
  showDate,
  testID,
}: ListRowBodyProps) {
  const isLifting = useIsLifting(entry.path);
  const colors = useThemeColors();
  const handleToggle = useCallback(() => onToggleExpanded(entry.path), [entry.path, onToggleExpanded]);

  // Only a selection lights the row; the drop target gets an info outline
  // instead, so the parent folder row never highlights when the pointer is
  // over a subfolder.
  const isActive = isSelected && !isLifting;
  const textClassName = isActive ? 'text-white' : 'text-foreground';
  const metaClassName = isActive ? 'text-white' : 'text-muted-foreground';

  return (
    <View className={cn(isLifting && LIFTING_ROW_CLASS)} style={{ height: FS_ROW_HEIGHT }}>
      <HoldContextMenu {...menuProps} dragOptions={dragOptions} onHold={onHoldAction} onOpenChange={handleOpenChange}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          // Both, deliberately: `accessibilityState` is what native reads, and
          // react-native-web maps `aria-selected` but not `accessibilityState`, so
          // on web the fill would otherwise be the only thing saying "picked".
          aria-selected={isSelected}
          // Hover is not a class here: it is one sliding node behind the rows, so it
          // can keep tracking under the drag's pointer capture. See file-system-hover.
          className={cn('flex-row items-center gap-1 px-2', isActive && 'bg-info')}
          onPress={handlePress}
          onPressIn={handlePressIn}
          style={{ height: FS_ROW_HEIGHT, paddingLeft: chevronLaneLeft(level) }}
          testID={testID}
        >
          {/* The chevron's lane, held open on file rows too so names stay aligned
              across kinds. On a folder row the control below sits over this box. */}
          <View style={{ width: CHEVRON_SIZE }} />
          {entry.kind === 'folder'
            ? (renderEntryIcon?.(entry, FOLDER_GLYPH_SIZE) ?? <FileSystemFolderGlyph size={FOLDER_GLYPH_SIZE} />)
            : (renderEntryIcon?.(entry, ICON_SIZE) ?? <FileTypeIcon fileName={entry.name} size={ICON_SIZE} />)}
          {entry.pinnedAt ? <Pin color={isActive ? colors.white : colors.primary} size={PIN_ICON_SIZE} /> : null}
          <Text className={cn('flex-1', textClassName)} numberOfLines={1} size="sm">
            {entry.name}
          </Text>
          {entry.favoritedAt ? <Heart color={isActive ? colors.white : colors.danger} size={FAV_ICON_SIZE} /> : null}
          {showDate ? (
            <Text className={cn('w-44', metaClassName)} numberOfLines={1} size="xs">
              {formatTimestamp(entry.updatedAt ?? entry.createdAt) ?? MISSING_VALUE}
            </Text>
          ) : null}
          <Text className={cn('w-20 text-right', metaClassName)} numberOfLines={1} numeric={true} size="xs">
            {entry.kind === 'folder' ? itemCountLabel(childCount) : (formatByteSize(entry.size) ?? MISSING_VALUE)}
          </Text>
        </Pressable>
        {isExpandable ? (
          <RowChevron isExpanded={isExpanded} isSelected={isActive} level={level} name={entry.name} onToggle={handleToggle} />
        ) : null}
      </HoldContextMenu>
    </View>
  );
}

type ListRowProps = {
  /** Arithmetic row-index check — see `createRowIndexCheck` in the parent. */
  additionalAccepts?: (event: DragzoneAcceptEvent) => boolean;
  childCount: number | undefined;
  draggable: boolean;
  ensureChildren?: (folderPath: string) => void;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onExternalDrop?: (event: FileSystemExternalDropEvent) => void;
  onMove?: (event: FileSystemMoveEvent) => void;
  /** Long-press toggles this row's selection; `undefined` leaves the gesture to the context menu. */
  onSelectLongPress?: (entry: FileSystemEntry) => void;
  onToggleExpanded: (path: string) => void;
  renderEntryIcon?: (entry: FileSystemEntry, size: number) => ReactNode | null | undefined;
  row: FileSystemRow;
  showDate: boolean;
  /** When true, the Dragzone skips `measureInWindow` — see `createRowIndexCheck`. */
  skipRectMeasure?: boolean;
  /** When true, the folder row renders without its own dropzone (an overlay handles it instead). */
  suppressDropzone?: boolean;
  /** Already resolved for this entry by the view — see `fileSystemEntryTestID`. */
  testID?: string;
};

/**
 * Disclosure chevron, icon, name, then the metadata columns.
 *
 * Owns the hold gesture (via `HoldContextMenu`), the context menu, and the drag
 * source. No separate shell component — the drop target wraps the row directly
 * for folder entries, and the drag is handled by `HoldContextMenu dragOptions`.
 */
function ListRow({
  childCount,
  draggable,
  ensureChildren,
  getContextMenuActions,
  isSelected,
  onActivate,
  onContextMenuAction,
  onExternalDrop,
  onMove,
  onSelectLongPress,
  onToggleExpanded,
  renderEntryIcon,
  row,
  showDate,
  suppressDropzone,
  testID,
}: ListRowProps) {
  const { entry, isExpandable, isExpanded, level } = row;

  const { handleOpenChange, handlePress, handlePressIn, menuProps, onHoldAction } = useFileSystemRowInteraction({
    entry,
    getContextMenuActions,
    onActivate,
    onContextMenuAction,
    onSelectLongPress,
  });
  const dragOptions = useFileSystemDragOptions(entry, draggable);

  const body = (
    <ListRowBody
      childCount={childCount}
      dragOptions={dragOptions}
      entry={entry}
      handleOpenChange={handleOpenChange}
      handlePress={handlePress}
      handlePressIn={handlePressIn}
      isExpandable={isExpandable}
      isExpanded={isExpanded}
      isSelected={isSelected}
      level={level}
      menuProps={menuProps}
      onHoldAction={onHoldAction}
      onToggleExpanded={onToggleExpanded}
      renderEntryIcon={renderEntryIcon}
      showDate={showDate}
      testID={testID}
    />
  );

  // A file row is never a drop target. A folder row keeps its dropzone mounted
  // whether or not an expanded-ancestor overlay covers it — the overlay suppresses
  // it via `disabled` rather than by swapping the wrapper for a plain View, because
  // changing the element type mid-drag is a structural DOM mutation that can tear
  // an in-flight drag down.
  if (entry.kind !== 'folder') return <View style={{ height: FS_ROW_HEIGHT }}>{body}</View>;

  return (
    <FileSystemDropzone
      destination={entry.path}
      disabled={!draggable || suppressDropzone}
      onDropCompleted={ensureChildren}
      onExternalDrop={onExternalDrop}
      onMove={onMove}
    >
      {({ isOver }: DragzoneRenderState) => (
        <>
          {body}
          {isOver ? <View className="pointer-events-none absolute inset-0 z-[3] rounded-md border-2 border-info" /> : null}
          <SpringLoadEffect
            ensureChildren={ensureChildren}
            folderPath={entry.path}
            hasChildren={entry.hasChildren === true}
            isExpanded={isExpanded}
            isOver={isOver}
            onToggleExpanded={onToggleExpanded}
          />
        </>
      )}
    </FileSystemDropzone>
  );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: drag, hover, context-menu, and row layout are tightly coupled around shared state — splitting would scatter interdependent logic
export function FileSystemListView({
  currentPath,
  draggable = false,
  ensureChildren,
  getBackgroundContextMenuActions,
  getContextMenuActions,
  index,
  onBackgroundContextMenuAction,
  onContextMenuAction,
  onExternalDrop,
  onMarquee,
  onMove,
  onOpen,
  onSelect,
  onSortColumnClick,
  renderEntryIcon,
  selectedPaths,
  selectionMode,
  sort,
  testID,
}: FileSystemViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>());
  /** `null` until the first layout pass — distinct from a measured zero. */
  const [width, setWidth] = useState<number | null>(null);
  /** Height of the list body (the pressable below the header), used to clamp
   * overlay dropzones so a folder's outline never spills past the container. */
  const [containerHeight, setContainerHeight] = useState<number | null>(null);

  const flatListRef = useRef<FlatList<FileSystemRow> | null>(null);
  const containerRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  /** The drawn rows, readable from callbacks that outlive the render that made them. */
  const rowsRef = useRef<FileSystemRow[]>([]);

  const rows = useMemo(() => flattenFileSystemRows({ currentPath, expanded, index }), [currentPath, expanded, index]);

  const activeDrag = useActiveDrag();
  const isDragging = useCallback(() => activeDrag !== null, [activeDrag]);

  // The overlay dropzones (and the folder-row wrapper they suppress) must not
  // mount during the browser's own `dragstart` handler. `beginDrag` publishes the
  // drag synchronously inside `dragstart`, and a DOM change under the lift there —
  // mounting an overlay over a subfolder's source row is exactly that change — makes
  // Chromium tear the drag down before it starts. Defer the overlay/suppress work one
  // tick so the drag is established before the DOM moves.
  const [dragActive, setDragActive] = useState(false);
  // biome-ignore lint/plugin: deferring the overlay mount past `dragstart` is the whole point
  useEffect(() => {
    const next = activeDrag !== null;
    if (next === dragActive) return;
    const id = setTimeout(() => setDragActive(next), 0);
    return () => clearTimeout(id);
  }, [activeDrag, dragActive]);

  // During an in-library drag the enter animation is suppressed: spring-load
  // inserts children that otherwise animate 0 → full height over ~280ms, during
  // which the rows below have not yet shifted. `measureInWindow` then reads
  // stale rects and a stationary cursor resolves to the wrong (pre-expansion)
  // target. External drags never run through the store's rect hit-testing — the
  // browser targets the DOM element directly — so they keep the animation.
  const { augmentedEntries: augmentedRows, onExitComplete } = useFileSystemRowAnimation(
    rows,
    currentPath,
    (row) => row.entry.path,
    activeDrag === null,
  );
  rowsRef.current = augmentedRows;

  // Overlay dropzones for expanded folders during an active drag. Each overlay
  // is a sibling of the FlatList (not inside it), positioned absolutely to escape
  // the FlatList's scroll‑container clipping. Rendered only while a drag is in
  // flight so clicks pass through to the rows during normal use.
  const overlayZones = useMemo(() => {
    if (!dragActive) return [];
    const zones: Array<{ height: number; path: string; top: number }> = [];
    for (let i = 0; i < augmentedRows.length; i += 1) {
      const row = augmentedRows[i];
      if (row && row.entry.kind === 'folder' && row.isExpanded) {
        const folderLevel = row.level;
        let end = i;
        while (end + 1 < augmentedRows.length) {
          const next = augmentedRows[end + 1];
          if (!next || next.level <= folderLevel) break;
          end += 1;
        }
        const childCount = end - i;
        if (childCount > 0)
          zones.push({
            height: (1 + childCount) * FS_ROW_HEIGHT,
            path: row.entry.path,
            top: LIST_PADDING_TOP + i * FS_ROW_HEIGHT,
          });
      }
    }
    return zones;
  }, [augmentedRows, dragActive]);

  // Paths of folders that have an overlay — their own row dropzone is suppressed
  // so the overlay wins the tie-break by being the only zone in the area.
  const overlayFolderPaths = useMemo(() => new Set(overlayZones.map((z) => z.path)), [overlayZones]);

  // A Shift-range runs through the rows as they are drawn — an expanded folder's
  // children included, since they sit between their parent and its next sibling.
  const orderedPaths = useMemo(() => augmentedRows.map((row) => row.entry.path), [augmentedRows]);
  // Shown before the first measurement so the header does not visibly gain a
  // column on mount at the widths where it belongs.
  const showDate = width === null || width >= DATE_COLUMN_MIN_WIDTH;

  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);

  const handleLayout = useCallback((event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width), []);
  const handleContainerLayout = useCallback(
    (event: LayoutChangeEvent) => setContainerHeight(event.nativeEvent.layout.height),
    [],
  );
  // Opening a lazy folder must request its children, exactly as selecting it
  // would. A plain chevron click only flips the disclosure bit, so without this
  // a `hasChildren` folder would expand over nothing and look empty. Collapsing
  // is skipped: `ensureChildren` would otherwise prefetch a folder the user just
  // closed, and the store's own guards make the expand-side call idempotent.
  const toggleExpanded = useCallback(
    (path: string) => {
      if (!expanded.has(path)) ensureChildren?.(path);
      setExpanded((previous) => toggleExpandedPath(previous, path));
    },
    [ensureChildren, expanded],
  );

  // A drag near the top or bottom edge scrolls the list, so a folder below the
  // fold is reachable without releasing. Runs for external drags too.
  const scrollTo = useCallback((offset: number) => flatListRef.current?.scrollToOffset({ animated: false, offset }), []);
  useFileSystemDragScroll({ containerRef, enabled: draggable, scrollOffsetRef, scrollTo });

  const selectedIndexesRef = useRef<ReadonlySet<number>>(new Set());
  selectedIndexesRef.current = useMemo(() => {
    const indexes = new Set<number>();
    augmentedRows.forEach((row, rowIndex) => {
      if (selectedPaths.has(row.entry.path)) indexes.add(rowIndex);
    });
    return indexes;
  }, [augmentedRows, selectedPaths]);

  const hover = useFileSystemRowHover({
    containerRef,
    count: augmentedRows.length,
    // No `getTargetIndex`: each folder row's own zone paints the pending drop now,
    // so the sliding highlight has nothing to say during a drag and suppresses itself.
    isDragging,
    offsetTop: LIST_PADDING_TOP,
    scrollOffsetRef,
    selectedIndexesRef,
    stride: FS_ROW_HEIGHT,
  });

  const hitTest = useCallback(
    (localX: number, localY: number) => rowHitAt(localX, localY, scrollOffsetRef.current, rowsRef.current.length),
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
    resolve: useCallback((rect: FileSystemMarqueeRect) => rowsInRect(rect, rowsRef.current), []),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedPaths is the trigger; not read in the body but must be in the deps to re-fire on selection change
  // biome-ignore lint/plugin: re-resolve is a side-effect on an Animated value, not render state
  useEffect(() => {
    hover.refresh();
    marquee.refresh();
  }, [hover, marquee, selectedPaths]);

  // When the expanded set changes — e.g. a folder uncollapsed by spring-load —
  // rows below it shift down but their dropzones' cached `measureInWindow` rects
  // do not update, because FlatList does not fire `onLayout` on items that are
  // merely repositioned.  A stale rect causes every collision check below the
  // expansion to be off by `(new child count) × row height`.  Remeasuring all
  // zones fixes the offset.
  //
  // Keyed on `expanded` only — not on `overlayZones`/`augmentedRows`, which change
  // identity every render and would re-fire this effect (and its `publish()`) in a
  // loop. Child effects run before parent effects, so the newly mounted overlay
  // zones have already registered by the time this remeasure runs.
  // biome-ignore lint/correctness/useExhaustiveDependencies: expanded is the trigger, not read in the body
  // biome-ignore lint/plugin: remeasuring after layout shift is the sole purpose
  useEffect(() => {
    refreshDragzones().catch(() => undefined);
  }, [expanded]);

  const { onLongPress: bgLongPress, menuNode: bgMenuNode } = useBackgroundContextMenu(
    containerRef,
    getBackgroundContextMenuActions,
    onBackgroundContextMenuAction,
  );
  const handleBackgroundPress = useCallback(() => onSelect(null), [onSelect]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = offset;
      // Kept in React state so overlay dropzones reposition with the scroll.
      setScrollOffset(offset);
      // The pointer has not moved but the rows under it have, so the highlight has
      // to re-resolve — including while a drag auto-scrolls the list.
      hover.refresh();
      marquee.refresh();
    },
    [hover, marquee],
  );

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<AugmentedEntry<FileSystemRow>>) => {
      const isEntering = item._animStatus === 'entering';
      const isExiting = item._animStatus === 'exiting';
      const exitHandler = isExiting ? () => onExitComplete(item.entry.path) : undefined;

      return (
        <FileSystemAnimatedRow
          height={FS_ROW_HEIGHT}
          isEntering={isEntering}
          isExiting={isExiting}
          onExitComplete={exitHandler ?? (() => undefined)}
        >
          <ListRow
            childCount={index.children.get(item.entry.path)?.length}
            draggable={draggable}
            ensureChildren={ensureChildren}
            getContextMenuActions={getContextMenuActions}
            isSelected={selectedPaths.has(item.entry.path)}
            onActivate={activate}
            onContextMenuAction={onContextMenuAction}
            onExternalDrop={onExternalDrop}
            onMove={onMove}
            onSelectLongPress={selectLongPress}
            onToggleExpanded={toggleExpanded}
            renderEntryIcon={renderEntryIcon}
            row={item}
            showDate={showDate}
            suppressDropzone={overlayFolderPaths.has(item.entry.path)}
            testID={fileSystemEntryTestID(testID, item.entry.path)}
          />
        </FileSystemAnimatedRow>
      );
    },
    [
      activate,
      draggable,
      ensureChildren,
      getContextMenuActions,
      index,
      onContextMenuAction,
      onExitComplete,
      onExternalDrop,
      onMove,
      overlayFolderPaths,
      renderEntryIcon,
      selectedPaths,
      selectLongPress,
      showDate,
      testID,
      toggleExpanded,
    ],
  );

  const list = (
    <FlatList
      ref={flatListRef}
      className="flex-1"
      contentContainerClassName="py-1"
      data={augmentedRows}
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
  );

  return (
    <View className="min-h-0 flex-1" onLayout={handleLayout}>
      {/* The header's left padding matches a level-0 row: chevron lane + icon. */}
      <View className="shrink-0 flex-row items-center gap-1 border-border border-b py-1 pr-2 pl-2">
        {/* Chevron lane + icon + their gap — matches a level-0 row. */}
        <View style={{ width: CHEVRON_SIZE + ICON_SIZE + 4 }} />
        <ColumnHeader className="flex-1" label={NAME_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="name" />
        {showDate ? (
          <ColumnHeader className="w-44" label={DATE_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="updatedAt" />
        ) : null}
        <ColumnHeader className="w-20 justify-end" label={SIZE_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="size" />
      </View>
      <Pressable
        ref={containerRef}
        className="relative min-h-0 flex-1 select-none"
        testID={FS_DRAG_CONTAINER_TEST_ID.list}
        onLayout={handleContainerLayout}
        onPress={handleBackgroundPress}
        onLongPress={bgLongPress}
      >
        {/* Before the list, so it paints behind the rows — see FileSystemHoverHighlight. */}
        <FileSystemHoverHighlight controller={hover} height={FS_ROW_HEIGHT} testID={FS_HOVER_TEST_ID.list} />
        {/* No background zone here: a drop that misses every folder row belongs to the
            folder that is open, and that fallback is mounted once in file-system-body
            so all four views answer an empty-space drop the same way. */}
        {list}
        {/* Overlay dropzones for expanded folders during a drag. Rendered as FlatList
            siblings (not inside it) so the zones escape the scroll container's clipping.
            Positioned absolutely relative to the list container; scroll offset keeps
            them pinned to the folder content. Clipped to the container's bounds so a
            folder near the fold never paints or accepts a drop outside the list body. */}
        {overlayZones.map((zone) => {
          const rawTop = zone.top - scrollOffset;
          const top = Math.max(rawTop, 0);
          const bottom = Math.min(rawTop + zone.height, containerHeight ?? Number.POSITIVE_INFINITY);
          const height = Math.max(bottom - top, 0);
          if (height <= 0) return null;
          return (
            <FileSystemDropzone
              destination={zone.path}
              disabled={!draggable}
              key={zone.path}
              onDropCompleted={ensureChildren}
              onExternalDrop={onExternalDrop}
              onMove={onMove}
              // Portal, so the overlay registers every in-library drag even when
              // the drop would move nothing — the origin folder a dragged file
              // lives in is already its parent, and the plain `accepts` would
              // refuse it, letting the ancestor overlay show through instead.
              // The drop handler still filters via `movableFileSystemSources`,
              // so a release here that changes nothing stays a no-op.
              portal={true}
              style={{ height, left: 0, position: 'absolute', right: 0, top }}
            >
              {({ isOver }: DragzoneRenderState) =>
                isOver ? (
                  <View
                    className="pointer-events-none absolute inset-0 z-[3] rounded-md border-2 border-info"
                    testID={FS_OVERLAY_DROPZONE_TEST_ID}
                  />
                ) : null
              }
            </FileSystemDropzone>
          );
        })}
        <FileSystemMarqueeBox controller={marquee} />
        {bgMenuNode}
      </Pressable>
    </View>
  );
}
