// Which segments a trail shows when it is longer than the room for it. Pure and
// separate from the component so it can be unit-tested directly.

/** The two ends an ellipsis sits between: where the trail starts, and where it leads. */
const MIN_VISIBLE = 2;

function toSlot<T>(item: T): BreadcrumbSlot<T> {
  return { item, type: 'item' };
}

/**
 * One rendered position in the trail: a segment, or the gap standing in for the
 * run of segments that did not fit.
 */
export type BreadcrumbSlot<T> = { hidden: readonly T[]; type: 'ellipsis' } | { item: T; type: 'item' };

/**
 * Collapse the middle of a trail so at most `maxVisible` segments render.
 *
 * The first segment and the last `maxVisible - 1` are kept — the root stays
 * reachable and the levels nearest the current one are the ones worth naming,
 * so what drops out is the middle. Everything hidden is handed to the ellipsis
 * slot rather than discarded, which is what lets the caller reveal it.
 *
 * Passing no `maxVisible` keeps every segment. Anything below two is treated as
 * two: with one visible segment there is no trail left to read.
 *
 * @example
 * collapseBreadcrumbs(['a', 'b', 'c', 'd'], 3)
 * // → a · …(b) · c · d
 */
export function collapseBreadcrumbs<T>(items: readonly T[], maxVisible?: number): BreadcrumbSlot<T>[] {
  if (maxVisible === undefined) return items.map(toSlot);

  const limit = Math.max(MIN_VISIBLE, Math.floor(maxVisible));
  if (items.length <= limit) return items.map(toSlot);

  // `slice` rather than indexing: it yields real `T`s, so nothing here has to
  // reason about an out-of-range read that the length check already ruled out.
  const tailStart = items.length - (limit - 1);
  return [
    ...items.slice(0, 1).map(toSlot),
    { hidden: items.slice(1, tailStart), type: 'ellipsis' },
    ...items.slice(tailStart).map(toSlot),
  ];
}
