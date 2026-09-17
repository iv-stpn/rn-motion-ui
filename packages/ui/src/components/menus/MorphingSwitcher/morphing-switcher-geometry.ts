/**
 * morphing-switcher-geometry — the pure shell/pane geometry for MorphingSwitcher.
 *
 * `opensUpward` decides whether the pane flips above the trigger; `computePaneHeight`
 * fits the open pane to its items (or honours a pinned height); `mergeTriggerSize`
 * is the identity-preserving merge that lets `useState` skip a re-render on an
 * unchanged measurement. Kept out of the component so the math is unit-testable.
 * Data only, no React — see `morphing-switcher-scale.ts` for the same contract.
 */

import type { SwitcherScale } from './morphing-switcher-scale';

/** Minimum clearance kept between the open pane and the viewport edge when deciding whether to flip up. */
export const VIEWPORT_PADDING = 8;

/** `p-1` inset between the shell edge and its content, so the trigger and hover pills never run flush to the pane rim. */
export const PANE_INSET = 4;

/**
 * Whether the pane should open above the trigger. `y`/`h` are the trigger's
 * window-space top and height; the pane opens upward when it does not fit below
 * and there is more room above than below.
 */
export function opensUpward(paneHeight: number, y: number, h: number, windowHeight: number): boolean {
  const spaceBelow = windowHeight - y - h - VIEWPORT_PADDING;
  const spaceAbove = y - VIEWPORT_PADDING;
  return paneHeight > spaceBelow && spaceAbove > spaceBelow;
}

/**
 * The pane's open height: one row per item stacked on the trigger's height, plus
 * the shell's `p-1` inset on both ends — overridden by `expandedHeight` when the
 * consumer pins an exact height.
 */
export function computePaneHeight(scale: SwitcherScale, itemCount: number, expandedHeight: number | undefined): number {
  return expandedHeight ?? scale.height + itemCount * scale.height + PANE_INSET * 2;
}

/** A measured trigger's bounding box. */
export type TriggerSize = { width: number; height: number };

/**
 * Merge a freshly-measured trigger size, returning the previous object unchanged
 * when the dimensions match. `useState` then bails out on identity, so a layout
 * pass that reports the same size does not re-render.
 */
export function mergeTriggerSize(prev: TriggerSize | null, size: TriggerSize): TriggerSize {
  if (prev && prev.width === size.width && prev.height === size.height) return prev;
  return size;
}
