// Where in the manager tree a component sits.
//
// This is the one thing the module-level store cannot know on its own: a
// `<Draggable>` or `<Dragzone>` has to tell the store which managers enclose it,
// and only React can answer that. So the context carries *position* — the manager
// path, and who draws the ghost — while everything about the drag itself lives in
// `drag-store.ts`.
//
// Mostly position, with one exception. Groups are resolved at registration by the
// components (a manager's groups are a default the child may override) rather than
// carried resolved, and the drag itself is never here.
//
// The exception is `behavior`, which is policy: the press timeline is the one
// setting that has to apply to a whole surface at once, because the scroll view a
// list of sources sits in makes the decision for all of them at the same time. It
// travels as the consumer wrote it and is resolved per source — see
// `use-drag-behavior.ts`.

import { createContext, useContext } from 'react';
import type { DragGroups } from './drag.types';
import type { DragBehavior } from './drag-behavior';

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
   * The press timeline the nearest manager hands down to sources declaring none —
   * `undefined` for "the platform default", which is what a bare tree runs on.
   *
   * Policy, unlike everything else here, and deliberately so: a timeline is the one
   * thing that has to be settable for a whole surface at once. A list where every
   * row is a `<Draggable>` needs its arm window agreed on by all of them, and per
   * source is the wrong grain for a decision the scroll view underneath forces.
   */
  behavior?: DragBehavior;
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
