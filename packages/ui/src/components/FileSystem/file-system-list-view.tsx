/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
// The list view: a disclosure tree with Name / Date Modified / Size columns.
// The web version drives @pierre/trees; here the rows come from the sorted
// index (see file-system-rows) and render through a FlatList, so the same
// folder-first ordering and per-folder disclosure survive without the DOM.

import { useCallback, useMemo, useState } from 'react';
import { FlatList, type LayoutChangeEvent, type ListRenderItemInfo, Pressable, View } from 'react-native';
import { cn } from '../../lib/cn';
import { ChevronDown, ChevronRight, ChevronUp } from '../../lib/icons';
import { useThemeColors } from '../../theme/use-theme-color';
import { Text } from '../Text/text';
import type {
  FileSystemContextMenuAction,
  FileSystemEntry,
  FileSystemItem,
  FileSystemSortKey,
  FileSystemSortState,
} from './file-system.types';
import { useContextMenu } from './file-system-context-menu';
import { formatByteSize, formatTimestamp } from './file-system-format';
import { FileSystemFolderGlyph, FileTypeIcon } from './file-system-icons';
import type { FileSystemRow } from './file-system-rows';
import { flattenFileSystemRows, toggleExpandedPath } from './file-system-rows';
import type { FileSystemViewProps } from './file-system-view';
import { useEntryActivation } from './use-entry-activation';

const NAME_LABEL = 'Name';
const DATE_LABEL = 'Date Modified';
const SIZE_LABEL = 'Size';
const MISSING_VALUE = '—';

const ROW_HEIGHT = 30;
const INDENT_PER_LEVEL = 14;
/** The chevron lane, reserved on file rows too so names stay aligned. */
const CHEVRON_SIZE = 18;
const ICON_SIZE = 16;
const FOLDER_GLYPH_SIZE = 18;
/** Below this the date column drops out, leaving name + size. */
const DATE_COLUMN_MIN_WIDTH = 420;

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
  const colors = useThemeColors();
  const isActive = sort.key === sortKey;
  const handlePress = useCallback(() => onPress(sortKey), [onPress, sortKey]);
  const DirectionIcon = sort.direction === 'asc' ? ChevronUp : ChevronDown;

  return (
    <Pressable accessibilityRole="button" className={cn('flex-row items-center gap-0.5 py-0.5', className)} onPress={handlePress}>
      <Text className={cn(isActive ? 'text-foreground' : 'text-muted-foreground')} numberOfLines={1} size="xs" weight="medium">
        {label}
      </Text>
      {isActive ? <DirectionIcon color={colors.foreground} size={12} /> : null}
    </Pressable>
  );
}

type ListRowProps = {
  childCount: number | undefined;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onToggleExpanded: (path: string) => void;
  row: FileSystemRow;
  showDate: boolean;
};

