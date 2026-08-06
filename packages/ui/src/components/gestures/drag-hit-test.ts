// Which zone, if any, a drag would land on — the whole decision, with no
// react-native in its import graph so it can be unit-tested directly.
//
// The question is asked twice per drag for different reasons. At lift time it is
// asked of every zone with no point ("which of you *could* take this?"), and that
// set is what paints the "you can drop here" affordance. On every move it is asked
// again with the pointer position, and the winner is where a release would land.
// One predicate answers both, so an eligible-looking zone can never turn out to
// refuse the drop.

import type { ActiveDrag, DragPoint, DragTransfer, DragzoneEntry } from './drag.types';
import { isPointInRect, rectArea } from './drag-geometry';
import { dragGroupsMatch } from './drag-transfer';

/** Ordering key for one candidate, cheapest-to-compare first. */
type Candidate = { depth: number; entry: DragzoneEntry; area: number; priority: number };

function toCandidate(entry: DragzoneEntry): Candidate {
  const config = entry.getConfig();
  return {
    area: entry.rect === null ? Number.POSITIVE_INFINITY : rectArea(entry.rect),
    depth: entry.managerPath.length,
    entry,
    priority: config.priority,
  };
}

/**
 * Innermost `isolate` manager enclosing `path`, or `null`.
 *
 * This is the identity isolation compares by: a source and a zone may interact
 * exactly when they sit in the same isolated world. Reading the *innermost* one is
 * what makes nested managers behave — an isolated board inside an isolated page is
 * its own world, not the page's.
 */
export function deepestIsolator(path: readonly string[], isIsolating: (managerId: string) => boolean): string | null {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const managerId = path[index];
    if (managerId !== undefined && isIsolating(managerId)) return managerId;
  }
  return null;
}

export type ZoneEligibilityParams = {
  /** The in-library drag, or `null` for a payload from outside (an OS file drag). */
  drag: ActiveDrag | null;
  entry: DragzoneEntry;
  external: boolean;
  /**
   * Whether `point` must be inside the zone's measured box.
   *
   * False asks the other question — "could this zone ever take this drag" — which
   * is what paints the affordance the moment a drag lifts, and what an external
   * drop asks: the browser already established the pointer was over the node, so
   * re-deciding that from a rect measured before the last scroll can only be wrong.
   */
  hitTest: boolean;
  isIsolating: (managerId: string) => boolean;
  point: DragPoint;
  transfer: DragTransfer;
};

/**
 * Whether this zone will take this drag.
 *
 * Order matters only for cost: the cheap structural checks run before the
 * consumer's `accepts`, which may do real work and is called on every move.
 */
export function isZoneEligible({ drag, entry, external, hitTest, isIsolating, point, transfer }: ZoneEligibilityParams): boolean {
  const config = entry.getConfig();
  if (config.disabled) return false;
  if (external && !config.acceptsExternal) return false;
  // An external payload has no source to match groups against or isolate by —
  // it came from outside every manager, so those two checks have nothing to say.
  if (drag !== null) {
    if (!dragGroupsMatch(drag.groups, config.groups)) return false;
    if (deepestIsolator(drag.source.managerPath, isIsolating) !== deepestIsolator(entry.managerPath, isIsolating)) return false;
  }
  // An unmeasured zone cannot be under the pointer — there is no box to be inside
  // of — but it stays eligible in the abstract, so the affordance does not blink
  // off for the frame between a layout change and the measure that follows it.
  if (hitTest && (entry.rect === null || !isPointInRect(point, entry.rect))) return false;
  return config.accepts?.({ drag, external, point, transfer, zoneId: entry.id }) ?? true;
}

export type ResolveDropTargetParams = {
  drag: ActiveDrag | null;
  external: boolean;
  isIsolating: (managerId: string) => boolean;
  point: DragPoint;
  transfer: DragTransfer;
  zones: readonly DragzoneEntry[];
};

/**
 * The zone a release at `point` would land on, or `null`.
 *
 * Zones overlap constantly — a card slot inside a column inside a board — so the
 * tie-break is the whole substance of this function. In order: an explicit
 * `priority`, then manager depth, then the smaller box, then registration order.
 *
 * Depth before area because nesting is the thing a consumer actually modelled: a
 * zone under an inner `<DragManager>` is more specific than one under the outer,
 * whatever their sizes work out to. Area is the fallback for the common case of
 * two zones under the *same* manager, where the smaller is the more specific by
 * construction — a slot inside a column is smaller than the column.
 */
export function resolveDropTarget({
  drag,
  external,
  isIsolating,
  point,
  transfer,
  zones,
}: ResolveDropTargetParams): DragzoneEntry | null {
  const hits = zones
    .filter((entry) => isZoneEligible({ drag, entry, external, hitTest: true, isIsolating, point, transfer }))
    .map(toCandidate);
  if (hits.length === 0) return null;
  // Array#sort is stable in every engine this ships to, so equal candidates keep
  // registration order — which is mount order, the only tie-break left.
  hits.sort((a, b) => b.priority - a.priority || b.depth - a.depth || a.area - b.area);
  return hits[0]?.entry ?? null;
}

export type EligibleZoneIdsParams = ResolveDropTargetParams;

/**
 * Every zone that would take this drag, wherever the pointer happens to be — the
 * set that paints the "you can drop here" affordance the moment a drag lifts.
 *
 * `point` is still passed through to `accepts`, since a predicate is entitled to
 * see it; what is skipped is the box test, which is the only difference between
 * this and {@link resolveDropTarget}.
 */
export function eligibleZoneIds({ drag, external, isIsolating, point, transfer, zones }: EligibleZoneIdsParams): string[] {
  return zones
    .filter((entry) => isZoneEligible({ drag, entry, external, hitTest: false, isIsolating, point, transfer }))
    .map((entry) => entry.id);
}
