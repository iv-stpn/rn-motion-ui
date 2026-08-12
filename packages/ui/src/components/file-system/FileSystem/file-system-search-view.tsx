// biome-ignore-all lint/style/useExportsLast: props types sit with their components
// biome-ignore-all lint/style/useComponentExportOnlyModules: exports utils

// Flat results list shown while a search query is active. Replaces the normal
// view so every match at every folder depth is visible at once.
//
// The list itself is `entries`, built by the store with `flatSearchResults` (see
// file-system-search.ts) — so the rows here, the status bar's count and what
// `renderBody` is handed are one list rather than three computations of it. How
// wide the query reached is the store's business too: `searchScope` decides
// whether it ran over the open folder's subtree or the whole manifest.
//
// Every row carries a breadcrumb trail under its name, root included — a result
// list is read by scanning for where each hit lives, and a row that dropped the
// line at the root would answer that question for some rows and not others. The
// root segment is named by `rootLabel`, so the trail says "Documents" rather
// than starting mid-path.
//
// Whatever the query matched is highlighted in place, in the name and in the
// trail both: a folder can be the reason a row is here (its own name matched),
// and pointing at the match is what makes a long list scannable.

import { Fragment, type ReactNode, useCallback, useMemo } from 'react';
import { FlatList, type GestureResponderEvent, type ListRenderItemInfo, Pressable, View } from 'react-native';
import { RightLine as ChevronRight } from 'rn-motion-ui-icons/icons/right-line';
import { cn } from '../../../lib/cn';
import { ThemedIcon } from '../../icon/themed-icon';
import { HoldContextMenu } from '../../menus/HoldContextMenu/hold-context-menu';
import { Text } from '../../typography/Text/text';
import { FileSystemFolderGlyph, FileTypeIcon } from '../FileIcon/file-icons';
import type { FileSystemContextMenuAction, FileSystemEntry, FileSystemItem } from './file-system.types';
import { buildCrumbs, CRUMB_SEPARATOR, splitSearchMatches } from './file-system-search';
import { fileSystemEntryTestID } from './file-system-test-id';
import type { FileSystemViewProps } from './file-system-view';
import { useEntryActivation } from './use-entry-activation';
import { useFileSystemRowInteraction } from './use-file-system-row-interaction';

const ICON_SIZE = 16;
const FOLDER_GLYPH_SIZE = 18;
/** Two-line row: name above, breadcrumb trail below. */
export const SEARCH_ROW_HEIGHT = 44;

/**
 * Fixed yellow rather than a theme token — a match marker reads as a highlighter
 * pen, and the palette has no yellow: `warning` is orange and carries a meaning
 * this doesn't have. Paired with `text-black` because the fill is the same in
 * both schemes, including behind a selected row's blue.
 */
const MATCH_CLASS = 'bg-[#fde047] text-black'; /* theme-exempt: highlighter yellow, identical in both schemes */

const keyExtractor = (entry: FileSystemEntry) => entry.path;

/**
 * Every mark answers to this id, so a test can count what a query lit up without
 * depending on the class. Fixed rather than derived from the root `testID`, like
 * the drag containers — there is one search list on screen at a time.
 */
export const FS_SEARCH_MATCH_TEST_ID = 'file-system-search-match';

/**
 * `text` with every occurrence of `query` behind a highlighter mark.
 *
 * The shortcut is for one *unmarked* run, not for one run: a label the query
 * matches end to end is a single segment too, and returning it as plain text
 * there would leave the most exact hit in the list as the only one not marked.
 */
function highlightMatches(text: string, query: string): ReactNode {
  const segments = splitSearchMatches(text, query);
  if (segments.length === 1 && !segments[0]?.isMatch) return text;

  return segments.map((segment) =>
    segment.isMatch ? (
      <Text className={MATCH_CLASS} key={segment.offset} testID={FS_SEARCH_MATCH_TEST_ID}>
        {segment.text}
      </Text>
    ) : (
      segment.text
    ),
  );
}

