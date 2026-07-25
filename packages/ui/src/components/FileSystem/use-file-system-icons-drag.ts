// Drag-and-drop session for FileSystemIconsView.
//
// Wraps useFileSystemDrag with a 2-D grid resolver so the icons view doesn't
// have to inline any session logic. Both the entry index and the grabbed tile's
// top-left corner come out of the same `tileAt` call, so the ghost the view
// draws sits exactly where the tile it lifted was. The caller owns columnsRef
// and tileWidthRef and must keep them current on every render so the resolver
// always sees the latest grid metrics without causing the session to rebuild.

import { useCallback, useMemo } from 'react';
import type { Animated, FlatList, View } from 'react-native';
import type { FileSystemEntry, FileSystemMoveEvent } from './file-system.types';
import { tileAt } from './file-system-icons-grid';
import type { FileSystemRow } from './file-system-rows';
import type { FileSystemDragRender, FileSystemGrabAnchor } from './use-file-system-drag';
import { useFileSystemDrag } from './use-file-system-drag';
import { useFileSystemDragWeb } from './use-file-system-drag-web';

export type UseIconsDragReturn = {
  drag: FileSystemDragRender;
  /** The entry being dragged, or null — what the view renders as the drag ghost. */
  draggedEntry: FileSystemEntry | null;
  /** Path of the folder currently under the pointer, or null. */
  dragTargetPath: string | null;
  /** Live reads, not render state — the hover highlight polls these on the pointer path. */
  getTargetIndex: () => number | null;
  isDragging: () => boolean;
  // biome-ignore lint/suspicious/noExplicitAny: RNGH types vary by version
  nativeGesture: any | null;
  previewPos: Animated.ValueXY;
};

export type UseIconsDragParams = {
  /** Ref kept current by the caller — read inside the resolvers without causing re-fires. */
  columnsRef: React.MutableRefObject<number>;
  containerHeightRef: React.MutableRefObject<number>;
  containerRef: React.RefObject<View | null>;
  enabled: boolean;
  entries: FileSystemEntry[];
  flatListRef: React.RefObject<FlatList | null>;
  onMove?: (event: FileSystemMoveEvent) => void;
  scrollOffsetRef: React.MutableRefObject<number>;
  /** Ref kept current by the caller — read inside the resolvers without causing re-fires. */
  tileWidthRef: React.MutableRefObject<number>;
};

export function useIconsViewDrag({
  columnsRef,
  containerHeightRef,
  containerRef,
  enabled,
  entries,
  flatListRef,
  onMove,
  scrollOffsetRef,
  tileWidthRef,
}: UseIconsDragParams): UseIconsDragReturn {
  const dragRows = useMemo<FileSystemRow[]>(
    () => entries.map((entry) => ({ entry, isExpandable: false, isExpanded: false, level: 0 })),
    [entries],
  );

  // Both resolvers read the three refs rather than closing over values, so they
  // stay correct across resizes and scrolls without rebuilding the session.
  const toEntryIndex = useCallback(
    (localX: number, localY: number) =>
      tileAt(localX, localY, {
        columns: columnsRef.current,
        scrollOffset: scrollOffsetRef.current,
        tileWidth: tileWidthRef.current,
      }).index,
    [columnsRef, scrollOffsetRef, tileWidthRef],
  );

  const getGrabAnchor = useCallback(
    (localX: number, localY: number): FileSystemGrabAnchor => {
      const { x, y } = tileAt(localX, localY, {
        columns: columnsRef.current,
        scrollOffset: scrollOffsetRef.current,
        tileWidth: tileWidthRef.current,
      });
      return { x, y };
    },
    [columnsRef, scrollOffsetRef, tileWidthRef],
  );

  const { drag, nativeGesture, previewPos, session } = useFileSystemDrag({
    containerHeightRef,
    enabled,
    flatListRef,
    getGrabAnchor,
    onMove,
    rows: dragRows,
    scrollOffsetRef,
    toEntryIndex,
  });
  useFileSystemDragWeb({ containerRef, enabled, session });

  const targetIdx = drag.targetIndex;
  const dragTargetPath = targetIdx === null ? null : (dragRows[targetIdx]?.entry.path ?? null);
  const draggedIdx = drag.draggedIndex;
  const draggedEntry = draggedIdx === null ? null : (dragRows[draggedIdx]?.entry ?? null);

  return {
    drag,
    draggedEntry,
    dragTargetPath,
    getTargetIndex: session.getTargetIndex,
    isDragging: session.isActive,
    nativeGesture,
    previewPos,
  };
}
