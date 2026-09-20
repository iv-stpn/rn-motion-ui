// The button family's press-scale resolution — the pure logic half of the tap
// interaction. `pressAnimate` turns the pressed flag, the mode and the requested
// scale into the MotiView `animate` value every button spreads into its wrapper.
// Kept data-only (no React, no Moti) so a unit test can drive it directly, the
// same way button-scale.ts and button-variants.ts keep the family's geometry and
// colour tables testable without a .tsx import.
//
// The two uniform modes are the direction the button travels on press: `scaleUp`
// grows it toward the settled scale, `scaleDown` shrinks it. The rest of the
// union (`scaleY` / `scaleX*`) compresses segmented-control segments, and `none`
// disables the animation.

export type PressMode = 'scaleUp' | 'scaleDown' | 'scaleY' | 'scaleX' | 'scaleXFirst' | 'scaleXLast' | 'none';

/** The settled scale a `scaleDown` press shrinks the button to. */
export const PRESS_SCALE_DOWN = 0.93;
/** The settled scale a `scaleUp` press grows the button to. */
export const PRESS_SCALE_UP = 1.05;

export type PressAnimateOpts = {
  pressed: boolean;
  blocked: boolean;
  pressMode: PressMode;
  /** Settled scale for the uniform `scaleUp`/`scaleDown` modes. Omitted → the
   *  mode's own default ({@link PRESS_SCALE_UP} / {@link PRESS_SCALE_DOWN}). */
  pressScale?: number;
};

/**
 * Resolves the MotiView `animate` value for the press animation. Each button
 * component calls this and spreads the result into its `animate` object.
 *
 * The uniform `scaleUp` (grow) and `scaleDown` (shrink) modes differ only in the
 * settled scale; `scaleY` / `scaleX*` compress a segmented-control segment in one
 * axis with a directional nudge, and `none` / `blocked` hold the button at rest.
 */
export function pressAnimate(opts: PressAnimateOpts) {
  const { pressed, blocked, pressMode, pressScale } = opts;
  if (pressMode === 'none' || blocked) return { scale: 1 };
  if (!pressed) {
    if (pressMode === 'scaleY') return { scaleY: 1, translateY: 0 };
    if (pressMode === 'scaleX' || pressMode === 'scaleXFirst' || pressMode === 'scaleXLast') return { scaleX: 1 };
    return { scale: 1 };
  }
  if (pressMode === 'scaleY') return { scaleY: 0.96, translateY: 2 };
  if (pressMode === 'scaleX') return { scaleX: 0.96 };
  if (pressMode === 'scaleXFirst') return { scaleX: 0.96, translateY: -1 };
  if (pressMode === 'scaleXLast') return { scaleX: 0.96, translateY: 1 };
  if (pressMode === 'scaleUp') return { scale: pressScale ?? PRESS_SCALE_UP };
  return { scale: pressScale ?? PRESS_SCALE_DOWN };
}
