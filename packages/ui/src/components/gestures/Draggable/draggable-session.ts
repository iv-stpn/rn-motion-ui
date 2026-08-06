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

/**
 * How long a hold arms a pan, on both pan transports.
 *
 * Arms it — it does not start it. A hold this long makes the pan *eligible* to
 * take the gesture; what actually takes it is the first movement afterwards (see
 * {@link DRAG_MOVE_SLOP}). That split is what lets a hold and a drag live on the
 * same node: hold still and the press belongs to whoever else wanted it — a
 * `<HoldContextMenu>`, a `Pressable`'s `onLongPress` — and hold *and move* and it
 * is a drag. Activating on the hold alone means the drag wins every hold there
 * has ever been, and the menu underneath it can never open.
 *
 * Shared from here rather than repeated per transport: two pans that armed at
 * different times would feel like two different components.
 */
export const DRAG_HOLD_MS = 300;

/**
 * How far a finger may travel *before* the hold lands and still arm the pan.
 *
 * Past this it was a scroll, not a lift, so the pan gives the gesture up rather
 * than fight the list it is in. 10px matches UIKit's own allowance for a long
 * press, which is what a finger resting on a moving surface actually drifts.
 */
export const DRAG_ARM_SLOP = 10;

/**
 * How far the finger must travel *after* the hold before the pan takes over.
 *
 * Deliberately small: by this point the hold has already happened, so the only
 * question left is whether the finger is moving at all. Large enough not to fire
 * on the jitter of a finger holding still — which would lift a drag under a menu
 * that hold just opened — and small enough that the lift feels like it happened
 * the moment the finger moved.
 */
export const DRAG_MOVE_SLOP = 4;

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
  data?: Record<string, string>;
  effectAllowed?: DragEffectAllowed;
  groups?: DragGroups;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  testID?: string;
};

export type SessionRefs = {
  draggingRef: MutableRefObject<boolean>;
  /** Pointer offset from the lift point, driving a self-drawn ghost. */
  ghostPos: Animated.ValueXY;
  grabRef: MutableRefObject<DragPoint>;
  id: string;
  managerId: string | null;
  managerPath: readonly string[];
  /** The `<DragManager>` that will draw the ghost, or `null` when the source must. */
  overlayHostId: string | null;
  previewRef: MutableRefObject<ReactNode>;
  propsRef: RefObject<DraggableLiveProps>;
  /** The host's window rect as of the last layout — the ghost's size and anchor. */
  rectRef: MutableRefObject<DragRect | null>;
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
  const { draggingRef, ghostPos, grabRef, id, managerId, managerPath, overlayHostId } = refs;
  const { previewRef, propsRef, rectRef, setGhost, transferRef } = refs;

  return {
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
        groups: live?.groups ?? NO_GROUPS,
        id,
        origin: { grab: point, rect: rectRef.current },
        source: { id, managerId, managerPath, testID: live?.testID },
        transfer: payload,
        transport,
      };
      // The browser draws its own drag image under HTML5, and a second ghost would
      // double it. Under a pan there is nothing on screen unless we draw one.
      const drawsGhost = transport !== 'html5';
      beginDrag({
        drag,
        preview: drawsGhost && overlayHostId !== null ? { hostId: overlayHostId, node: previewRef.current } : null,
        sourceCancel: () => {
          this.finish({ commit: false, point: grabRef.current });
        },
      });

      ghostPos.setValue({ x: 0, y: 0 });
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
      const overZoneId = moveDrag(point);
      const grab = grabRef.current;
      const translation = { x: point.x - grab.x, y: point.y - grab.y };
      ghostPos.setValue(translation);
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
      setGhost(false);
      propsRef.current?.onDragEnd?.({ ...outcome, transfer });
    },

    isDragging: () => draggingRef.current,
  };
}
