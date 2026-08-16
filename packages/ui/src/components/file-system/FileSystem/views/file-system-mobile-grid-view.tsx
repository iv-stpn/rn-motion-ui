/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the tile, its glyph box and its name row are one render layer */
// The mobile grid view: a two-column thumbnail grid for touch.
//
// Unlike the desktop `icons` view this one carries no marquee or hover — a phone
// has no right button to summon a menu and no pointer to hover with — so each tile
// shows a visible kebab instead, and long-press is the way into multi-select. Once
// anything is selected every kebab becomes a checkbox (see `FileSystemMobileMenu`),
// which is the classic mobile file-manager idiom. The same hold that toggles the
// selection keeps dragging past the escape slop, lifting the multi-selection onto
// a folder tile — the drag wiring mirrors the desktop `IconTile`.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { HeartFill as Heart } from 'rn-motion-ui-icons/icons/heart-fill';
import { PinFill as Pin } from 'rn-motion-ui-icons/icons/pin-fill';
import { cn } from '../../../../lib/cn';
import { useThemeColors } from '../../../../theme/use-theme-color';
import { useIsLifting } from '../../../gestures/DragManager/multi-drag-scope';
import type { DragzoneRenderState } from '../../../gestures/drag.types';
import { HoldContextMenu } from '../../../menus/HoldContextMenu/hold-context-menu';
import { Text } from '../../../typography/Text/text';
import { FileSystemFolderGlyph } from '../../FileIcon/file-icons';
import { useEntryActivation } from '../hooks/use-entry-activation';
import { useFileSystemDragOptions } from '../hooks/use-file-system-drag-options';
import { useFileSystemDragScroll } from '../hooks/use-file-system-drag-scroll';
import { useFileSystemRowInteraction } from '../hooks/use-file-system-row-interaction';
import { useFileSystemScrubSession } from '../hooks/use-file-system-scrub';
import { fileSystemEntryTestID } from '../logic/file-system-test-id';
import { FileSystemDropzone } from '../shell/file-system-dropzone';
import type {
  FileEntry,
  FileSystemEntry,
  FileSystemExternalDropEvent,
  FileSystemMoveEvent,
  FileSystemViewProps,
} from '../types/file-system.types';
import { FileSystemMobileMenu } from './file-system-mobile-menu';
import { FileVisual } from './file-system-visual';

/** Content padding around the grid, on all four sides. */
const GRID_PADDING = 12;
/** A phone grid is two across. */
const GRID_COLUMNS = 2;
/** Horizontal gap between the two columns. */
const GRID_GAP = 8;
/** Fixed glyph-box height — taller than the desktop icons view, as a phone grid wants. */
const GLYPH_BOX_HEIGHT = 96;
/** The trailing kebab/checkbox's edge size (`size-7`), half of which is its centre offset. */
const TRAILING_CONTROL_SIZE = 28;
/** Inset from the box edges, so a preview never touches the selection ring. */
const GLYPH_BOX_INSET = 12;
const FOLDER_GLYPH_SIZE = 56;
/** Fallback portrait ratio, matching `FileVisual`'s default. */
const DEFAULT_PREVIEW_RATIO = 0.72;

/** How the tile left behind under a drag reads — and what the lifted ghost copy
 *  carries with it: a card, so the ghost stays visible against the page. */
const DRAG_SOURCE_CLASSNAME = 'rounded-lg bg-surface-3 shadow-lg';

/** Preview width that fits a file's thumbnail inside the box without clipping. */
function previewWidthFor(tileWidth: number, entry: FileEntry): number {
  const ratio = entry.previewAspectRatio ?? DEFAULT_PREVIEW_RATIO;
  return Math.round(Math.min(tileWidth - GLYPH_BOX_INSET * 2, GLYPH_BOX_HEIGHT * ratio));
}

/** A tile's content rect, captured via `onLayout` for the scrub's hit-test. */
type TileRect = { x: number; y: number; width: number; height: number };

type MobileGridTileProps = Pick<
  FileSystemViewProps,
  'loadPreviewImageUrl' | 'pageUrlCache' | 'renderEntryIcon' | 'renderFilePreview'
