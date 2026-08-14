/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the tile, its glyph box and its name row are one render layer */
// The mobile grid view: a two-column thumbnail grid for touch.
//
// Unlike the desktop `icons` view this one carries no drag, marquee or hover —
// a phone has no right button to summon a menu, so each tile shows a visible
// kebab instead, and long-press is the way into multi-select. Once anything is
// selected every kebab becomes a checkbox (see `FileSystemMobileMenu`), which is
// the classic mobile file-manager idiom.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { HeartFill as Heart } from 'rn-motion-ui-icons/icons/heart-fill';
import { PinFill as Pin } from 'rn-motion-ui-icons/icons/pin-fill';
import { cn } from '../../../../lib/cn';
import { useThemeColors } from '../../../../theme/use-theme-color';
import { HoldContextMenu } from '../../../menus/HoldContextMenu/hold-context-menu';
import { Text } from '../../../typography/Text/text';
import { FileSystemFolderGlyph } from '../../FileIcon/file-icons';
import { useEntryActivation } from '../hooks/use-entry-activation';
import { useFileSystemRowInteraction } from '../hooks/use-file-system-row-interaction';
import { useFileSystemScrubSession } from '../hooks/use-file-system-scrub';
import { fileSystemEntryTestID } from '../logic/file-system-test-id';
import type { FileEntry, FileSystemEntry, FileSystemViewProps } from '../types/file-system.types';
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
  entry: FileSystemEntry;
  isSelected: boolean;
  selecting: boolean;
  tileWidth: number;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
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
  entry,
  getContextMenuActions,
  isSelected,
  loadPreviewImageUrl,
  onActivate,
  onContextMenuAction,
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
  const { handleOpenChange, handlePress, menuProps, onHoldAction } = useFileSystemRowInteraction({
    entry,
    getContextMenuActions: undefined,
    onActivate,
    onContextMenuAction: undefined,
    onSelectLongPress,
  });

  // The scrub's hit-test reads each tile's content rect, so report it on layout. The
  // rect is relative to the flex-wrap content view — the same space `resolveItemAt`
  // maps the finger into.
  const handleTileLayout = useCallback(
    (event: LayoutChangeEvent) => onTileLayout(entry, event.nativeEvent.layout),
    [entry, onTileLayout],
  );

  return (
    <View onLayout={handleTileLayout} style={{ width: tileWidth }}>
      {/* The tappable body: the glyph box then the name. The name row reserves the
          right edge (`pr-7`) for the control overlaid below, so the two never overlap
          and the control is a sibling rather than a button inside a button. */}
      <HoldContextMenu {...menuProps} onHold={onHoldAction} onOpenChange={handleOpenChange}>
        <Pressable
          accessibilityLabel={entry.name}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          // Both, deliberately: native reads `accessibilityState`, RNW maps `aria-selected`.
          aria-selected={isSelected}
          onPress={handlePress}
          testID={testID}
        >
          <View
            className={cn('overflow-hidden rounded-lg bg-surface-2', isSelected && 'bg-surface-selected')}
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
}

export function FileSystemMobileGridView({
  entries,
  getContextMenuActions,
  loadPreviewImageUrl,
  onContextMenuAction,
  onDeselectMarquee,
  onMarquee,
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
  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);

  const selecting = selectedPaths.size > 0;
  const toggleSelect = useCallback(
    (entry: FileSystemEntry) => onSelect(entry, { additive: true }, orderedPaths),
    [onSelect, orderedPaths],
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

  return (
    <View className="min-h-0 flex-1" onLayout={handleLayout}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {tileWidth > 0 ? (
          <View className="flex-row flex-wrap" style={{ columnGap: GRID_GAP, padding: GRID_PADDING, rowGap: 12 }}>
            {entries.map((entry) => (
              <MobileGridTile
                entry={entry}
                getContextMenuActions={getContextMenuActions}
                isSelected={selectedPaths.has(entry.path)}
                key={entry.path}
                loadPreviewImageUrl={loadPreviewImageUrl}
                onActivate={activate}
                onContextMenuAction={onContextMenuAction}
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
