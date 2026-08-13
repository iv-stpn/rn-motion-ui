// The transport-agnostic half of a drag.
//
// Three transports drive exactly this interface — the browser's HTML5 drag, a
// pointer-driven pan for touch on web, and an RNGH pan on native — which is what
// keeps the callbacks a consumer sees from drifting apart between them. Everything
// platform-specific lives in the transport; everything shared lives behind these
// four methods.
//
// Internal: a consumer drives a drag through props and the handle, never by
// calling in here.

import type { MutableRefObject, ReactNode, RefObject } from 'react';
import type { Animated } from 'react-native';
import type {
  ActiveDrag,
  CollisionAlgorithm,
  DragAxis,
  DragDropEffect,
  DragEffectAllowed,
  DragEndEvent,
  DragGroups,
  DragMoveEvent,
  DragPoint,
  DragRect,
  DragStartEvent,
  DragTransfer,
  DragTransport,
} from '../drag.types';
import { beginDrag, endDrag, moveDrag } from '../drag-store';
import { mirrorDragTransfer, writeTransferData } from '../drag-transfer';

const NO_GROUPS: DragGroups = [];

export type DraggableBeginParams = {
  point: DragPoint;
  /** The browser's own `DataTransfer` under HTML5, the stand-in under a pan. */
  transfer: DragTransfer;
  transport: DragTransport;
};

export type DraggableFinishParams = {
  /** False for an abandoned gesture, an Escape, or a `cancel()` call. */
  commit: boolean;
  point: DragPoint;
  /**
   * What the platform says became of the payload, where it knows something the
   * store does not — the browser's `dropEffect` at `dragend`, which is how a drop
   * onto a listener outside this library still reports as a drop. Omitted by the
   * pan transports, which have no such authority.
   */
  transportDropEffect?: DragDropEffect;
};

export type DraggableSession = {
  begin: (params: DraggableBeginParams) => void;
  /** Advance the drag; returns the zone a release would land on, or `null`. */
  move: (point: DragPoint) => string | null;
  finish: (params: DraggableFinishParams) => void;
  isDragging: () => boolean;
  /** The DragManager that will draw the ghost, or `null` when the source must. */
  readonly overlayHostId: string | null;
};

/**
 * The props the session reads *live*, off a ref.
 *
 * Declared here rather than `Pick`ed off `DraggableProps` to keep the import one
 * way — and the reason it exists at all is that the session is built once per
 * mount: a callback whose identity changes every render must not be able to tear
 * down a drag in flight.
 */
export type DraggableLiveProps = {
  collisionAlgorithm?: CollisionAlgorithm;
  data?: Record<string, string>;
  dragAxis?: DragAxis;
  effectAllowed?: DragEffectAllowed;
  groups?: DragGroups;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  testID?: string;
};

export type SessionRefs = {
  /** Measured bounds view rect, when `dragBoundsRef` was given. Clamped per-frame in `move()`. */
  boundsRef: MutableRefObject<DragRect | null>;
  draggingRef: MutableRefObject<boolean>;
  /** Pointer offset from the lift point, driving a self-drawn ghost. */
  ghostPos: Animated.ValueXY;
  grabRef: MutableRefObject<DragPoint>;
  id: string;
  managerId: string | null;
  managerPath: readonly string[];
  /**
   * Re-reads the host's window box now. Async on both platforms because native's
   * `measureInWindow` is callback-based. Used at lift to re-anchor the ghost: the
   * box `rectRef` holds is from the last layout, and a scroll since then would
   * otherwise strand the ghost off the row by exactly the scroll distance.
   */
  measure: () => Promise<DragRect | null>;
  /** The `<DragManager>` that will draw the ghost, or `null` when the source must. */
  overlayHostId: string | null;
  previewRef: MutableRefObject<ReactNode>;
  propsRef: RefObject<DraggableLiveProps>;
  /** The host's window rect as of the last layout — the ghost's size and anchor. */
  rectRef: MutableRefObject<DragRect | null>;
  /**
   * Publishes "a drag is up from here" as render state.
   *
   * Distinct from {@link setGhost}, which is true only when this component is also
   * the one drawing the ghost — under HTML5, or with a manager hosting the overlay,
   * a drag is very much in flight while nothing is drawn here. This is the flag a
   * consumer styles the source itself from, so it has to mean the drag and not the
   * ghost. Both are set in the same tick, so the pair costs one render per lift.
   */
  setDragging: (next: boolean) => void;
  setGhost: (next: boolean) => void;
  transferRef: MutableRefObject<DragTransfer | null>;
};

/**
 * Build the session. All three transports call exactly these methods, which is why
 * the callbacks a consumer sees cannot drift apart between them: the HTML5 transport
 * hands `begin` the browser's own `DataTransfer`, the pans hand it the stand-in, and
 * everything from there on is shared.
 */
