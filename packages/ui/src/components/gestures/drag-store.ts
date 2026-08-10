/** biome-ignore-all lint/style/noExcessiveLinesPerFile: the registries, the session and the notification fan-out are one unit — every drag event reads all three */

// The tree-wide drag store: who can drag, where they can drop, and what is in
// flight right now.
//
// Module state rather than a context, deliberately. A `<Dragzone>` is routinely
// not under the same provider as the `<Draggable>` that reaches it — often not
// even in the same subtree, and with nested `<DragManager>`s there is no single
// provider to be under. So managers, zones and sources all register *here*, and
// isolation is expressed as a path check (`drag-hit-test.ts`) instead of as
// context boundaries. One consequence worth stating: there is exactly one drag at
// a time, tree-wide, which matches every pointer platform this runs on.
//
// No react-native import in this graph, so it is unit-testable — see the note in
// vitest's setup. `ReactNode` is a type-only import, erased at build.

import type { ReactNode } from 'react';
import type {
  ActiveDrag,
  DragDropEffect,
  DragEndOutcome,
  DragManagerConfig,
  DragManagerEntry,
  DragPoint,
  DragRect,
  DragSnapshot,
  DragTransfer,
  DragzoneDropEvent,
  DragzoneEntry,
} from './drag.types';
import { draggableRectAt } from './drag-geometry';
import { eligibleZoneIds, isZoneEligible, resolveDropTarget } from './drag-hit-test';

const NO_IDS: readonly string[] = [];
const NO_FILES: readonly File[] = [];
const IDLE: DragSnapshot = { drag: null, eligibleZoneIds: NO_IDS, overZoneId: null, preview: null };

type Session = {
  drag: ActiveDrag;
  eligible: readonly string[];
  overZoneId: string | null;
  point: DragPoint;
  preview: { hostId: string | null; node: ReactNode } | null;
  /** The source's own teardown, so `cancelDrag()` from a manager reaches its `onDragEnd`. */
  sourceCancel: () => void;
};

// Insertion-ordered, which is mount order — the last tie-break in a hit test.
const managers = new Map<string, DragManagerEntry>();
const zones = new Map<string, DragzoneEntry>();

let session: Session | null = null;
let snapshot: DragSnapshot = IDLE;

const listeners = new Set<() => void>();
const moveListeners = new Set<(point: DragPoint) => void>();

function isIsolating(managerId: string): boolean {
  return managers.get(managerId)?.getConfig().isolate ?? false;
}

/**
 * Rebuild the snapshot and wake every subscriber.
 *
 * Called only when something render-visible changed — a drag starting or ending,
 * the pointer crossing a zone edge, a zone registering mid-drag. Pointer movement
 * inside one zone does not come through here; that is what `moveListeners` is for.
 */
function publish() {
  snapshot =
    session === null
      ? IDLE
      : {
          drag: session.drag,
          eligibleZoneIds: session.eligible,
          overZoneId: session.overZoneId,
          preview: session.preview,
        };
  for (const listener of listeners) listener();
}

/** The managers enclosing `path`, innermost first — the order callbacks fire in. */
function managersAlong(path: readonly string[]): DragManagerEntry[] {
  const found: DragManagerEntry[] = [];
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const id = path[index];
    const entry = id === undefined ? undefined : managers.get(id);
    if (entry !== undefined) found.push(entry);
  }
  return found;
}

/**
 * Innermost first, so an inner manager sees an event before the page it sits in —
 * the same direction a DOM event bubbles, and the order a consumer expects when
 * one manager wraps another.
 */
function notifyManagers(path: readonly string[], visit: (config: DragManagerConfig) => void) {
  for (const manager of managersAlong(path)) visit(manager.getConfig());
}

function zoneList(): DragzoneEntry[] {
  return [...zones.values()];
}

function recomputeEligible() {
  if (session === null) return;
  const { drag, point } = session;
  const sourceRect = sourceRectAt(session, point);
  const params = { drag, external: false, isIsolating, point, sourceRect, transfer: drag.transfer, zones: zoneList() };
  session.eligible = eligibleZoneIds(params);
}

function sourceRectAt({ drag }: Session, point: DragPoint): DragRect | null {
  if (!(drag.collisionAlgorithm && drag.origin.rect)) return null;
  return draggableRectAt(drag.origin.rect, drag.origin.grab, point);
}