> & {
  draggable: boolean;
  ensureChildren?: (folderPath: string) => void;
  entry: FileSystemEntry;
  isSelected: boolean;
  selecting: boolean;
  tileWidth: number;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onExternalDrop?: (event: FileSystemExternalDropEvent) => void;
  onMove?: (event: FileSystemMoveEvent) => void;
  onSelectLongPress: ((entry: FileSystemEntry) => void) | undefined;
  onScrubStart: (entry: FileSystemEntry, x: number, y: number) => void;
  onScrubMove: (x: number, y: number) => void;
  onScrubEnd: () => void;
  onTileLayout: (entry: FileSystemEntry, rect: TileRect) => void;
  onToggleSelect: (entry: FileSystemEntry) => void;
  getContextMenuActions?: FileSystemViewProps['getContextMenuActions'];
  onContextMenuAction?: FileSystemViewProps['onContextMenuAction'];
  testID?: string;
};

/** One tile: a tappable glyph + two-line name, with the kebab/checkbox overlaid to the right of the name. */
function MobileGridTile({
  draggable,
  ensureChildren,
  entry,
  getContextMenuActions,
  isSelected,
  loadPreviewImageUrl,
  onActivate,
  onContextMenuAction,
  onExternalDrop,
  onMove,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
  onSelectLongPress,
  onTileLayout,
  onToggleSelect,
  pageUrlCache,
  renderEntryIcon,
  renderFilePreview,
  selecting,
  tileWidth,
  testID,
}: MobileGridTileProps) {
  const colors = useThemeColors();
  const isFile = entry.kind === 'file';

  // The body has no menu of its own — the kebab is the menu. Passing no
  // `getContextMenuActions` keeps `HoldContextMenu` inert (empty items), so a
  // hold fires only `onHoldAction` (the multi-select toggle) rather than a panel.
  const { handleOpenChange, handlePress, handlePressIn, menuProps, onHoldAction } = useFileSystemRowInteraction({
    entry,
    getContextMenuActions: undefined,
    onActivate,
    onContextMenuAction: undefined,
    onSelectLongPress,
  });

  // `dragOptions` upgrades the inert hold to a `<HoldDraggable>`: the hold still
  // toggles the selection, then a move past the escape slop lifts the multi-drag
  // payload. Undefined when dragging is off, which keeps the hold a plain
  // `Holdable` with no drag at all.
  const dragOptions = useFileSystemDragOptions(entry, draggable);
  // Every tile the drag carries fades, not just the one that was grabbed — which
  // is the whole point of dragging a selection.
  const isDragSource = useIsLifting(entry.path);
  // The source wears the selected face for the length of the drag, so the tiles
  // the drag came from are not the only cells on screen with no mark at all.
  const showsSelected = isSelected || isDragSource;

  // The scrub's hit-test reads each tile's content rect, so report it on layout. The
  // rect is relative to the flex-wrap content view — the same space `resolveItemAt`
  // maps the finger into.
  const handleTileLayout = useCallback(
    (event: LayoutChangeEvent) => onTileLayout(entry, event.nativeEvent.layout),
    [entry, onTileLayout],
  );

  const tile = (
    <View onLayout={handleTileLayout} style={{ width: tileWidth }}>
      {/* The tappable body: the glyph box then the name. The name row reserves the
          right edge (`pr-7`) for the control overlaid below, so the two never overlap
          and the control is a sibling rather than a button inside a button. */}
      <HoldContextMenu {...menuProps} dragOptions={dragOptions} onHold={onHoldAction} onOpenChange={handleOpenChange}>
        <Pressable
          accessibilityLabel={entry.name}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          // Both, deliberately: native reads `accessibilityState`, RNW maps `aria-selected`.
          aria-selected={isSelected}
          // The tile keeps its slot while dragged and just fades — the same "left
          // behind" cue a desktop file manager gives, and it keeps the grid from
          // reflowing under a drag that may still be cancelled.
          className={cn(isDragSource && DRAG_SOURCE_CLASSNAME)}
          onPress={handlePress}
          // Resets the hold-vs-tap latch on the way in, so a fresh press cannot
          // inherit the previous one's hold (the desktop tiles do the same).
          onPressIn={handlePressIn}
          testID={testID}
        >
          <View
            className={cn('overflow-hidden rounded-lg bg-surface-2', showsSelected && 'bg-info/15')}
            style={{ height: GLYPH_BOX_HEIGHT, width: '100%' }}
          >
            <View className="size-full items-center justify-center p-1">
              {isFile
                ? (renderEntryIcon?.(entry, GLYPH_BOX_HEIGHT) ?? (
                    <FileVisual
                      file={entry}
                      loadPreviewImageUrl={loadPreviewImageUrl}
                      pageUrlCache={pageUrlCache}
                      renderFilePreview={renderFilePreview}
                      width={previewWidthFor(tileWidth, entry)}
                    />
                  ))
                : (renderEntryIcon?.(entry, FOLDER_GLYPH_SIZE) ?? <FileSystemFolderGlyph size={FOLDER_GLYPH_SIZE} />)}
            </View>
          </View>
          <View className="flex-row items-start gap-1 pt-1.5 pr-7">
            <Text className="flex-1 text-left leading-tight" numberOfLines={2} size="xs">
              {entry.pinnedAt ? (
                <>
                  <View className="h-2 w-2">
                    <Pin color={colors.primary} size={8} />
                  </View>{' '}
                </>
              ) : null}
              {entry.name}
              {entry.favoritedAt ? (
                <>
                  {' '}
                  <View className="h-2 w-2">
                    <Heart color={colors.danger} size={8} />
                  </View>
                </>
              ) : null}
            </Text>
          </View>
        </Pressable>
      </HoldContextMenu>
      {/* The kebab/checkbox, laid over the reserved name-row slot like the list view's
          disclosure chevron — a sibling, never a child of the row button. */}
      <View className="absolute right-0" style={{ top: GLYPH_BOX_HEIGHT + 2 }}>
        <FileSystemMobileMenu
          entry={entry}
          getContextMenuActions={getContextMenuActions}
          isSelected={isSelected}
          onContextMenuAction={onContextMenuAction}
          onScrubStart={onScrubStart}
          onScrubMove={onScrubMove}
          onScrubEnd={onScrubEnd}
          onToggleSelect={onToggleSelect}
          selecting={selecting}
          testID={testID}
        />
      </View>
    </View>
  );

  // A file tile is never a drop target. A folder tile keeps its dropzone mounted
  // whether or not dragging is on — `disabled` refuses everything when it is
  // not, because swapping the wrapper for a plain View on a prop change is a
  // structural DOM mutation that can tear an in-flight drag down.
  if (entry.kind !== 'folder') return tile;

  return (
    <FileSystemDropzone
      destination={entry.path}
      disabled={!draggable}
      onDropCompleted={ensureChildren}
      onExternalDrop={onExternalDrop}
      onMove={onMove}
    >
      {({ isOver }: DragzoneRenderState) => (
        <>
          {tile}
          {isOver ? <View className="pointer-events-none absolute inset-0 z-[3] rounded-md border-2 border-info" /> : null}
        </>
      )}
    </FileSystemDropzone>
  );
}

