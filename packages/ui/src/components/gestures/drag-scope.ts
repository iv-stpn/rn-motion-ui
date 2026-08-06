// Where in the manager tree a component sits.
//
// This is the one thing the module-level store cannot know on its own: a
// `<Draggable>` or `<Dragzone>` has to tell the store which managers enclose it,
// and only React can answer that. So the context carries *position* — the manager
// path, and who draws the ghost — while everything about the drag itself lives in
// `drag-store.ts`.
//
// Nothing but the path travels here. Groups are resolved at registration by the
// components (a manager's groups are a default the child may override), so a
// consumer reading this context sees structure, not policy.

import { createContext, useContext } from 'react';
import type { DragGroups } from './drag.types';

const EMPTY_PATH: readonly string[] = [];
const NO_GROUPS: DragGroups = [];

export type DragScope = {
  /** Manager ids from the outermost down to the nearest, or `[]` outside every manager. */
  managerPath: readonly string[];
  /** The nearest manager, or `null`. */
  managerId: string | null;
  /** Groups the nearest manager hands down to sources and zones that declare none. */
  groups: DragGroups;
  /**
   * The manager that should draw the ghost for drags lifted here, or `null` when
   * there is none and each source draws its own inside itself.
   *
   * The nearest manager wins, so an inner board's drags are clipped to the board
   * rather than escaping to the page — unless that manager sets `overlay={false}`,
   * in which case the search continues outward.
   */
  overlayHostId: string | null;
};

/** Outside every `<DragManager>`: valid, and the case a bare `<Draggable>` runs in. */
export const ROOT_DRAG_SCOPE: DragScope = {
  groups: NO_GROUPS,
  managerId: null,
  managerPath: EMPTY_PATH,
  overlayHostId: null,
};

export const DragScopeContext = createContext<DragScope>(ROOT_DRAG_SCOPE);

/**
 * The enclosing manager chain. Works with no `<DragManager>` above it — that is
 * the point of {@link ROOT_DRAG_SCOPE}: a lone `<Draggable>` and `<Dragzone>` pair
 * is a complete, working system, and a manager is what you add when you want
 * grouping, isolation, an unclipped ghost or tree-wide callbacks.
 */
export function useDragScope(): DragScope {
  return useContext(DragScopeContext);
}
