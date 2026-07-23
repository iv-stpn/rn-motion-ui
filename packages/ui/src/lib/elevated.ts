/**
 * elevated — surface elevation classes for the cubby-derived surface ladder.
 *
 * A surface sits at a level 1–8 (page is 1; cards/popovers rest at 3). The
 * elevation shadow for a level is `shadow-elevated-N`, which composites the
 * inset *rim* (`--surface-rim-N`: a top highlight + full-perimeter ring, a
 * no-op in light, the recipe in dark) in front of the `shadow-surface-N` drop
 * layers within ONE box-shadow. cubby-ui paints that rim with an `::after`
 * pseudo-element so it stays above opaque children; React Native has no
 * pseudo-elements, so the two layers are folded into a single shadow token
 * instead (cubby's own `SURFACE_SHADOW_COMBINED` path).
 *
 * `elevated(level, shadowLevel)` mirrors cubby's `surfaceClasses` two-arg
 * signature: the surface's *background* level and its *float* (shadow) level are
 * separable. The library's surface components anchor their background at their
 * semantic level and expose the float level as an `elevation` prop, so raising
 * `elevation` lifts a panel (bigger shadow + stronger rim) without recolouring
 * its surface.
 *
 * Every class is spelled as a static literal so the uniwind/Tailwind scanner
 * registers `bg-surface-N` / `shadow-elevated-N` — never build these by string
 * concatenation from a bare number.
 */

/** Surface elevation level: 1 (page) … 8 (highest float). */
// biome-ignore lint/style/useExportsLast: the SurfaceLevel type heads the module for readability — its lookup maps and functions follow
export type SurfaceLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

// Static literal maps — the scanner reads the class names from these keys.
const SURFACE_BG: Record<SurfaceLevel, string> = {
  1: 'bg-surface-1',
  2: 'bg-surface-2',
  3: 'bg-surface-3',
  4: 'bg-surface-4',
  5: 'bg-surface-5',
  6: 'bg-surface-6',
  7: 'bg-surface-7',
  8: 'bg-surface-8',
};

const SURFACE_ELEVATED_SHADOW: Record<SurfaceLevel, string> = {
  1: 'shadow-elevated-1',
  2: 'shadow-elevated-2',
  3: 'shadow-elevated-3',
  4: 'shadow-elevated-4',
  5: 'shadow-elevated-5',
  6: 'shadow-elevated-6',
  7: 'shadow-elevated-7',
  8: 'shadow-elevated-8',
};

/** Every valid level, ascending — handy for stories, tests, and iteration. */
export const SURFACE_LEVELS: readonly SurfaceLevel[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** Clamp any number into the 1–8 ladder (rounding fractional inputs). */
export function clampSurfaceLevel(level: number): SurfaceLevel {
  if (!(level > 1)) return 1; // also catches NaN
  if (level >= 8) return 8;
  // biome-ignore lint/plugin: the guards above prove Math.round(level) ∈ 2..7 — a valid SurfaceLevel — so this only narrows number to the union
  return Math.round(level) as SurfaceLevel;
}

/** Elevation shadow class (rim + drop) for a level. */
export function elevatedShadow(level: SurfaceLevel): string {
  return SURFACE_ELEVATED_SHADOW[clampSurfaceLevel(level)];
}

/** Background class for a surface level. */
export function surfaceBackground(level: SurfaceLevel): string {
  return SURFACE_BG[clampSurfaceLevel(level)];
}

/**
 * Surface classes for a level: `bg-surface-N shadow-elevated-N`. Pass a
 * separate `shadowLevel` to float a surface higher (or lower) than its
 * background tint — the pattern the surface components use for their
 * `elevation` prop.
 */
export function elevated(level: SurfaceLevel, shadowLevel: SurfaceLevel = level): string {
  return `${SURFACE_BG[clampSurfaceLevel(level)]} ${SURFACE_ELEVATED_SHADOW[clampSurfaceLevel(shadowLevel)]}`;
}
