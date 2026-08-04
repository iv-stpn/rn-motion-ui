// Web-only external drop zone for <FileSystem>.
//
// The HTML5 drag-and-drop API (`dragenter/dragover/dragleave/drop`) is
// browser-only — this hook is a no-op on React Native. It listens on the
// provided container node so any drag entering from outside fires the zone.
//
// dragenter/dragleave fire for every child element boundary, so we track an
// entry depth counter rather than a boolean. `isOver` stays true until the
// depth reaches zero — i.e. the pointer genuinely left the container.
//
// When `rows` and `scrollOffsetRef` are provided (list view usage), the hook
// resolves the pointer position to a specific folder row on every `dragover`,
// and commits to that folder's path on drop. Drops onto a file row or empty
// space fall back to `currentPath`. When no rows are provided (non-list views),
// every drop uses `currentPath`.

import { type MutableRefObject, type RefObject, useEffect, useRef, useState } from 'react';
import { Platform, type View } from 'react-native';
import type { FileSystemExternalDropEvent } from './file-system.types';
import type { FileSystemRow } from './file-system-rows';

type ResolveParams = {
  clientY: number;
  contentOffsetTop: number;
  // Nullable so the inner closure can pass `node` without a re-cast — the guard
  // is handled here rather than at each call site.
  node: HTMLElement | null;
  rowHeight: number;
  rows: FileSystemRow[];
  scrollOffset: number;
};

/**
 * Resolves an HTML5 drag-event pointer position to a folder row index.
 * Returns null when over content-container padding, a file row, or past the last row.
 */
function resolveTargetIndex({ clientY, contentOffsetTop, node, rowHeight, rows, scrollOffset }: ResolveParams): number | null {
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  const contentY = clientY - rect.top + scrollOffset - contentOffsetTop;
  const rowIndex = Math.floor(contentY / rowHeight);
  if (contentY < 0 || rowIndex < 0 || rowIndex >= rows.length) return null;
  const row = rows[rowIndex];
  // Only folders can receive a drop — files and empty space resolve to null,
  // which the caller maps to currentPath (background drop).
  return row?.entry.kind === 'folder' ? rowIndex : null;
}

export type UseFileSystemExternalDropParams = {
  containerRef: RefObject<View | null>;
  /** Content-container top padding (e.g. `LIST_PADDING_TOP` for the list view). Defaults to 0. */
  contentOffsetTop?: number;
  currentPath: string;
  onExternalDrop: ((event: FileSystemExternalDropEvent) => void) | undefined;
  /** Row height used to map pointer Y to a row index. Defaults to 30. */
  rowHeight?: number;
  /**
   * Flat row list for per-row drop targeting. When provided, drops onto a folder
   * row fire `onExternalDrop` with that folder as the destination; drops onto a
   * file row or empty space use `currentPath`. When absent, every drop uses `currentPath`.
   */
  rows?: FileSystemRow[];
  /** Live scroll offset ref from the list container. Read on `dragover` and `drop`. */
  scrollOffsetRef?: MutableRefObject<number>;
};

export type UseFileSystemExternalDropResult = {
  /**
   * Flat index of the folder row under the pointer, or null when the pointer is
   * over empty space or a file row. Use this to drive a per-row drop highlight
   * alongside the caller's own scroll offset.
   */
  targetIndex: number | null;
  /** True while an external drag is anywhere over the container. */
  isOver: boolean;
};

export function useFileSystemExternalDrop({
  containerRef,
  contentOffsetTop = 0,
  currentPath,
  onExternalDrop,
  rowHeight = 30,
  rows,
  scrollOffsetRef,
}: UseFileSystemExternalDropParams): UseFileSystemExternalDropResult {
  const [isOver, setIsOver] = useState(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const enabled = Platform.OS === 'web' && Boolean(onExternalDrop);

  // Keep live values in refs so the listener closures never go stale across
  // navigation or prop changes without needing to be re-registered.
  const currentPathRef = useRef(currentPath);
  currentPathRef.current = currentPath;
  const onExternalDropRef = useRef(onExternalDrop);
  onExternalDropRef.current = onExternalDrop;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // biome-ignore lint/plugin: DOM event wiring must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (!enabled) return;
    // biome-ignore lint/plugin: RN View refs resolve to HTMLElement in react-native-web
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    // Entry depth counter — dragenter/dragleave fire for every child boundary
    // crossing, not just the container edge.
    let depth = 0;

    function resolveIndex(e: DragEvent): number | null {
      const currentRows = rowsRef.current;
      const offset = scrollOffsetRef?.current ?? 0;
      return currentRows?.length
        ? resolveTargetIndex({ clientY: e.clientY, contentOffsetTop, node, rowHeight, rows: currentRows, scrollOffset: offset })
        : null;
    }

    function handleDragEnter(e: DragEvent) {
      e.preventDefault();
      if (depth === 0) {
        setIsOver(true);
        setTargetIndex(resolveIndex(e));
      }
      depth += 1;
    }

    function handleDragOver(e: DragEvent) {
      e.preventDefault();
      // Signal "copy" so the OS/browser shows the right cursor.
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setTargetIndex(resolveIndex(e));
    }

    function handleDragLeave() {
      depth -= 1;
      if (depth <= 0) {
        depth = 0;
        setIsOver(false);
        setTargetIndex(null);
      }
    }

    function handleDrop(e: DragEvent) {
      e.preventDefault();
      depth = 0;
      const index = resolveIndex(e);
      // A folder row under the pointer is the target; everything else goes to
      // the open folder (currentPath).
      const destination = (index === null ? null : rowsRef.current?.[index]?.entry.path) ?? currentPathRef.current;
      setIsOver(false);
      setTargetIndex(null);
      if (e.dataTransfer) onExternalDropRef.current?.({ dataTransfer: e.dataTransfer, destination });
    }

    node.addEventListener('dragenter', handleDragEnter);
    node.addEventListener('dragover', handleDragOver, { passive: false });
    node.addEventListener('dragleave', handleDragLeave);
    node.addEventListener('drop', handleDrop);

    return () => {
      node.removeEventListener('dragenter', handleDragEnter);
      node.removeEventListener('dragover', handleDragOver);
      node.removeEventListener('dragleave', handleDragLeave);
      node.removeEventListener('drop', handleDrop);
    };
  }, [enabled, containerRef, scrollOffsetRef, contentOffsetTop, rowHeight]);

  // When disabled, suppress stale state rather than leaving the overlay/highlight
  // visible. Derived from `enabled` so no second effect is needed.
  return { isOver: enabled && isOver, targetIndex: enabled ? targetIndex : null };
}
