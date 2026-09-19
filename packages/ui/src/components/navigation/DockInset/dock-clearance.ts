/**
 * dock-clearance — pure bookkeeping for the dock's bottom clearance.
 *
 * `MorphingDockSwitch` reports its measured clearance (viewport bottom → dock
 * top) into a `DockInsetProvider`, keyed by a stable id so several docks never
 * collide. The provider keeps a plain `Record<string, number>` and exposes the
 * largest reported value as the clearance a bottom-anchored control must clear.
 * These transitions live here, React-free, so they are unit-testable without
 * react-native.
 */

/** Insert/refresh one dock's clearance, preserving the map identity when unchanged. */
export function reportClearance(entries: Record<string, number>, id: string, clearance: number): Record<string, number> {
  if (entries[id] === clearance) return entries;
  return { ...entries, [id]: clearance };
}

/** Remove one dock's clearance; returns the same map when the id is absent. */
export function clearClearance(entries: Record<string, number>, id: string): Record<string, number> {
  if (!Object.hasOwn(entries, id)) return entries;
  return Object.fromEntries(Object.entries(entries).filter(([key]) => key !== id));
}

/** The tallest reported clearance, or 0 when no dock is present. */
export function maxClearance(entries: Record<string, number>): number {
  let max = 0;
  for (const value of Object.values(entries)) if (value > max) max = value;
  return max;
}