function targetAt(point: DragPoint): DragzoneEntry | null {
  if (session === null) return null;
  const { drag } = session;
  const sourceRect = sourceRectAt(session, point);
  return resolveDropTarget({ drag, external: false, isIsolating, point, sourceRect, transfer: drag.transfer, zones: zoneList() });
}

type ZoneMoveParams = { drag: ActiveDrag; point: DragPoint; previousId: string | null; target: DragzoneEntry | null };

/**
 * Fire the enter / over / leave trio for one move.
 *
 * Publishing only on an actual crossing is the point: a drag travelling inside one
 * zone produces no new snapshot, so nothing re-renders while it does. `onDragOver`
 * is the frame-rate callback for anyone who needs the position anyway.
 */
function reportZoneMove({ drag, point, previousId, target }: ZoneMoveParams) {
  const nextId = target?.id ?? null;
  const { transfer } = drag;
  if (nextId === previousId) {
    if (target !== null) target.getConfig().onDragOver?.({ drag, point, transfer, zoneId: target.id });
    return;
  }
  const previous = previousId === null ? undefined : zones.get(previousId);
  previous?.getConfig().onDragLeave?.({ drag, point, transfer, zoneId: previous.id });
  if (session !== null) session.overZoneId = nextId;
  if (target !== null) target.getConfig().onDragEnter?.({ drag, point, transfer, zoneId: target.id });
  publish();
}

/** Measure every zone, in parallel, and write the results back onto their entries. */
async function measureZones(): Promise<void> {
  await Promise.all(
    zoneList()
      .filter((entry) => !entry.getConfig().skipRectMeasure)
      .map(async (entry) => {
        const rect = await entry.measure();
        // Re-read: the zone may have unregistered while its measure was in flight.
        const live = zones.get(entry.id);
        if (live !== undefined) live.rect = rect;
      }),
  );
}

export type RegisterDragManagerParams = Omit<DragManagerEntry, 'getConfig'> & { getConfig: () => DragManagerConfig };

/** Join a `<DragManager>` to the tree. Call the returned teardown on unmount. */
export function registerDragManager(params: RegisterDragManagerParams): () => void {
  managers.set(params.id, params);
  // A manager mounting mid-drag can change isolation, and therefore eligibility.
  if (session !== null) {
    recomputeEligible();
    publish();
  }
  return () => {
    managers.delete(params.id);
  };
}

export type RegisterDragzoneParams = Omit<DragzoneEntry, 'rect'>;

export type DragzoneRegistration = {
  unregister: () => void;
  /** Re-measure just this zone — what its own `onLayout` calls. */
  remeasure: () => Promise<void>;
};

/**
 * Join a `<Dragzone>` to the tree.
 *
 * Registering during a drag is supported and matters: a zone revealed *by* a drag
 * (a trash can that only appears once you lift something) becomes eligible without
 * the drag having to end and restart.
 */
export function registerDragzone(params: RegisterDragzoneParams): DragzoneRegistration {
  const entry: DragzoneEntry = { ...params, rect: null };
  zones.set(params.id, entry);

  const remeasure = async () => {
    const rect = await entry.measure();
    const live = zones.get(entry.id);
    if (live === undefined) return;
    live.rect = rect;
  };

  if (session !== null) {
    recomputeEligible();
    publish();
    // Measured after publishing: the affordance should appear on this frame, and
    // the box only has to be right by the time the pointer reaches it.
    remeasure().catch(() => undefined);
  }

  return {
    remeasure,
    unregister: () => {
      zones.delete(params.id);
      if (session === null) return;
      // A zone unmounting from under the pointer leaves the drag over nothing.
      if (session.overZoneId === params.id) session.overZoneId = null;
      recomputeEligible();
      publish();
    },
  };
}

export type BeginDragParams = {
  drag: ActiveDrag;
  /** The ghost, and the manager that should draw it. `null` when the source draws its own. */
  preview?: { hostId: string | null; node: ReactNode } | null;
  /** How a manager's `cancelDrag()` reaches the source's own teardown. */
  sourceCancel: () => void;
};

/**
 * Publish a lift. Idempotent per drag: a second call while one is live replaces it,
 * which only happens if a transport double-fires its start.
 */
