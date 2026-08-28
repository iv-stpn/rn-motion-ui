// The scrub's run geometry — the pure half of `useFileSystemScrubSession`, kept
// RN-free so it stays unit-testable alongside the rest of `logic/`.
//
// A scrub commits a contiguous run on every move: over an entry it is the span
// from the anchor (the entry the drag began on) to the finger; past an edge it is
// everything from the anchor to that edge. The one wrinkle is direction: the
// anchor is the drag's origin, so an over-drag *past the origin* — a drag that
// set off downward but reversed and crossed above the anchor — leaves it out.
// Dragging in the direction the scrub set off in keeps the anchor in.

import { runBetween } from './file-system-selection';

/** Which edge a scrub can over-drag past — also the two directions a scrub can set off in. */
export type ScrubDirection = 'above' | 'below';

/**
 * What the finger resolved to for one scrub move: an entry, an over-drag past
 * either edge of the list/grid, or nothing (empty space between entries).
 */
export type FileSystemScrubHit = { kind: 'item'; path: string } | { kind: 'beyond'; side: ScrubDirection } | null;

/**
 * The side of the anchor the finger is on for one move, or `null` while it is
 * still on the anchor. The session locks this on the first move off the anchor so
 * a later over-drag can tell a reversal from the drag's original direction.
 */
export function resolveScrubDirection(
  startPath: string,
  hit: NonNullable<FileSystemScrubHit>,
  orderedPaths: readonly string[],
): ScrubDirection | null {
  if (hit.kind === 'beyond') return hit.side;
  const startIndex = orderedPaths.indexOf(startPath);
  const hitIndex = orderedPaths.indexOf(hit.path);
  if (startIndex === -1 || hitIndex === -1 || hitIndex === startIndex) return null;
  return hitIndex > startIndex ? 'below' : 'above';
}

/**
 * The run one scrub move commits, or `null` when the anchor is not in the
 * ordering (nothing to measure a run through).
 *
 * - Over an entry: the contiguous span from the anchor to it, inclusive.
 * - Past an edge in the direction the drag set off in (`direction === hit.side`,
 *   or before a direction is known): everything from the anchor to that edge,
 *   anchor included.
 * - Past the opposite edge (a reversal): everything on the far side of the
 *   anchor, with the anchor itself cancelled — the entry the drag began on is
 *   left out. This is the only time over-dragging drops the anchor, matching
 *   "unselect the first item only when over-dragging back past where it started".
 */
export function resolveScrubRun(
  startPath: string,
  direction: ScrubDirection | null,
  hit: NonNullable<FileSystemScrubHit>,
  orderedPaths: readonly string[],
): string[] | null {
  if (hit.kind === 'item') return runBetween(startPath, hit.path, orderedPaths);
  const startIndex = orderedPaths.indexOf(startPath);
  if (startIndex === -1) return null;
  const sameDirection = direction === null || direction === hit.side;
  if (hit.side === 'below') return sameDirection ? orderedPaths.slice(startIndex) : orderedPaths.slice(startIndex + 1);
  return sameDirection ? orderedPaths.slice(0, startIndex + 1) : orderedPaths.slice(0, startIndex);
}
