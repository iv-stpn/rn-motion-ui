import { type RefObject, useEffect } from 'react';
import { Platform, type View } from 'react-native';
import { isRovingArrow, nextRovingIndex } from '../lib/roving';

type ArrowRovingOptions = {
  /** CSS role selector for the focusable items, e.g. `[role="tab"]`. */
  role: string;
  /** The axis the arrow keys move along. */
  axis: RovingAxis;
  /** Ordered item values, index-aligned with the DOM order of the `role` items. */
  values: readonly string[];
  /** The currently selected value — the roving-tabindex owner, and the fallback "current" index. */
  selected: string;
  /** Move selection to `value` when an arrow lands on it. */
  onSelect: (value: string) => void;
};

/** Which arrow keys rove a widget: Left/Right for horizontal, Up/Down for vertical. */
export type RovingAxis = 'horizontal' | 'vertical';

/**
 * Arrow-key roving that moves BOTH focus and selection — the tab / radio
 * pattern, as opposed to {@link useMenuKeyboardNavigation}, which roves focus
 * only and leaves Enter/Space to the row's own press. On an arrow key the next
 * item is focused and its value handed to `onSelect`.
 *
 * `values` is index-aligned with the DOM items, so the handler can turn the
 * computed index back into a value without threading `data-*` attributes through
 * every item. The caller keeps it as a stable array (mutated in place as items
 * mount) so this effect doesn't re-subscribe every render.
 */
export function useArrowRoving(
  containerRef: RefObject<View | null>,
  { role, axis, values, selected, onSelect }: ArrowRovingOptions,
): void {
  // biome-ignore lint/plugin: arrow-key selection is an external DOM side effect — key handling and imperative focus moves have no declarative RN equivalent.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // biome-ignore lint/plugin: on web RNW renders the View to a DOM element, so the ref is really an HTMLElement; RN's View type can't express that.
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.querySelectorAll) return;

    const items = () => [...node.querySelectorAll<HTMLElement>(role)];
    const matchesAxis = (key: string) =>
      axis === 'horizontal' ? key === 'ArrowLeft' || key === 'ArrowRight' : key === 'ArrowUp' || key === 'ArrowDown';

    // `role` items in DOM order, paired with their positional value, minus the
    // disabled ones. Pairing before the filter keeps `values` index-aligned with
    // the DOM even when a disabled item sits between enabled ones, and the filter
    // stops an arrow key from landing on (or selecting) a disabled item.
    const enabled = () => {
      const out: { el: HTMLElement; value: string }[] = [];
      for (const [i, el] of items().entries()) {
        // `aria-disabled` covers RNW's div-based roles (tab/radio); `:disabled`
        // covers any native form control a caller might rove over.
        const disabled = el.getAttribute('aria-disabled') === 'true' || el.matches(':disabled');
        if (!disabled) out.push({ el, value: values[i] ?? '' });
      }
      return out;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (!(isRovingArrow(key) && matchesAxis(key))) return;
      const list = enabled();
      if (list.length === 0) return;
      // Current index: the focused item, else the selected one, else -1 (the
      // "not yet landed" sentinel `nextRovingIndex` handles).
      let current = -1;
      const active = document.activeElement;
      if (active instanceof HTMLElement) current = list.findIndex(({ el }) => el === active);
      if (current === -1) current = list.findIndex(({ value }) => value === selected);

      event.preventDefault();
      const next = nextRovingIndex(current, list.length, key);
      const target = list[next];
      if (!target) return;
      if (target.value !== selected) onSelect(target.value);
      target.el.focus({ preventScroll: true });
    };

    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [containerRef, role, axis, values, selected, onSelect]);
}