export function beginDrag({ drag, preview = null, sourceCancel }: BeginDragParams): void {
  session = {
    drag,
    eligible: NO_IDS,
    overZoneId: null,
    point: drag.origin.grab,
    preview,
    sourceCancel,
  };
  recomputeEligible();
  publish();
  notifyManagers(drag.source.managerPath, (config) => config.onDragStart?.({ drag, point: drag.origin.grab, zoneId: null }));
  // Zones move with scroll and layout, and the rects on file are from whenever
  // they last measured. Refreshing now — rather than per move, which would cost a
  // measure round-trip a frame — means the first crossing tests against live
  // boxes. The pre-refresh rects stay in use for the frame or two this takes.
  measureZones().catch(() => undefined);
}

/**
 * Advance the drag. Returns the zone a release would land on, which is what the
 * HTML5 transport needs synchronously to decide whether to claim the browser's drag.
 *
 * The hit test runs on every move because that is the design: the drag reads zone
 * boxes rather than relying on the pointer entering a DOM node, so the same
 * targeting works for a pan on native where no such node exists.
 */
export function moveDrag(point: DragPoint): string | null {
  if (session === null) return null;
  session.point = point;
  const target = targetAt(point);
  const nextId = target?.id ?? null;
  const previousId = session.overZoneId;
  const { drag } = session;

  reportZoneMove({ drag, point, previousId, target });
  notifyManagers(drag.source.managerPath, (config) => config.onDragMove?.({ drag, point, zoneId: nextId }));
  // Movement is its own channel so a consumer can follow the pointer at frame rate
  // without every zone re-rendering with it.
  for (const listener of moveListeners) listener(point);
  return nextId;
}

export type EndDragParams = {
  /** False for an abandoned gesture or a `cancel()` call — no zone is consulted. */
  commit: boolean;
  point: DragPoint;
  /**
   * The `<Draggable>` claiming to end this drag. Guarded rather than assumed: a
   * source unmounting mid-drag, or one whose gesture is cancelled late, must not
   * tear down a drag another source has already started — a drop zone would read
   * `null` while a drag was plainly in progress.
   */
  sourceId: string;
  /**
   * What the transport itself thinks happened, when it knows better than the store.
   *
   * The HTML5 transport passes the browser's `dropEffect` at `dragend`, which is how
   * a drop onto something *outside* the library — `<FileSystem onExternalDrop>`, a
   * bare `dragover`/`drop` pair, another window — still reports as a drop rather
   * than a cancel. No zone of ours claimed it, so the store alone would say `'none'`.
   */
  transportDropEffect?: DragDropEffect;
};

/**
 * End the drag and say what became of it.
 *
 * The target is re-resolved at the release point rather than trusting `overZoneId`:
 * the last move and the release can land in different zones, and it is the release
 * that decides. This is also the only place `onDrop` fires for an in-library drag,
 * so a zone cannot be handed the same payload twice.
 */
export function endDrag({ commit, point, sourceId, transportDropEffect }: EndDragParams): DragEndOutcome {
  if (session === null || session.drag.id !== sourceId) return { canceled: true, dropEffect: 'none', point, zoneId: null };
  const { drag } = session;
  // The HTML5 transport's `dragend` reports bogus coordinates in two engines:
  //  • Chrome — (0, 0): the browser tears down the session by the time dragend
  //    fires. Fall back to the last position from `moveDrag` unconditionally.
  //  • Safari — plausible but wrong non-zero coordinates. The zone's own
  //    `dragover` handler keeps `session.point` accurate with `moveDrag`, so
  //    when the release point hits nothing, consult the tracked point instead.
  let resolved = point.x === 0 && point.y === 0 ? session.point : point;
  let target = commit ? targetAt(resolved) : null;
  if (target === null && commit && resolved !== session.point) {
    const fallback = targetAt(session.point);
    if (fallback !== null) {
      resolved = session.point;
      target = fallback;
    }
  }

  let dropEffect: DragDropEffect = 'none';
  if (target !== null) {
    const config = target.getConfig();
    dropEffect = config.dropEffect;
    drag.transfer.dropEffect = dropEffect;
    const event: DragzoneDropEvent = {
      drag,
      external: false,
      files: NO_FILES,
      point: resolved,
      transfer: drag.transfer,
      zoneId: target.id,
    };
    config.onDrop?.(event);
    notifyManagers(target.managerPath, (manager) => manager.onDrop?.(event));
  } else if (commit && transportDropEffect !== undefined && transportDropEffect !== 'none') {
    // Nothing of ours took it, but the platform says something did.
    dropEffect = transportDropEffect;
  }

  const canceled = dropEffect === 'none';
  const zoneId = target?.id ?? null;
  notifyManagers(drag.source.managerPath, (config) =>
    config.onDragEnd?.({ canceled, drag, dropEffect, point: resolved, zoneId }),
  );
  session = null;
  publish();
  return { canceled, dropEffect, point: resolved, zoneId };
}

