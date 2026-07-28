import { type RefObject, useEffect } from 'react';
import { Platform, type View } from 'react-native';

// Tabbable descendants, in DOM order. react-native-web renders Pressable to
// <button> and TextInput to <input>, so the element selectors already cover the
// library's own controls; `[tabindex]` picks up anything a consumer made
// focusable by hand.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Focusable descendants that are actually rendered (a hidden one can't take focus). */
function focusableWithin(node: HTMLElement): HTMLElement[] {
  const all = [...node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
  return all.filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
}

/**
 * Keep keyboard focus inside `containerRef` while `active` — the web half of
 * modal semantics.
 *
 * On native, `accessibilityViewIsModal` (iOS) and the `Modal` component itself
 * (Android) already stop the screen reader and the focus ring from reaching the
 * content behind an overlay. The web has no such thing: react-native-web
 * renders `Modal` as an ordinary fixed-position `<div>`, so Tab walks straight
 * out of the dialog and into the page underneath it, where the user can operate
 * controls they cannot see. This closes that loop.
 *
 * Deliberately **Tab-only**. A `focusin` guard that yanked focus back would also
 * fight legitimate outside interaction — clicking away is a dismissal path these
 * overlays already handle, and hijacking it makes the page feel stuck. Pointer
 * users are not the ones a focus trap protects.
 *
 * Focus moves to the first focusable child on activation (or to the container
 * itself when the overlay has no controls yet, e.g. a loading state), and is
 * restored to whatever was focused before, provided that element is still in the
 * document. A no-op on native, so callers wire it unconditionally.
 */
export function useFocusTrap(containerRef: RefObject<View | null>, active: boolean): void {
  // biome-ignore lint/plugin: focus containment is an external DOM side effect — document-level key handling and imperative focus moves have no declarative RN equivalent.
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    // biome-ignore lint/plugin: on web RNW renders the View to a DOM element, so the ref is really an HTMLElement; RN's View type can't express that.
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.querySelectorAll) return;

    const doc = node.ownerDocument;
    const previouslyFocused = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;

    // -1 keeps the container out of the tab order while still allowing it to
    // hold focus, so an overlay with no controls has somewhere to put it.
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
    (focusableWithin(node)[0] ?? node).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = focusableWithin(node);
      const first = focusables[0];
      const last = focusables.at(-1);
      // Nothing to move to — hold focus where it is rather than letting Tab
      // escape to the page behind.
      if (!(first && last)) {
        event.preventDefault();
        return;
      }
      const current = doc.activeElement;
      // Focus already escaped (or sits on the container): pull it to the edge
      // the user is tabbing towards.
      if (!(current instanceof HTMLElement) || current === node || !node.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
        return;
      }
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    doc.addEventListener('keydown', onKeyDown);
    return () => {
      doc.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [containerRef, active]);
}
