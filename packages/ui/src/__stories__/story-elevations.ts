/**
 * Elevation control values shared by the playground stories.
 *
 * `elevation` is a 1–8 numeric union but `Choice` works in strings, so the chips
 * carry string keys and this map turns the picked key back into the union — a
 * lookup rather than a cast. Kept in its own `.ts` module (no JSX, no component
 * export) so every story that offers an elevation chip row reads from one table.
 */

import type { SurfaceLevel } from '../lib/elevated';

type ElevationMap = Record<string, SurfaceLevel>;

export const ELEVATIONS = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8 } as const satisfies ElevationMap;

export type ElevationKey = keyof typeof ELEVATIONS;

/** Chip order for `<Choice options={ELEVATION_KEYS} />`. */
export const ELEVATION_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const satisfies readonly ElevationKey[];
