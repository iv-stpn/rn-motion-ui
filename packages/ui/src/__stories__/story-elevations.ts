/**
 * Elevation control values shared by the playground stories.
 *
 * `elevation` is a 0–8 numeric union but `Choice` works in strings, so the chips
 * carry string keys and this map turns the picked key back into the union — a
 * lookup rather than a cast. `'0'` is the flat resting surface (a `surface-3`
 * fill with no shadow or border). Kept in its own `.ts` module (no JSX, no
 * component export) so every story that offers an elevation chip row reads from
 * one table.
 */

import type { SurfaceElevation } from '../lib/elevated';

type ElevationMap = Record<string, SurfaceElevation>;

export const ELEVATIONS = {
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
} as const satisfies ElevationMap;

export type ElevationKey = keyof typeof ELEVATIONS;

/** Chip order for `<Choice options={ELEVATION_KEYS} />`. */
export const ELEVATION_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8'] as const satisfies readonly ElevationKey[];