/**
 * Abandon the drag in flight from anywhere — a manager's handle, a route change,
 * the source being deleted. Routed through the source's own teardown so its
 * `onDragEnd` fires exactly as it would have; the source then calls `endDrag`.
 */
export function cancelActiveDrag(): void {
  session?.sourceCancel();
}

/** The drag in flight, or `null`. Read it in a drop handler to see what is coming. */
export function getActiveDrag(): ActiveDrag | null {
  return session?.drag ?? null;
}

/** Where the pointer is, live. Off the snapshot on purpose — see {@link ActiveDrag}. */
export function getDragPoint(): DragPoint | null {
  return session?.point ?? null;
}

export function getDragSnapshot(): DragSnapshot {
  return snapshot;
}

/**
 * Subscribe to render-visible drag state: a drag starting or ending, the pointer
 * crossing a zone edge, the eligible set changing. Pair with `getDragSnapshot` in
 * `useSyncExternalStore`.
 *
 * Deliberately *not* fired per pointer move — see `subscribeDragMove` for that.
 */
export function subscribeDragStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Subscribe to the pointer, at whatever rate the transport reports it. This is the
 * frame-rate channel: drive an `Animated.Value` from it, never `setState`.
 */
export function subscribeDragMove(listener: (point: DragPoint) => void): () => void {
  moveListeners.add(listener);
  return () => {
    moveListeners.delete(listener);
  };
}

export type ExternalDropParams = { files: readonly File[]; point: DragPoint; transfer: DragTransfer; zoneId: string };

/**
 * Deliver a payload from outside the library to a zone — an OS file drag, another
 * tab, another application. Web only; there is no such event off the browser.
 *
 * Separate from `endDrag` because there is no session to end: the store never saw
 * this drag start and has no source, groups or origin for it. The zone's own DOM
 * listener is what establishes the drop landed on it, so this only fans the event
 * out to the zone and the managers above it.
 */
export function deliverExternalDrop({ files, point, transfer, zoneId }: ExternalDropParams): void {
  const entry = zones.get(zoneId);
  if (entry === undefined) return;
  const event: DragzoneDropEvent = { drag: null, external: true, files, point, transfer, zoneId };
  entry.getConfig().onDrop?.(event);
  notifyManagers(entry.managerPath, (config) => config.onDrop?.(event));
}

export type ExternalAcceptParams = { point: DragPoint; transfer: DragTransfer; zoneId: string };

/**
 * Whether a zone would take a foreign payload — asked from its `dragover` listener,
 * where the answer decides whether to claim the browser's drag.
 *
 * Runs the same predicate an in-library drag goes through, minus the box test the
 * browser has already performed by dispatching the event at this node.
 */
export function canZoneAcceptExternal({ point, transfer, zoneId }: ExternalAcceptParams): boolean {
  const entry = zones.get(zoneId);
  if (entry === undefined) return false;
  return isZoneEligible({ drag: null, entry, external: true, hitTest: false, isIsolating, point, transfer });
}

/**
 * Re-measure every zone. A `<DragManager>` calls this on its own layout and at lift
 * time; reach for it directly after moving zones with no layout pass of their own —
 * a virtualised list recycling rows, say.
 */
export function refreshDragzones(): Promise<void> {
  return measureZones();
}

/** Test seam: drop every registration and any drag in flight. */
export function resetDragStore(): void {
  managers.clear();
  zones.clear();
  session = null;
  snapshot = IDLE;
  listeners.clear();
  moveListeners.clear();
}
