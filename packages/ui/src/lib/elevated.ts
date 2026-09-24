/**
 * elevated — surface elevation classes for the surface ladder.
 *
 * A surface sits at a level 1–3 plus the flat `0`. The elevation shadow for a
 * level is `shadow-elevated-N`, which composites the inset *rim*
 * (`--surface-rim-N`: a top highlight + full-perimeter ring, a no-op in light,
 * the recipe in dark) in front of the `shadow-surface-N` drop layers within ONE
 * box-shadow. A pseudo-element (`::after`) would paint that rim above opaque
 * children, but React Native has no pseudo-elements, so the two layers are
 * folded into a single shadow token instead.
 *
 * `elevated(level, shadowLevel)` takes a two-arg signature: the surface's
 * background level and its float (shadow) level are separable. The library's
 * surface components anchor their background at their semantic level and expose
 * the float level as an `elevation` prop, so raising `elevation` lifts a panel
 * (bigger shadow + stronger rim) without recolouring its surface.
 *
 * Every class is spelled as a static literal so the uniwind/Tailwind scanner
 * registers `bg-surface-N` / `shadow-elevated-N` — never build these by string
 * concatenation from a bare number.
 */

/** Surface elevation level: 1 … 3 (the highest float). */
export type SurfaceLevel = 1 | 2 | 3;

/**
 * The `elevation` prop's domain: `0` is the flat resting surface (a `surface-3`
 * fill with no shadow, rim or border), `1–3` are the ladder rungs. `0` is not a
 * surface *level* — there is no `bg-surface-0` — so it sits on its own type
 * rather than widening {@link SurfaceLevel}.
 */
// biome-ignore lint/style/useExportsLast: grouped with SurfaceLevel — both surface types head the module for readability
export type SurfaceElevation = SurfaceLevel | 0;

// Static literal maps — the scanner reads the class names from these keys.
const SURFACE_BG_CLASSNAME: Record<SurfaceLevel, string> = { 1: 'bg-surface-1', 2: 'bg-surface-2', 3: 'bg-surface-3' };

const SURFACE_ELEVATED_SHADOW_CLASSNAME: Record<SurfaceLevel, string> = {
  1: 'shadow-elevated-1',
  2: 'shadow-elevated-2',
  3: 'shadow-elevated-3',
};

/** Flat (elevation-0) surface — the resting `surface-3` fill, no shadow or border. */
const FLAT_SURFACE_CLASSNAME = 'bg-surface-3';

/**
 * The floating control drop (`--shadow-floating`) pairs a tight contact shadow
 * with a wider, downward plume. It is a wholly separate recipe from the
 * `shadow-elevated-N` ladder, not a rung of it: the ladder stacks offset drop
 * layers plus a dark-mode rim to place a surface on the depth scale, while this
 * is the softer detached lift Input's `floating` prop wears.
 * A surface picks one or the other — never both, since they are the same CSS
 * property.
 */
export const FLOATING_SHADOW_CLASSNAME = 'shadow-floating';

/** Combined background + shadow class for an elevation — built from the private lookups so it cannot drift from {@link surfaceBackground} / {@link elevatedShadow}. */
export const SURFACE_CLASSNAME: Record<SurfaceElevation, string> = {
  0: FLAT_SURFACE_CLASSNAME,
  1: `${SURFACE_BG_CLASSNAME[1]} ${SURFACE_ELEVATED_SHADOW_CLASSNAME[1]}`,
  2: `${SURFACE_BG_CLASSNAME[2]} ${SURFACE_ELEVATED_SHADOW_CLASSNAME[2]}`,
  3: `${SURFACE_BG_CLASSNAME[3]} ${SURFACE_ELEVATED_SHADOW_CLASSNAME[3]}`,
};

/** Every valid level, ascending — handy for stories, tests, and iteration. */
export const SURFACE_LEVELS: readonly SurfaceLevel[] = [1, 2, 3];

/** Clamp any number into the 1–3 ladder (rounding fractional inputs). */
export function clampSurfaceLevel(level: number): SurfaceLevel {
  if (!(level > 1)) return 1; // also catches NaN
  if (level >= 3) return 3;
  // biome-ignore lint/plugin: the guards above prove Math.round(level) ∈ 1..3 — a valid SurfaceLevel — so this only narrows number to the union
  return Math.round(level) as SurfaceLevel;
}

/** Elevation shadow class (rim + drop) for an elevation — empty string at `0`, where the flat surface carries no shadow or border. */
export function elevatedShadow(level: SurfaceElevation): string {
  if (level === 0) return '';
  return SURFACE_ELEVATED_SHADOW_CLASSNAME[clampSurfaceLevel(level)];
}

/** Background class for an elevation — `bg-surface-3` at `0` (the flat resting surface), `bg-surface-N` otherwise. */
export function surfaceBackground(level: SurfaceElevation): string {
  if (level === 0) return FLAT_SURFACE_CLASSNAME;
  return SURFACE_BG_CLASSNAME[clampSurfaceLevel(level)];
}

/**
 * Surface classes for an elevation: `bg-surface-N shadow-elevated-N`. At `0` the
 * surface is flat — `bg-surface-3` alone, no shadow or border. Pass a separate
 * `shadowLevel` to float a surface's shadow higher (or lower) than its
 * background tint — the pattern the surface components use for their
 * `elevation` prop.
 *
 * Pass `floating` to swap the ladder shadow for {@link FLOATING_SHADOW_CLASSNAME},
 * the input field's diffuse halo. It *replaces* rather than adds to the ladder
 * shadow — both write `box-shadow`, so keeping the two would leave whichever
 * tailwind-merge resolved last. The background tint still follows `level`, so a
 * floating surface keeps its place in the ladder while wearing the softer drop.
 */
export function elevated(level: SurfaceElevation, shadowLevel: SurfaceElevation = level, floating = false): string {
  const shadow = floating ? FLOATING_SHADOW_CLASSNAME : elevatedShadow(shadowLevel);
  return [surfaceBackground(level), shadow].filter(Boolean).join(' ');
}
