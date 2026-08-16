// React bindings over the drag store.
//
// Split from the store itself so the store keeps no React dependency and stays
// unit-testable, and so the two subscription channels stay visibly distinct: the
// snapshot hooks re-render on drag start/end and zone crossings, `useDragMove`
// does not re-render at all. Reaching for the wrong one is the difference between
// a component that updates three times a drag and one that updates sixty.

import { type RefObject, useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { ActiveDrag, DragPoint, DragSnapshot, DragzoneState } from './drag.types';
import { getDragSnapshot, getZoneStanding, subscribeDragMove, subscribeDragStore } from './drag-store';

/**
 * The whole render-visible drag state. Prefer the narrower hooks below — this one
 * re-renders on any change, including zone crossings a consumer may not care about.
 */
export function useDragSnapshot(): DragSnapshot {
  return useSyncExternalStore(subscribeDragStore, getDragSnapshot, getDragSnapshot);
}

/**
 * The drag in flight, tree-wide, or `null`.
 *
 * This is how a custom drop target — one that is not a `<Dragzone>` — learns what
 * is coming: read `drag.transfer.getData(mime)` and paint accordingly. Identity is
 * stable for the life of the drag, so this re-renders twice per drag.
 */
export function useActiveDrag(): ActiveDrag | null {
  return useDragSnapshot().drag;
}

/**
 * How one zone stands with respect to the drag in flight: whether it would take it,
 * and whether the pointer is inside it. What paints a zone's own affordance.
 *
 * Subscribed per zone through the store's standing cache, not to the whole
 * snapshot — the object is reference-stable while this zone's own standing is
 * unchanged, so a crossing elsewhere in the tree re-renders nothing here. This
 * is the hook `<Dragzone>` itself uses, through the standing object; reach for
 * it directly only when you want the two booleans without the drag.
 */
export function useDragzoneState(zoneId: string): DragzoneState {
  const standing = useSyncExternalStore(
    subscribeDragStore,
    () => getZoneStanding(zoneId),
    () => getZoneStanding(zoneId),
  );
  return { isEligible: standing.isEligible, isOver: standing.isOver };
}

/**
 * Follow the pointer at the transport's own rate, without re-rendering.
 *
 * The listener is called from the drag transport directly, so it must not
 * `setState` — drive an `Animated.Value` (or a ref, or a direct style write) from
 * it. That constraint is the reason this channel exists: a drag reports movement
 * every frame, and routing that through React would re-render the subtree sixty
 * times a second to move one ghost.
 *
 * Latest-callback semantics: pass an inline function freely, the subscription is
 * not torn down and rebuilt for it.
 */
export function useDragMove(listener: (point: DragPoint) => void): void {
  const ref = useLatest(listener);
  // biome-ignore lint/plugin: subscribing to an external store must run in an effect; no data-fetching or render-driving state
  useEffect(() => subscribeDragMove((point) => ref.current(point)), [ref]);
}

/**
 * A ref holding the newest value, written during render.
 *
 * Local to this module: it exists so a subscription keyed on a consumer's callback
 * identity does not tear down on every render, which for a drag would mean losing
 * the pointer stream mid-gesture.
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * A stable function that always calls the newest `callback` — the same trick as
 * {@link useLatest}, for the case where the consumer needs a callable rather than a
 * ref. Used by the components to hand the store a `getConfig` that never changes
 * identity while still reading this render's props.
 */
export function useEvent<Args extends unknown[], Result>(callback: (...args: Args) => Result): (...args: Args) => Result {
  const ref = useLatest(callback);
  return useCallback((...args: Args) => ref.current(...args), [ref]);
}
