// Resolving a `DragBehavior` against the platform actually running, and the
// `<DragManager>` actually enclosing.
//
// Split from `drag-behavior.ts` so that module stays free of React and react-native:
// the resolution is pure and unit-tested there, and everything platform- or
// tree-dependent is the four lines here.

import { useMemo } from 'react';
import { Platform } from 'react-native';
import { type DragBehavior, type DragTuning, resolveDragBehavior, resolveHoldBehavior } from './drag-behavior';
import { useDragScope } from './drag-scope';

/**
 * The press timeline in force here: this component's own `behavior`, else the
 * nearest `<DragManager behavior>`, else the platform default.
 *
 * A prop overrides the manager's rather than merging with it, which is how `groups`
 * already resolves — one place to look for the answer beats a layered one.
 *
 * The returned object is stable while the four numbers are, so a fresh `{...}`
 * literal in a consumer's JSX does not rebuild a gesture on every render.
 */
export function useDragBehavior(behavior?: DragBehavior): DragTuning {
  const scope = useDragScope();
  const { armDelay, escapeSlop, holdDelay, slop } = resolveDragBehavior(behavior ?? scope.behavior, Platform.OS);
  return useMemo(() => ({ armDelay, escapeSlop, holdDelay, slop }), [armDelay, escapeSlop, holdDelay, slop]);
}

/**
 * The same, for a component whose press is a hold — `<Holdable>`, `<HoldDraggable>`.
 *
 * Identical in every respect but where it starts from: these defaults hold on every
 * platform, where a bare drag's hold only on touch. See {@link resolveHoldBehavior},
 * and note that a mouse still never fires one — that is the transports' doing, not a
 * number's.
 */
export function useHoldBehavior(behavior?: DragBehavior): DragTuning {
  const scope = useDragScope();
  const { armDelay, escapeSlop, holdDelay, slop } = resolveHoldBehavior(behavior ?? scope.behavior, Platform.OS);
  return useMemo(() => ({ armDelay, escapeSlop, holdDelay, slop }), [armDelay, escapeSlop, holdDelay, slop]);
}
