/** biome-ignore-all lint/style/useComponentExportOnlyModules: the ghost is only ever rendered by the scope below it */
// The one <MultiDragManager> every FileSystem drag runs under.
//
// Three jobs, all of which need a place in the tree rather than a hook:
//
// 1. The selection. A row knows it is selected; it does not know the other two
//    selected rows exist. The manager holds the set, so lifting any member carries
//    all of them and the ones left behind can ask `useIsLifting` whether they are
//    moving too.
// 2. The payload. `getGroupData` resolves paths against the index once per lift, so
//    every destination reads the same entries off the transfer no matter which view
//    the drop landed in — or whether it landed in this component at all.
// 3. The ghost's frame. Every view drags out of a scroll container, and a ghost
//    drawn inside one is clipped at its edge. The manager draws it in its own box
//    instead, which spans the whole file area.

import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { View } from 'react-native';
import { MultiDragManager } from '../../gestures/DragManager/multi-drag-manager';
import { Text } from '../../typography/Text/text';
import { FileSystemFolderGlyph, FileTypeIcon } from './FileIcon/file-icons';
import { useFileSystemEntries, useFileSystemSelection } from './file-system-context';
import { type FileSystemDragItem, fileSystemDragData, fileSystemDragItems, fileSystemDragLabel } from './file-system-drag';

type FileSystemGroupGhostProps = { items: readonly FileSystemDragItem[] };

/** Sizing for the icons inside a group ghost chip. */
const GHOST_ICON_SIZE = 14;
const GHOST_FOLDER_GLYPH_SIZE = 14;
/** How far each stacked icon offsets from the one beneath it (px). */
const STACK_OFFSET = 6;
/** How many items to show in the stack. */
const STACK_DEPTH = 3;

/**
 * The ghost for a multi-entry drag: a visual stack of (at most) the first three
 * items, plus a count label.
 *
 * Each icon is a folder glyph or a file-type icon — no thumbnail lookup, because
 * the drag payload carries only names and paths, not URLs. The stack reads like
 * the physical deck of items a file manager would show under the cursor.
 *
 * A single-entry drag has no ghost of its own here — `renderPreview` returns
 * nothing for it, and a `<Draggable>` given no preview lifts a copy of its own
 * child. So dragging one row shows that row, which is both free and the better
 * picture.
 */
function FileSystemGroupGhost({ items }: FileSystemGroupGhostProps) {
  const visible = items.slice(0, STACK_DEPTH);

  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-md border border-border bg-surface-4 px-2 py-1.5">
      {/* Stacked icon deck: back-to-front, each offset slightly right of the last. */}
      <View
        className="relative"
        style={{
          height: GHOST_ICON_SIZE + STACK_OFFSET * (visible.length - 1),
          width: GHOST_ICON_SIZE + STACK_OFFSET * (visible.length - 1),
        }}
      >
        {visible.map((item, i) => {
          const left = i * STACK_OFFSET;
          const top = (visible.length - 1 - i) * STACK_OFFSET;
          return (
            <View
              className="absolute rounded-sm bg-surface-2"
              key={item.path}
              style={{ height: GHOST_ICON_SIZE, left, top, width: GHOST_ICON_SIZE }}
            >
              {item.kind === 'folder' ? (
                <FileSystemFolderGlyph size={GHOST_FOLDER_GLYPH_SIZE} />
              ) : (
                <FileTypeIcon fileName={item.name} size={GHOST_ICON_SIZE} />
              )}
            </View>
          );
        })}
      </View>
      <Text className="text-foreground" numberOfLines={1} size="xs">
        {fileSystemDragLabel(items)}
      </Text>
    </View>
  );
}

export type FileSystemDragScopeProps = { children: ReactNode };

/**
 * Wraps the file area in the manager its `<MultiDraggable>`s and `<Dragzone>`s
 * need. Mounted once, around the body, by `<FileSystem>` itself.
 *
 * **Not isolated.** A drag lifted here can land on any `<Dragzone>` on the page:
 * a sidebar's trash, an upload panel, the other pane of a two-pane manager. That
 * is the point of publishing the entries under a MIME type rather than passing
 * them in memory, and a zone that does not want them refuses in its own `accepts`.
 * The flip side is that two FileSystems on one page can drop into each other —
 * correct when they show the same tree, and a consumer that means them to be
 * independent isolates them with a `<DragManager isolate>` of its own.
 */
export function FileSystemDragScope({ children }: FileSystemDragScopeProps) {
  const { index } = useFileSystemEntries();
  const { selectedPaths } = useFileSystemSelection();

  // Resolved against the index at lift time rather than carried on each row: a
  // group's payload has to describe entries whose own components were never asked
  // anything, and only the index has all of them.
  const getGroupData = useCallback((paths: readonly string[]) => fileSystemDragData(fileSystemDragItems(index, paths)), [index]);

  const renderPreview = useCallback(
    (paths: readonly string[]) => {
      if (paths.length < 2) return null;
      return <FileSystemGroupGhost items={fileSystemDragItems(index, paths)} />;
    },
    [index],
  );

  return (
    <MultiDragManager
      className="min-h-0 flex-1"
      getGroupData={getGroupData}
      renderPreview={renderPreview}
      selectedIds={selectedPaths}
    >
      {children}
    </MultiDragManager>
  );
}
