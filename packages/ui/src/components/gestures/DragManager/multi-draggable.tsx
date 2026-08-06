// One member of a selection, dragging as the whole of it.
//
// Thin by design: everything about *what* a lift carries is decided by the enclosing
// `<MultiDragManager>`, so this resolves `data` and `preview` from that scope at
// render time and hands the rest to `<Draggable>` untouched. Which means anything
// true of a `Draggable` — transports, groups, `effectAllowed`, the ref handle — is
// true of this too.

import type { ReactNode, Ref } from 'react';
import { useMemo } from 'react';
import { Draggable, type DraggableProps } from '../Draggable/draggable';
import type { DraggableHandle } from '../drag.types';
import { withMultiDragIds } from './multi-drag';
import { useMultiDragScope } from './multi-drag-scope';

export type MultiDraggableProps = Omit<DraggableProps, 'data' | 'preview'> & {
  /** This item's id, as it appears in the manager's `selectedIds`. */
  id: string;
  /**
   * Overrides the manager's group preview for a lift starting here. Rarely needed —
   * the point of the manager is that the ghost describes the group, not the item.
   */
  preview?: ReactNode;
  ref?: Ref<DraggableHandle>;
};

/**
 * A `<Draggable>` that carries its whole selection.
 *
 * ```tsx
 * <MultiDraggable id={row.id}>
 *   <Row row={row} />
 * </MultiDraggable>
 * ```
 *
 * Needs a `<MultiDragManager>` above it — that is where the selection, the payload
 * and the group ghost come from. Without one it still drags, carrying just its own
 * id and no payload, which is a broken configuration rather than a useful default,
 * so prefer a plain `<Draggable>` if that is what you meant.
 *
 * **Accessibility.** Inherits `<Draggable>`'s: a wrapper with no semantics of its
 * own, and a pointer-only action that needs a second, non-pointer path to the same
 * outcome.
 */
export function MultiDraggable({ id, preview, ...draggableProps }: MultiDraggableProps) {
  const { getGroupData, renderPreview, resolveIds } = useMultiDragScope();

  // Resolved during render, not at lift time: the selection is already render state,
  // and a payload built here is one the transport can hand over synchronously —
  // `dragstart` gives no chance to compute one late.
  const ids = useMemo(() => resolveIds(id), [id, resolveIds]);
  const data = useMemo(() => withMultiDragIds(getGroupData(ids), ids), [getGroupData, ids]);
  const previewNode = preview ?? renderPreview?.(ids);

  return <Draggable data={data} preview={previewNode} {...draggableProps} />;
}
