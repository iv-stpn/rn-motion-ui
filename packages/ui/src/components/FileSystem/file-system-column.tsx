/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// One pane of the columns view: a fixed-width, vertically scrolling list of a
// single folder's children. Memoized on scalar selection props so pressing
// into a deep trail only re-renders the columns whose rows actually change.

import React, { useCallback } from 'react';
import { FlatList, Image, type ListRenderItemInfo, Pressable, View } from 'react-native';
import { cn } from '../../lib/cn';
import { ChevronRight } from '../../lib/icons';
import { useThemeColors } from '../../theme/use-theme-color';
import { Text } from '../Text/text';
import type { FileSystemContextMenuAction, FileSystemEntry, FileSystemIndex, FileSystemItem } from './file-system.types';
import { useContextMenu } from './file-system-context-menu';
import { FileSystemFolderGlyph, FileTypeIcon } from './file-system-icons';
import { filePreviewUrls, folderHasChildren } from './file-system-index';
import { fileSystemEntryTestID } from './file-system-test-id';
import { FileSystemEmptyState } from './file-system-view';

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

type ColumnRowProps = {
  entry: FileSystemEntry;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  index: FileSystemIndex;
  isOnTrail: boolean;
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
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
  testID,
}: ColumnRowProps) {
  const colors = useThemeColors();
  const handlePress = useCallback(() => onActivate(entry), [entry, onActivate]);
  const hasChildren = entry.kind === 'folder' && folderHasChildren(index, entry);

  const { wrapperRef, onLongPress, contextMenuNode } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);

  return (
    <View ref={wrapperRef} style={{ marginBottom: COLUMN_ROW_GAP }}>
      <Pressable
        accessibilityLabel={entry.name}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        className={cn(
          'flex-row items-center gap-2 rounded-md px-2',
          isSelected && 'bg-primary',
          !isSelected && isOnTrail && 'bg-surface-selected',
          !(isSelected || isOnTrail) && 'hover:bg-surface-hover',
        )}
        onLongPress={onLongPress}
        onPress={handlePress}
        style={{ height: COLUMN_ROW_HEIGHT }}
        testID={testID}
      >
        <ColumnRowGlyph entry={entry} isSelected={isSelected} />
        <Text className={cn('flex-1', isSelected && 'text-primary-foreground')} numberOfLines={1} size="sm">
          {entry.name}
        </Text>
        {hasChildren ? (
          <ChevronRight
            color={isSelected ? colors['primary-foreground'] : colors['muted-foreground']}
            size={COLUMN_CHEVRON_SIZE}
          />
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
  onActivate: (entry: FileSystemEntry) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  /** The selected row when it belongs to this column, else `null`. */
  selectedChildPath: string | null;
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
  onContextMenuAction,
  selectedChildPath,
  testID,
  trailChildPath,
}: FileSystemColumnProps) {
  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemEntry>) => (
      <ColumnRow
        entry={item}
        getContextMenuActions={getContextMenuActions}
        index={index}
        isOnTrail={item.kind === 'folder' && item.path === trailChildPath}
        isSelected={item.path === selectedChildPath}
        onActivate={onActivate}
        onContextMenuAction={onContextMenuAction}
        testID={fileSystemEntryTestID(testID, item.path)}
      />
    ),
    [getContextMenuActions, index, onActivate, onContextMenuAction, selectedChildPath, testID, trailChildPath],
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
    <View className="shrink-0 border-border border-r" style={{ width: COLUMN_WIDTH }}>
      {isLoading && entries.length === 0 ? (
        <FileSystemEmptyState isLoading={true} label={LOADING_LABEL} />
      ) : (
        <FlatList
          contentContainerClassName="p-1.5"
          data={entries}
          getItemLayout={getItemLayout}
          keyExtractor={keyExtractor}
          renderItem={renderRow}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

export const FileSystemColumn = React.memo(FileSystemColumnImpl);
