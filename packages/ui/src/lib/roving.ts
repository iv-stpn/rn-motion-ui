/**
 * Arrow-key roving for widgets that move selection as you arrow through them —
 * Tabs (ArrowLeft/Right) and Radio groups (ArrowUp/Down, or Left/Right when
 * horizontal). Home/End are deliberately absent: they mean "jump to the ends"
 * only where a widget opts into them (the menu pattern does, via
 * `nextMenuIndex`); tabs and radio groups just cycle.
 */

/** The arrow keys that rove a widget's selection. */
export type RovingArrow = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

/** Narrows a DOM key string to the roving arrow keys. */
export function isRovingArrow(key: string): key is RovingArrow {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';
}

/**
 * Next selection index for an arrow key, wrapping at the ends.
 *
 * `ArrowUp`/`ArrowLeft` move back, `ArrowDown`/`ArrowRight` move forward.
 * `current` is the index of the selected item, or `-1` when nothing is selected
 * yet; from `-1` a forward key lands on the first item and a backward key on the
 * last.
 *
 * Pure arithmetic so the wrap-around stays under unit test — the DOM half that
 * consumes it lives in the component hooks, exercised through the story harness.
 */
export function nextRovingIndex(current: number, length: number, key: RovingArrow): number {
  if (length <= 0) return -1;
  const back = key === 'ArrowUp' || key === 'ArrowLeft';
  if (current < 0 || current >= length) return back ? length - 1 : 0;
  return back ? (current - 1 + length) % length : (current + 1) % length;
}
