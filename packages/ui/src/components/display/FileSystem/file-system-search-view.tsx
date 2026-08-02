// biome-ignore-all lint/style/useExportsLast: props types sit with their components
// biome-ignore-all lint/style/useComponentExportOnlyModules: exports utils
// Flat results list shown while a search query is active. Replaces the normal
// view so every match at every folder depth is visible at once. Files are
// always included (they appear in the index only when they matched); folders
// are included only when their own name contains the query, not merely
// because a descendant matched.

import { useCallback, useMemo } from 'react';
import { FlatList, type GestureResponderEvent, type ListRenderItemInfo, Pressable, View } from 'react-native';
import { cn } from '../../../lib/cn';
import { ChevronRight } from '../../../lib/icons';
import { stripTrailingSlash } from '../../../lib/path';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';
import type { FileSystemContextMenuAction, FileSystemEntry, FileSystemIndex, FileSystemItem } from './file-system.types';
import { useContextMenu } from './file-system-context-menu';
import { FileSystemFolderGlyph, FileTypeIcon } from './file-system-icons';
import { fileSystemEntryTestID } from './file-system-test-id';
import type { FileSystemViewProps } from './file-system-view';
import { FileSystemEmptyState } from './file-system-view';
import { useEntryActivation, useEntryLongPress } from './use-entry-activation';

const ICON_SIZE = 16;
const FOLDER_GLYPH_SIZE = 18;
/** Two-line row: name above, parent path below. */
export const SEARCH_ROW_HEIGHT = 44;

/**
 * Flatten the filtered index into a sorted list of direct search matches.
 * Every folder's `children` list has already been pruned to the visible set by
 * `_recomputeEntries`, so we only need to drop ancestor-only folders — those
 * whose own name does not contain the query and are only visible because a
 * descendant matched.
 */
function flatSearchResults(index: FileSystemIndex, searchQuery: string): FileSystemEntry[] {
  const results: FileSystemEntry[] = [];
  const seen = new Set<string>();
  for (const childList of index.children.values()) {
    for (const entry of childList) {
      if (!seen.has(entry.path)) {
        seen.add(entry.path);
        if (entry.kind === 'file' || entry.name.toLowerCase().includes(searchQuery)) results.push(entry);
      }
    }
  }
  // Folders before files; alphabetical within each kind.
  results.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
  return results;
}

const keyExtractor = (entry: FileSystemEntry) => entry.path;

type SearchRowProps = {
  entry: FileSystemEntry;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onSelectLongPress?: (entry: FileSystemEntry) => void;
  testID?: string;
};

function SearchRow({
  entry,
  getContextMenuActions,
  isSelected,
  onActivate,
  onContextMenuAction,
  onSelectLongPress,
  testID,
}: SearchRowProps) {
  const handlePress = useCallback((event: GestureResponderEvent) => onActivate(entry, event), [entry, onActivate]);
  const {
    wrapperRef,
    onLongPress: openContextMenu,
    contextMenuNode,
  } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);
  const onLongPress = useEntryLongPress(entry, onSelectLongPress, openContextMenu);

  const textClass = isSelected ? 'text-white' : 'text-foreground';
  const metaClass = isSelected ? 'text-white' : 'text-muted-foreground';
  // Strip the trailing folder slash; `null` when at root (no second line needed).
  const parentLabel = entry.parentPath ? stripTrailingSlash(entry.parentPath) : null;

  return (
    <View ref={wrapperRef}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        aria-selected={isSelected}
        className={cn('flex-row items-center gap-2.5 rounded-md px-3', isSelected && 'bg-info')}
        onLongPress={onLongPress}
        onPress={handlePress}
        style={{ height: SEARCH_ROW_HEIGHT }}
        testID={testID}
      >
        <View className="items-center justify-center" style={{ width: FOLDER_GLYPH_SIZE }}>
          {entry.kind === 'folder' ? (
            <FileSystemFolderGlyph size={FOLDER_GLYPH_SIZE} />
          ) : (
            <FileTypeIcon fileName={entry.name} size={ICON_SIZE} />
          )}
        </View>
        <View className="flex-1 justify-center gap-0.5">
          <Text className={textClass} numberOfLines={1} size="sm">
            {entry.name}
          </Text>
          {parentLabel ? (
            <Text className={metaClass} numberOfLines={1} size="xs">
              {parentLabel}
            </Text>
          ) : null}
        </View>
        {entry.kind === 'folder' ? (
          <ThemedIcon icon={ChevronRight} token={isSelected ? 'white' : 'muted-foreground'} size={14} />
        ) : null}
        {contextMenuNode}
      </Pressable>
    </View>
  );
}

export function FileSystemSearchView({
  getContextMenuActions,
  index,
  onContextMenuAction,
  onOpen,
  onSelect,
  searchQuery,
  selectedPaths,
  selectionMode,
  testID,
}: FileSystemViewProps) {
  const results = useMemo(() => flatSearchResults(index, searchQuery), [index, searchQuery]);
  const orderedPaths = useMemo(() => results.map((e) => e.path), [results]);

  const { onPress: activate, onLongPress: selectLongPress } = useEntryActivation(onOpen, onSelect, selectionMode, orderedPaths);

  const handleBackgroundPress = useCallback(() => onSelect(null), [onSelect]);
  const getItemLayout = useCallback(
    (_: ArrayLike<FileSystemEntry> | null | undefined, idx: number) => ({
      index: idx,
      length: SEARCH_ROW_HEIGHT,
      offset: SEARCH_ROW_HEIGHT * idx,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemEntry>) => (
      <SearchRow
        entry={item}
        getContextMenuActions={getContextMenuActions}
        isSelected={selectedPaths.has(item.path)}
        onActivate={activate}
        onContextMenuAction={onContextMenuAction}
        onSelectLongPress={selectLongPress}
        testID={fileSystemEntryTestID(testID, item.path)}
      />
    ),
    [activate, getContextMenuActions, onContextMenuAction, selectedPaths, selectLongPress, testID],
  );

  if (results.length === 0) return <FileSystemEmptyState label={`No results for "${searchQuery}"`} />;

  return (
    <Pressable className="min-h-0 flex-1" onPress={handleBackgroundPress}>
      <FlatList
        className="flex-1"
        contentContainerClassName="px-2 py-1"
        data={results}
        getItemLayout={getItemLayout}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </Pressable>
  );
}
