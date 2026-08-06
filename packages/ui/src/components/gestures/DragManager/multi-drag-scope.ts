// What a `<MultiDraggable>` needs from the manager above it.
//
// Separate from the manager module so `multi-draggable.tsx` does not import it and
// create a cycle, and so the shape of the contract reads in one screen.

import { createContext, type ReactNode, useContext } from 'react';

const NO_IDS: ReadonlySet<string> = new Set();

export type MultiDragScope = {
  /** The current selection, as the manager was given it. */
  selectedIds: ReadonlySet<string>;
  /** The ids a lift of `liftedId` should carry. */
  resolveIds: (liftedId: string) => string[];
  /** The payload for a resolved group, MIME key to string. */
  getGroupData: (ids: readonly string[]) => Record<string, string>;
  /** The ghost for a resolved group, when a pan transport draws one. */
  renderPreview?: (ids: readonly string[]) => ReactNode;
  /** The ids in flight right now — empty when no group drag is running. */
  liftedIds: ReadonlySet<string>;
  /** Whether a `<MultiDragManager>` is actually above this point. */
  hasManager: boolean;
};

/**
 * Outside every `<MultiDragManager>`. A `<MultiDraggable>` here still drags — it
 * just carries only its own id and no payload, which is the useful degenerate case
 * rather than an error worth throwing over.
 */
export const ROOT_MULTI_DRAG_SCOPE: MultiDragScope = {
  getGroupData: () => ({}),
  hasManager: false,
  liftedIds: NO_IDS,
  resolveIds: (liftedId) => [liftedId],
  selectedIds: NO_IDS,
};

export const MultiDragScopeContext = createContext<MultiDragScope>(ROOT_MULTI_DRAG_SCOPE);

/** The enclosing `<MultiDragManager>`'s selection, resolver and lifted set. */
export function useMultiDragScope(): MultiDragScope {
  return useContext(MultiDragScopeContext);
}

/**
 * Whether `id` is part of the group currently in flight.
 *
 * What fades the other members of a selection while one of them is being dragged:
 * the grabbed item is not special here, every id in the group answers `true`.
 */
export function useIsLifting(id: string): boolean {
  return useMultiDragScope().liftedIds.has(id);
}