export function FileSystemMobileGridView({
  draggable = false,
  ensureChildren,
  entries,
  getContextMenuActions,
  loadPreviewImageUrl,
  onContextMenuAction,
  onDeselectMarquee,
  onExternalDrop,
  onMarquee,
  onMove,
  onOpen,
  onSelect,
  pageUrlCache,
  renderEntryIcon,
  renderFilePreview,
  selectedPaths,
  selectionMode,
  testID,
}: FileSystemViewProps) {
  const [width, setWidth] = useState(0);

  // Tiles render in entry order, so the entry list *is* the Shift-range ordering.
  const orderedPaths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  // Only the hold is borrowed from the shared activation hook: a long press is
  // the touch way into multi-select. The tap is this view's own — see below.
  const { onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);

  const selecting = selectedPaths.size > 0;
  const toggleSelect = useCallback(
    (entry: FileSystemEntry) => onSelect(entry, { additive: true }, orderedPaths),
    [onSelect, orderedPaths],
  );

  // A single tap opens the entry outright — a phone has no double-click, so the
  // tap must not first select. Only a hold enters selection mode; once anything
  // is selected a tap toggles that entry's selection, the standard mobile
  // file-manager behaviour (the checkboxes are the toggle surface, and the tile
  // tap mirrors them).
  const activate = useCallback(
    (entry: FileSystemEntry) => {
      if (selecting) toggleSelect(entry);
      else onOpen(entry);
    },
    [onOpen, selecting, toggleSelect],
  );

  // Scrub geometry. Tiles vary in height (one- or two-line names), so each reports
  // its own content rect for the hit-test. The finger→content mapping is calibrated
  // at drag start against the start entry's checkbox — whose content position is
  // `rect` plus the trailing-control inset below the glyph box, and whose window
  // position the gesture reports at `onStart`. The offset turns every later
  // `absoluteX`/`absoluteY` straight into content space, with no `measureInWindow`
  // and no scroll bookkeeping to drift.
  const scrubOriginRef = useRef<{ x: number; y: number } | null>(null);
  const tileRectsRef = useRef<Map<string, TileRect>>(new Map());

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const handleTileLayout = useCallback((entry: FileSystemEntry, rect: TileRect) => {
    tileRectsRef.current.set(entry.path, rect);
  }, []);

  const resolveItemAt = useCallback((x: number, y: number) => {
    const origin = scrubOriginRef.current;
    if (origin === null) return null;
    const contentX = x - origin.x;
    const contentY = y - origin.y;
    for (const [path, rect] of tileRectsRef.current) {
      const insideX = contentX >= rect.x && contentX < rect.x + rect.width;
      const insideY = contentY >= rect.y && contentY < rect.y + rect.height;
      if (insideX && insideY) return path;
    }
    return null;
  }, []);

  const {
    begin,
    move: moveScrub,
    end: endScrub,
  } = useFileSystemScrubSession({
    orderedPaths,
    selectedPaths,
    onMarquee,
    onDeselectMarquee,
    resolveItemAt,
  });

  const beginScrub = useCallback(
    (entry: FileSystemEntry, x: number, y: number) => {
      const rect = tileRectsRef.current.get(entry.path);
      // A tile that never laid out can't be calibrated against; skip starting the
      // scrub, so the session stays inert rather than mis-resolving every later move.
      if (rect === undefined) return;
      // The trailing control is `size-7`, right-aligned, its top `GLYPH_BOX_HEIGHT + 2`
      // below the tile top — so its centre is the one content point the finger is on.
      const centerX = rect.x + rect.width - TRAILING_CONTROL_SIZE / 2;
      const centerY = rect.y + GLYPH_BOX_HEIGHT + 2 + TRAILING_CONTROL_SIZE / 2;
      scrubOriginRef.current = { x: x - centerX, y: y - centerY };
      begin(entry);
    },
    [begin],
  );

  const tileWidth =
    width > 0 ? Math.max(0, Math.floor((width - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS)) : 0;

  const containerRef = useRef<View | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollOffsetRef = useRef(0);

  // A drag near the top or bottom edge scrolls the grid, so a folder below the
  // fold is reachable without releasing. Runs for external drags too.
  const scrollTo = useCallback((offset: number) => scrollRef.current?.scrollTo({ y: offset, animated: false }), []);
  useFileSystemDragScroll({ containerRef, enabled: draggable, scrollOffsetRef, scrollTo });

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  return (
    <View className="min-h-0 flex-1" onLayout={handleLayout} ref={containerRef}>
      <ScrollView
        className="flex-1"
        onScroll={onScroll}
        ref={scrollRef}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        // This grid is nested inside the consumer's own ScrollView (the native
        // storybook decorator wraps every story in one). Android only scrolls a
        // child of a scroll container when the child opts into nested scrolling —
        // iOS and web handle the nesting natively — so without this the grid
        // would not scroll at all in the APK.
        nestedScrollEnabled={true}
      >
        {tileWidth > 0 ? (
          <View className="flex-row flex-wrap" style={{ columnGap: GRID_GAP, padding: GRID_PADDING, rowGap: 12 }}>
            {entries.map((entry) => (
              <MobileGridTile
                draggable={draggable}
                ensureChildren={ensureChildren}
                entry={entry}
                getContextMenuActions={getContextMenuActions}
                isSelected={selectedPaths.has(entry.path)}
                key={entry.path}
                loadPreviewImageUrl={loadPreviewImageUrl}
                onActivate={activate}
                onContextMenuAction={onContextMenuAction}
                onExternalDrop={onExternalDrop}
                onMove={onMove}
                onScrubStart={beginScrub}
                onScrubMove={moveScrub}
                onScrubEnd={endScrub}
                onSelectLongPress={selectLongPress}
                onTileLayout={handleTileLayout}
                onToggleSelect={toggleSelect}
                pageUrlCache={pageUrlCache}
                renderEntryIcon={renderEntryIcon}
                renderFilePreview={renderFilePreview}
                selecting={selecting}
                testID={fileSystemEntryTestID(testID, entry.path)}
                tileWidth={tileWidth}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
