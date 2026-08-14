/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the view and its row/overlay parts are one render layer */
// The mobile list view: a flat two-line list for touch.
//
// No header, no disclosure tree, no drag and no hover — a phone has no right
// button and no column header to click. Each row carries a visible kebab (the
// same `FileSystemMobileMenu` the grid tiles use), and long-press is the way into
// multi-select: once anything is selected the kebab yields to a checkbox.

import { useCallback, useMemo, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';
import { FlatList, Pressable, View } from 'react-native';
import { HeartFill as Heart } from 'rn-motion-ui-icons/icons/heart-fill';
import { PinFill as Pin } from 'rn-motion-ui-icons/icons/pin-fill';
import { cn } from '../../../../lib/cn';
import { useThemeColors } from '../../../../theme/use-theme-color';
import { HoldContextMenu } from '../../../menus/HoldContextMenu/hold-context-menu';
import { Text } from '../../../typography/Text/text';
import { FileSystemFolderGlyph, FileTypeIcon } from '../../FileIcon/file-icons';
import { useEntryActivation } from '../hooks/use-entry-activation';
import { useFileSystemRowInteraction } from '../hooks/use-file-system-row-interaction';
import { useFileSystemScrubSession } from '../hooks/use-file-system-scrub';
import { formatFileSystemStats } from '../logic/file-system-format';
import { fileSystemEntryTestID } from '../logic/file-system-test-id';
import type { FileSystemEntry, FileSystemViewProps } from '../types/file-system.types';
import { FileSystemMobileMenu } from './file-system-mobile-menu';

/** A two-line row, taller than the desktop list's single line. */
const MOBILE_ROW_HEIGHT = 56;
const ICON_SIZE = 22;
const FOLDER_GLYPH_SIZE = 24;
const PIN_ICON_SIZE = 10;
const FAV_ICON_SIZE = 10;

const keyExtractor = (entry: FileSystemEntry) => entry.path;

/**
 * Fixed-height rows make the `FlatList`'s content height arithmetic, so it can
 * reserve the full scroll extent up front instead of measuring rows as they mount —
 * the same `getItemLayout` the desktop list view hands its `FlatList`.
 */
const getItemLayout = (_data: ArrayLike<FileSystemEntry> | null | undefined, index: number) => ({
  length: MOBILE_ROW_HEIGHT,
  offset: MOBILE_ROW_HEIGHT * index,
  index,
});

/** The `FlatList` render-item shape — `item` alone, named so the render prop signature stays readable. */
type MobileListRenderItem = { item: FileSystemEntry };

type MobileListRowProps = {
  childCount: number | undefined;
  entry: FileSystemEntry;
  getContextMenuActions?: FileSystemViewProps['getContextMenuActions'];
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: FileSystemViewProps['onContextMenuAction'];
  onSelectLongPress: ((entry: FileSystemEntry) => void) | undefined;
  onToggleSelect: (entry: FileSystemEntry) => void;
  onScrubStart: (entry: FileSystemEntry, x: number, y: number) => void;
  onScrubMove: (x: number, y: number) => void;
  onScrubEnd: () => void;
  renderEntryIcon?: FileSystemViewProps['renderEntryIcon'];
  selecting: boolean;
  testID?: string;
};

/**
 * One row: icon, then a two-line stack (name over stats), with the kebab/checkbox
 * overlaid to the right like the list view's disclosure chevron — a sibling, never
 * a child of the row button, so the two Pressables never nest.
 */
function MobileListRow({
  childCount,
  entry,
  getContextMenuActions,
  isSelected,
  onActivate,
  onContextMenuAction,
  onSelectLongPress,
  onToggleSelect,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
  renderEntryIcon,
  selecting,
  testID,
}: MobileListRowProps) {
  const colors = useThemeColors();

  // The row has no menu of its own — the kebab is the menu. Passing no
  // `getContextMenuActions` keeps `HoldContextMenu` inert (empty items), so a
  // hold fires only `onHoldAction` (the multi-select toggle) rather than a panel.
  const { handleOpenChange, handlePress, menuProps, onHoldAction } = useFileSystemRowInteraction({
    entry,
    getContextMenuActions: undefined,
    onActivate,
    onContextMenuAction: undefined,
    onSelectLongPress,
  });

  const isActive = isSelected;
  const textClassName = isActive ? 'text-white' : 'text-foreground';
  const metaClassName = isActive ? 'text-white' : 'text-muted-foreground';
  const stats = formatFileSystemStats(entry, childCount);

  return (
    <View className={cn('relative', isActive && 'bg-info')} style={{ height: MOBILE_ROW_HEIGHT }}>
      <HoldContextMenu {...menuProps} onHold={onHoldAction} onOpenChange={handleOpenChange}>
        <Pressable
          accessibilityLabel={entry.name}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          // Both, deliberately: native reads `accessibilityState`, RNW maps `aria-selected`.
          aria-selected={isSelected}
          className="flex-row items-center gap-2 px-3 pr-8"
          onPress={handlePress}
          style={{ height: MOBILE_ROW_HEIGHT }}
          testID={testID}
        >
          {entry.kind === 'folder'
            ? (renderEntryIcon?.(entry, FOLDER_GLYPH_SIZE) ?? <FileSystemFolderGlyph size={FOLDER_GLYPH_SIZE} />)
            : (renderEntryIcon?.(entry, ICON_SIZE) ?? <FileTypeIcon fileName={entry.name} size={ICON_SIZE} />)}
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-1">
              {entry.pinnedAt ? <Pin color={isActive ? colors.white : colors.primary} size={PIN_ICON_SIZE} /> : null}
              <Text className={cn('min-w-0 flex-1', textClassName)} numberOfLines={1} size="sm">
                {entry.name}
              </Text>
              {entry.favoritedAt ? <Heart color={isActive ? colors.white : colors.danger} size={FAV_ICON_SIZE} /> : null}
            </View>
            {stats ? (
              <Text className={metaClassName} numberOfLines={1} size="xs">
                {stats}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </HoldContextMenu>
      {/* The kebab/checkbox, laid over the row's reserved right edge. */}
      <View className="absolute right-0 items-center justify-center" style={{ height: MOBILE_ROW_HEIGHT }}>
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

export function FileSystemMobileListView({
  entries,
  getContextMenuActions,
  index,
  onContextMenuAction,
  onDeselectMarquee,
  onMarquee,
  onOpen,
  onSelect,
  renderEntryIcon,
  selectedPaths,
  selectionMode,
  testID,
}: FileSystemViewProps) {
  // Rows render in entry order, so the entry list *is* the Shift-range ordering.
  const orderedPaths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);

  const selecting = selectedPaths.size > 0;
  const toggleSelect = useCallback(
    (entry: FileSystemEntry) => onSelect(entry, { additive: true }, orderedPaths),
    [onSelect, orderedPaths],
  );

  // Scrub geometry. The finger→row mapping is calibrated at drag start against the
  // one point both sides already agree on: the start entry's checkbox, whose content
  // position is `rowIndex * MOBILE_ROW_HEIGHT + MOBILE_ROW_HEIGHT / 2` and whose
  // window position the gesture reports at `onStart`. That offset turns every later
  // `absoluteY` straight into a row — no `measureInWindow`, no scroll bookkeeping,
  // nothing that can drift between the finger's frame and the view's.
  const scrubOriginRef = useRef<{ x: number; y: number } | null>(null);

  const resolveItemAt = useCallback(
    (_x: number, y: number) => {
      const origin = scrubOriginRef.current;
      if (origin === null) return null;
      const contentY = y - origin.y;
      if (contentY < 0) return null;
      const rowIndex = Math.floor(contentY / MOBILE_ROW_HEIGHT);
      return rowIndex >= 0 && rowIndex < orderedPaths.length ? (orderedPaths[rowIndex] ?? null) : null;
    },
    [orderedPaths],
  );

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
    (entry: FileSystemEntry, _x: number, y: number) => {
      const rowIndex = orderedPaths.indexOf(entry.path);
      const checkboxCenterY = rowIndex * MOBILE_ROW_HEIGHT + MOBILE_ROW_HEIGHT / 2;
      scrubOriginRef.current = { x: 0, y: y - checkboxCenterY };
      begin(entry);
    },
    [begin, orderedPaths],
  );

  const renderRow = useCallback(
    ({ item }: MobileListRenderItem) => (
      <MobileListRow
        childCount={index.children.get(item.path)?.length}
        entry={item}
        getContextMenuActions={getContextMenuActions}
        isSelected={selectedPaths.has(item.path)}
        onActivate={activate}
        onContextMenuAction={onContextMenuAction}
        onScrubStart={beginScrub}
        onScrubMove={moveScrub}
        onScrubEnd={endScrub}
        onSelectLongPress={selectLongPress}
        onToggleSelect={toggleSelect}
        renderEntryIcon={renderEntryIcon}
        selecting={selecting}
        testID={fileSystemEntryTestID(testID, item.path)}
      />
    ),
    [
      activate,
      beginScrub,
      endScrub,
      getContextMenuActions,
      index,
      moveScrub,
      onContextMenuAction,
      renderEntryIcon,
      selectedPaths,
      selectLongPress,
      selecting,
      testID,
      toggleSelect,
    ],
  );

  return (
    <View className="min-h-0 flex-1">
      <FlatList
        className="flex-1"
        data={entries}
        extraData={selectedPaths}
        getItemLayout={getItemLayout}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