export function buildSession(refs: SessionRefs): DraggableSession {
  const { boundsRef, draggingRef, ghostPos, grabRef, id, managerId, managerPath, overlayHostId } = refs;
  const { measure, previewRef, propsRef, rectRef, setDragging, setGhost, transferRef } = refs;

  return {
    overlayHostId,

    begin({ point, transfer, transport }) {
      const live = propsRef.current;
      transfer.effectAllowed = live?.effectAllowed ?? 'copy';
      writeTransferData(transfer, live?.data);
      // Under HTML5 the browser protects its own drag data store the moment
      // `dragstart` returns — `getData` reads `''` on every event until the drop —
      // so what the store, the zones and the callbacks see is a readable mirror of
      // it, snapshotted here while it can still be read. See `mirrorDragTransfer`.
      // A pan carries the stand-in, which was never protected to begin with.
      const payload = transport === 'html5' ? mirrorDragTransfer(transfer, live?.data) : transfer;
      transferRef.current = payload;
      grabRef.current = point;
      draggingRef.current = true;

      const drag: ActiveDrag = {
        collisionAlgorithm: live?.collisionAlgorithm,
        groups: live?.groups ?? NO_GROUPS,
        id,
        origin: { grab: point, rect: rectRef.current },
        source: { id, managerId, managerPath, testID: live?.testID },
        transfer: payload,
        transport,
      };
      // Under a pan the browser draws nothing so we must.  Under HTML5 a manager
      // still draws its own ghost (to keep control of the position — Safari snaps
      // the native drag image back to the lift point when the cursor leaves the
      // window), and the HTML5 transport hides the browser's image to match.
      const drawsGhost = transport !== 'html5' || overlayHostId !== null;
      beginDrag({
        drag,
        preview: drawsGhost && overlayHostId !== null ? { hostId: overlayHostId, node: previewRef.current } : null,
        sourceCancel: () => {
          this.finish({ commit: false, point: grabRef.current });
        },
      });

      // `rectRef` is the source's window box from its last layout pass, while
      // `point` is fresh. A scroll between the two — the page on web, the list on
      // native — leaves the box stale by exactly the scroll distance, and the
      // manager's ghost would start that far off the row. Re-anchor to the live
      // box; the ghost reads `origin.rect` off this same object on every move, so
      // its next placement lands on the row.
      measure()
        .then((fresh) => {
          if (fresh === null || !draggingRef.current) return;
          rectRef.current = fresh;
          drag.origin.rect = fresh;
        })
        .catch(() => undefined);

      // The ghost starts exactly over the source: `move` translates by the delta
      // from the grab point, so zero is the value it would compute at the lift.
      // Seeding the grab's within-source offset here instead displaces the first
      // frame by that offset and lets the next move snap it back — a visible
      // jump right as the drag starts.
      ghostPos.setValue({ x: 0, y: 0 });
      setDragging(true);
      // Only when this component is the one drawing it: with a manager hosting the
      // ghost, a re-render here on every lift buys nothing.
      setGhost(drawsGhost && overlayHostId === null);
      // The mirror, not the raw transfer: one object across all three callbacks, and
      // the only one of the two that is still readable by the time `onDragMove` runs.
      live?.onDragStart?.({ point, transfer: payload });
    },

    move(point) {
      const transfer = transferRef.current;
      if (!(draggingRef.current && transfer)) return null;
      const grab = grabRef.current;
      // ── Axis constraint ──────────────────────────────────────────────
      let clampedX = point.x;
      let clampedY = point.y;
      const axis = propsRef.current?.dragAxis;
      if (axis === 'x') clampedY = grab.y;
      else if (axis === 'y') clampedX = grab.x;
      // ── Bounded dragging ─────────────────────────────────────────────
      // The clamping works in window coordinates: compute where the item's
      // edges would land, clamp them inside the bounds view, then convert
      // back to a grab-relative point for the ghost and the store.
      const bounds = boundsRef.current;
      const hostRect = rectRef.current;
      if (bounds && hostRect) {
        // Edges the item WOULD have at this pointer position (window coords).
        const itemLeft = hostRect.x + (clampedX - grab.x);
        const itemTop = hostRect.y + (clampedY - grab.y);
        // Furthest the item can move while staying inside the bounds.
        const minLeft = bounds.x;
        const minTop = bounds.y;
        const maxLeft = bounds.x + bounds.width - hostRect.width;
        const maxTop = bounds.y + bounds.height - hostRect.height;
        // Clamp the item's edges, then convert back to a grab-relative point.
        clampedX = grab.x + Math.max(minLeft, Math.min(itemLeft, maxLeft)) - hostRect.x;
        clampedY = grab.y + Math.max(minTop, Math.min(itemTop, maxTop)) - hostRect.y;
      }
      const clampedPoint = { x: clampedX, y: clampedY };
      const overZoneId = moveDrag(clampedPoint);
      const translation = { x: clampedX - grab.x, y: clampedY - grab.y };
      ghostPos.setValue(translation);
      // Report the raw (unclamped) point so consumers still see where the finger is.
      propsRef.current?.onDragMove?.({ overZoneId, point, transfer, translation });
      return overZoneId;
    },

    finish({ commit, point, transportDropEffect }) {
      const transfer = transferRef.current;
      if (!(draggingRef.current && transfer)) return;
      draggingRef.current = false;
      transferRef.current = null;
      // Owner-guarded in the store: a source unmounting mid-drag, or one whose
      // gesture was cancelled late, must not end a drag another source started.
      const outcome = endDrag({ commit, point, sourceId: id, transportDropEffect });
      ghostPos.setValue({ x: 0, y: 0 });
      setDragging(false);
      setGhost(false);
      propsRef.current?.onDragEnd?.({ ...outcome, transfer });
    },

    isDragging: () => draggingRef.current,
  };
}
