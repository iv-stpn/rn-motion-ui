// Drag-and-drop session for FileSystemIconsView.
//
// Wraps useFileSystemDrag with a 2-D grid index resolver so the icons view
// doesn't have to inline any session logic. The caller owns columnsRef and
// tileWidthRef and must keep them current on every render so the resolver
// always sees the latest grid metrics without causing the session to rebuild.

import { useCallback, useMemo } from 'react';
import type { Animated, FlatList, View } from 'react-native';
import type { FileSystemEntry, FileSystemMoveEvent } from './file-system.types';
import type { FileSystemRow } from './file-system-rows';
import type { FileSystemDragRender } from './use-file-system-drag';
import { useFileSystemDrag } from './use-file-system-drag';
import { useFileSystemDragWeb } from './use-file-system-drag-web';

const GRID_PADDING = 12;
const TILE_GAP = 4;
const ROW_STRIDE = 114; // TILE_HEIGHT (102) + ROW_GAP (12) — mirrors the view constants

export type UseIconsDragReturn = {
  drag: FileSystemDragRender;
  /** Path of the folder currently under the pointer, or null. */
  dragTargetPath: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: RNGH types vary by version
  nativeGesture: any | null;
  previewPos: Animated.ValueXY;
};

export type UseIconsDragParams = {
  /** Ref kept current by the caller — read inside toEntryIndex without causing re-fires. */
  columnsRef: React.MutableRefObject<number>;
  containerHeightRef: React.MutableRefObject<number>;
  containerRef: React.RefObject<View | null>;
  enabled: boolean;
  entries: FileSystemEntry[];
  flatListRef: React.RefObject<FlatList | null>;
  onMove?: (event: FileSystemMoveEvent) => void;
  scrollOffsetRef: React.MutableRefObject<number>;
  /** Ref kept current by the caller — read inside toEntryIndex without causing re-fires. */
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

  // 2-D resolver: map a container-local (x, y) to a flat entry index. Reads
  // all three refs so the callback stays stable across grid-metric changes.
  const toEntryIndex = useCallback(
    (localX: number, localY: number) => {
      const col = Math.max(
        0,
        Math.min(Math.floor((localX - GRID_PADDING) / (tileWidthRef.current + TILE_GAP)), columnsRef.current - 1),
      );
      const row = Math.max(0, Math.floor((localY + scrollOffsetRef.current - GRID_PADDING) / ROW_STRIDE));
      return row * columnsRef.current + col;
    },
    [columnsRef, scrollOffsetRef, tileWidthRef],
  );

  const { drag, nativeGesture, previewPos, session } = useFileSystemDrag({
    containerHeightRef,
    enabled,
    flatListRef,
    onMove,
    rows: dragRows,
    scrollOffsetRef,
    toEntryIndex,
  });
  useFileSystemDragWeb({ containerRef, enabled, session });

  const targetIdx = drag.targetIndex;
  const dragTargetPath = targetIdx === null ? null : (dragRows[targetIdx]?.entry.path ?? null);

  return { drag, dragTargetPath, nativeGesture, previewPos };
}
