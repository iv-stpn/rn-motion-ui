import { useMemo } from 'react';
import { withMultiDragIds } from '../../../gestures/DragManager/multi-drag';
import { useMultiDragScope } from '../../../gestures/DragManager/multi-drag-scope';
import type { HoldContextMenuDragOptions } from '../../../menus/HoldContextMenu/hold-context-menu';
import type { FileSystemEntry } from '../types/file-system.types';

/**
 * The multi-drag payload every row/tile resolves for `HoldContextMenu dragOptions`.
 *
 * Shared by the column row, list row, gallery strip tile, and icons tile — each
 * reads the same scope, resolves the same ids, and builds the same drag data.
 */
export function useFileSystemDragOptions(entry: FileSystemEntry, draggable: boolean): HoldContextMenuDragOptions | undefined {
  const { getGroupData, renderPreview, resolveIds } = useMultiDragScope();

  const ids = useMemo(() => resolveIds(entry.path), [entry.path, resolveIds]);
  const multiData = useMemo(() => withMultiDragIds(getGroupData(ids), ids), [getGroupData, ids]);

  return useMemo<HoldContextMenuDragOptions | undefined>(
    () => (draggable ? { data: multiData, effectAllowed: 'move', preview: renderPreview?.(ids) } : undefined),
    [draggable, ids, multiData, renderPreview],
  );
}