type SearchRowProps = {
  entry: FileSystemEntry;
  getContextMenuActions?: (item: FileSystemItem) => FileSystemContextMenuAction[];
  isSelected: boolean;
  onActivate: (entry: FileSystemEntry, event?: GestureResponderEvent) => void;
  onContextMenuAction?: (action: FileSystemContextMenuAction, item: FileSystemItem) => void | Promise<void>;
  onSelectLongPress?: (entry: FileSystemEntry) => void;
  /** Label for the leading crumb — see `FileSystemProps.rootLabel`. */
  rootLabel: string;
  /** Normalized query, highlighted wherever it appears in the name or the trail. */
  searchQuery: string;
  testID?: string;
};

function SearchRow({
  entry,
  getContextMenuActions,
  isSelected,
  onActivate,
  onContextMenuAction,
  onSelectLongPress,
  rootLabel,
  searchQuery,
  testID,
}: SearchRowProps) {
  const { handleOpenChange, handlePress, handlePressIn, menuProps, onHoldAction } = useFileSystemRowInteraction({
    entry,
    getContextMenuActions,
    onActivate,
    onContextMenuAction,
    onSelectLongPress,
  });

  const textClass = isSelected ? 'text-white' : 'text-foreground';
  const metaClass = isSelected ? 'text-white' : 'text-muted-foreground';
  // Dimmer than the crumbs it sits between, so the trail reads as segments
  // rather than as one run of words.
  const separatorClass = isSelected ? 'text-white/60' : 'text-muted-foreground/60';
  // Always at least one crumb: an entry sitting at the root still gets the root
  // label, so every row says where it lives.
  const crumbs = buildCrumbs(entry.parentPath, rootLabel);

  return (
    <HoldContextMenu {...menuProps} onHold={onHoldAction} onOpenChange={handleOpenChange}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        aria-selected={isSelected}
        className={cn('flex-row items-center gap-2.5 rounded-md px-3', isSelected && 'bg-info')}
        onPress={handlePress}
        onPressIn={handlePressIn}
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
            {highlightMatches(entry.name, searchQuery)}
          </Text>
          <Text className={metaClass} numberOfLines={1} size="xs">
            {crumbs.map((crumb, index) => (
              <Fragment key={crumb.key}>
                {index > 0 ? <Text className={separatorClass}>{` ${CRUMB_SEPARATOR} `}</Text> : null}
                {highlightMatches(crumb.label, searchQuery)}
              </Fragment>
            ))}
          </Text>
        </View>
        {entry.kind === 'folder' ? (
          <ThemedIcon icon={ChevronRight} token={isSelected ? 'white' : 'muted-foreground'} size={14} />
        ) : null}
      </Pressable>
    </HoldContextMenu>
  );
}

export function FileSystemSearchView({
  entries,
  getContextMenuActions,
  onContextMenuAction,
  onOpen,
  onSelect,
  rootLabel,
  searchQuery,
  selectedPaths,
  selectionMode,
  testID,
}: FileSystemViewProps) {
  // `entries` is already the flat hit list while a query is live — the store
  // builds it with `flatSearchResults` so the rows drawn here, the status bar's
  // count and `renderBody` are the same list rather than three computations of it.
  const orderedPaths = useMemo(() => entries.map((e) => e.path), [entries]);

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
        rootLabel={rootLabel}
        searchQuery={searchQuery}
        testID={fileSystemEntryTestID(testID, item.path)}
      />
    ),
    [activate, getContextMenuActions, onContextMenuAction, rootLabel, searchQuery, selectedPaths, selectLongPress, testID],
  );

  // No empty branch here: `FileSystemBodyContent` yields to the placeholder
  // before mounting a view whenever `entries` is empty and a query is live, so
  // this list never renders zero rows.
  return (
    <Pressable className="min-h-0 flex-1" onPress={handleBackgroundPress}>
      <FlatList
        className="flex-1"
        contentContainerClassName="px-2 py-1"
        data={entries}
        getItemLayout={getItemLayout}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </Pressable>
  );
}
