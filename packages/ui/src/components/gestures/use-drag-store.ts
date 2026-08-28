// React bindings over the drag store.
//
// Split from the store itself so the store keeps no React dependency and stays
// unit-testable, and so the subscription channels stay visibly distinct. Reaching
// for the wrong one is the difference between a component that updates twice a drag
// and one that updates on every folder the pointer passes over — which, in a view
// that renders a list, means rebuilding that list just as often.
//
// Four channels, widest to narrowest:
//
//   useDragSnapshot   every crossing. Only for a leaf that draws the crossing.
//   useDragzoneState  one zone's own edges. What a `<Dragzone>` paints from.
//   useActiveDrag     the lift and the release, and nothing else. What a *view*
//   useIsDragging     wants — "is a drag happening", not "where is it now".
//   useDragMove       every frame, and re-renders nothing at all: drive an
//                     `Animated.Value` from it, never `setState`.

import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ActiveDrag, DragPoint, DragSnapshot, DragzoneStanding, DragzoneState } from './drag.types';
import {
  getActiveDrag,
  getDragPreview,
  getDragSnapshot,
  getZoneStanding,
  subscribeActiveDrag,
  subscribeDragMove,
  subscribeDragStore,
  subscribeZoneStanding,
} from './drag-store';

/** `getSnapshot` for {@link useIsDragging} — module-level so its identity is stable. */
function getIsDragging(): boolean {
  return getActiveDrag() !== null;
}

/**
 * The whole render-visible drag state. Prefer the narrower hooks below — this one
 * re-renders on any change, **including every zone crossing**.
 *
 * Reach for it only when the crossing is the thing you are drawing: the shared drop
 * indicator and the "move into …" hint both need `overZoneId` and are leaves, which
 * is the shape this hook is safe in. A component that renders a list must not use
 * it — see {@link useActiveDrag}.
 */
export function useDragSnapshot(): DragSnapshot {
  return useSyncExternalStore(subscribeDragStore, getDragSnapshot, getDragSnapshot);
}

/**
 * The drag in flight, tree-wide, or `null`.
 *
 * This is how a custom drop target — one that is not a `<Dragzone>` — learns what
 * is coming: read `drag.transfer.getData(mime)` and paint accordingly.
 *
 * On the lifecycle channel, so this re-renders exactly twice per drag — at the lift
 * and at the release — however many zone edges the pointer crosses in between. It
 * used to read the field off the whole snapshot, which meant a crossing re-rendered
 * every consumer; the consumers are mostly whole views (a list that mounts drop
 * overlays for the duration of a drag), and a view re-render rebuilds its rows, so
 * that one line was the cost of sweeping a drag across a folder list.
 */
export function useActiveDrag(): ActiveDrag | null {
  return useSyncExternalStore(subscribeActiveDrag, getActiveDrag, getActiveDrag);
}

/**
 * Whether any drag is in flight, as a boolean.
 *
 * The same channel as {@link useActiveDrag} and the form most consumers actually
 * want: a view that mounts overlays or arms an auto-scroller for the duration of a
 * drag cares about the transition, not the payload. Returning a boolean also means
 * a consumer cannot accidentally hold the drag object across the drag's end.
 */
export function useIsDragging(): boolean {
  return useSyncExternalStore(subscribeActiveDrag, getIsDragging, getIsDragging);
}

/**
 * The ghost to draw and which manager should draw it, on the lifecycle channel.
 *
 * Pairs with {@link useActiveDrag} for a manager's overlay: both change only at the
 * lift and the release, so the overlay never re-renders for a crossing it has
 * nothing to say about.
 */
export function useDragPreview(): { hostId: string | null; node: ReactNode } | null {
  return useSyncExternalStore(subscribeActiveDrag, getDragPreview, getDragPreview);
}

/**
 * How one zone stands with respect to the drag in flight: whether it would take it,
 * and whether the pointer is inside it. What paints a zone's own affordance.
 *
 * Subscribed on this zone's own channel, so a crossing anywhere else in the tree
 * neither re-renders this component nor calls back into it at all. The standing
 * object is reference-stable while this zone's own fields are unchanged, which is
 * the second half of the same guarantee: a file system's every folder row is a
 * `<Dragzone>`, and a whole-store subscription here re-rendered the entire row list
 * on each boundary the pointer crossed.
 */
export function useDragzoneState(zoneId: string): DragzoneState {
  const { isEligible, isOver } = useZoneStanding(zoneId);
  return useMemo(() => ({ isEligible, isOver }), [isEligible, isOver]);
}

/**
 * The full standing for one zone — the two booleans plus the drag itself.
 *
 * What `<Dragzone>` subscribes with; {@link useDragzoneState} is this without the
 * drag, for a consumer that only paints from the booleans.
 */
export function useZoneStanding(zoneId: string): DragzoneStanding {
  const subscribe = useCallback((listener: () => void) => subscribeZoneStanding(zoneId, listener), [zoneId]);
  const read = useCallback(() => getZoneStanding(zoneId), [zoneId]);
  return useSyncExternalStore(subscribe, read, read);
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
