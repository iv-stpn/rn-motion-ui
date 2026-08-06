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
import { useFileSystemEntries, useFileSystemSelection } from './file-system-context';
import { fileSystemDragData, fileSystemDragItems, fileSystemDragLabel } from './file-system-drag';

type FileSystemGroupGhostProps = { label: string };

/**
 * The ghost for a multi-entry drag: one chip naming the count.
 *
 * A single-entry drag has no ghost of its own here — `renderPreview` returns
 * nothing for it, and a `<Draggable>` given no preview lifts a copy of its own
 * child. So dragging one row shows that row, which is both free and the better
 * picture. A group has no such picture to show, and the grabbed row alone would
 * misreport what is moving.
 *
 * `self-start` because the manager pins the ghost to the source's measured box —
 * a full-width row — and a chip stretched across it would read as a bar.
 */
function FileSystemGroupGhost({ label }: FileSystemGroupGhostProps) {
  return (
    <View className="self-start rounded-md border border-border bg-surface-4 px-2 py-1">
      <Text className="text-foreground" numberOfLines={1} size="xs">
        {label}
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
      return <FileSystemGroupGhost label={fileSystemDragLabel(fileSystemDragItems(index, paths))} />;
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