/** Disclosure chevron, icon, name, then the metadata columns. */
function ListRow({
  childCount,
  getContextMenuActions,
  isSelected,
  onActivate,
  onContextMenuAction,
  onToggleExpanded,
  row,
  showDate,
}: ListRowProps) {
  const colors = useThemeColors();
  const { entry, isExpandable, isExpanded, level } = row;
  const handlePress = useCallback(() => onActivate(entry), [entry, onActivate]);
  const handleToggle = useCallback(() => onToggleExpanded(entry.path), [entry.path, onToggleExpanded]);
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
  const textClassName = isSelected ? 'text-primary-foreground' : 'text-foreground';
  const metaClassName = isSelected ? 'text-primary-foreground' : 'text-muted-foreground';

  const { wrapperRef, onLongPress, contextMenuNode } = useContextMenu(entry, getContextMenuActions, onContextMenuAction);

  return (
    <View ref={wrapperRef}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpandable ? isExpanded : undefined, selected: isSelected }}
        className={cn('flex-row items-center gap-1 rounded-md px-2', isSelected ? 'bg-primary' : 'hover:bg-surface-hover')}
        onLongPress={onLongPress}
        onPress={handlePress}
        style={{ height: ROW_HEIGHT, paddingLeft: 8 + level * INDENT_PER_LEVEL }}
      >
        {isExpandable ? (
          <Pressable
            accessibilityLabel={isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
            accessibilityRole="button"
            className="items-center justify-center"
            onPress={handleToggle}
            style={{ width: CHEVRON_SIZE }}
          >
            <ChevronIcon color={isSelected ? colors['primary-foreground'] : colors['muted-foreground']} size={14} />
          </Pressable>
        ) : (
          <View style={{ width: CHEVRON_SIZE }} />
        )}
        {entry.kind === 'folder' ? (
          <FileSystemFolderGlyph size={FOLDER_GLYPH_SIZE} />
        ) : (
          <FileTypeIcon fileName={entry.name} size={ICON_SIZE} />
        )}
        <Text className={cn('flex-1', textClassName)} numberOfLines={1} size="sm">
          {entry.name}
        </Text>
        {showDate ? (
          <Text className={cn('w-44', metaClassName)} numberOfLines={1} size="xs">
            {formatTimestamp(entry.updatedAt ?? entry.createdAt) ?? MISSING_VALUE}
          </Text>
        ) : null}
        <Text className={cn('w-20 text-right', metaClassName)} numberOfLines={1} numeric={true} size="xs">
          {entry.kind === 'folder' ? itemCountLabel(childCount) : (formatByteSize(entry.size) ?? MISSING_VALUE)}
        </Text>
        {contextMenuNode}
      </Pressable>
    </View>
  );
}

export function FileSystemListView({
  currentPath,
  getContextMenuActions,
  index,
  onContextMenuAction,
  onOpen,
  onSelect,
  onSortColumnClick,
  selectedPath,
  sort,
}: FileSystemViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [width, setWidth] = useState(0);
  const activate = useEntryActivation(onOpen, onSelect);

  const rows = useMemo(() => flattenFileSystemRows({ currentPath, expanded, index }), [currentPath, expanded, index]);
  const showDate = width === 0 || width >= DATE_COLUMN_MIN_WIDTH;

  const handleLayout = useCallback((event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width), []);
  const toggleExpanded = useCallback((path: string) => setExpanded((previous) => toggleExpandedPath(previous, path)), []);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileSystemRow>) => (
      <ListRow
        childCount={index.children.get(item.entry.path)?.length}
        getContextMenuActions={getContextMenuActions}
        isSelected={item.entry.path === selectedPath}
        onActivate={activate}
        onContextMenuAction={onContextMenuAction}
        onToggleExpanded={toggleExpanded}
        row={item}
        showDate={showDate}
      />
    ),
    [activate, getContextMenuActions, index, onContextMenuAction, selectedPath, showDate, toggleExpanded],
  );

  const keyExtractor = useCallback((row: FileSystemRow) => row.entry.path, []);
  const getItemLayout = useCallback(
    (_data: ArrayLike<FileSystemRow> | null | undefined, itemIndex: number) => ({
      index: itemIndex,
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * itemIndex,
    }),
    [],
  );

  return (
    <View className="min-h-0 flex-1" onLayout={handleLayout}>
      {/* The header's left padding matches a level-0 row: chevron lane + icon. */}
      <View className="shrink-0 flex-row items-center gap-1 border-border border-b py-1 pr-2 pl-2">
        <View style={{ width: CHEVRON_SIZE + ICON_SIZE + 4 }} />
        <ColumnHeader className="flex-1" label={NAME_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="name" />
        {showDate ? (
          <ColumnHeader className="w-44" label={DATE_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="updatedAt" />
        ) : null}
        <ColumnHeader className="w-20 justify-end" label={SIZE_LABEL} onPress={onSortColumnClick} sort={sort} sortKey="size" />
      </View>
      <FlatList
        className="flex-1"
        contentContainerClassName="py-1"
        data={rows}
        getItemLayout={getItemLayout}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
