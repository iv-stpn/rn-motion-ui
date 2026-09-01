/**
 * The kind of scrim an overlay renders behind its panel.
 *
 * - `"blur"` — frosted glass: a backdrop blur under a translucent dim, so the
 *   page behind reads as out-of-focus instead of a flat wash.
 * - `"opacity"` — a flat translucent dim with no blur. Lighter on the GPU than
 *   `"blur"` and the right call on low-power devices or dense small-screen
 *   surfaces where the frost is lost.
 * - `"none"` — no scrim at all; the panel floats over the page untouched.
 */
export type OverlayType = 'none' | 'blur' | 'opacity';

/** The three overlay choices, for story controls and any menu that lists them. */
export const OVERLAY_OPTIONS: readonly OverlayType[] = ['none', 'blur', 'opacity'];
