import { type RefObject, useEffect } from 'react';
import { Platform, type View } from 'react-native';
import { isMenuNavKey, nextMenuIndex } from '../lib/menu-keyboard';

/**
 * Move focus between a menu's `menuitem` rows with the arrow keys — the web half
 * of menu keyboard navigation.
 *
 * react-native-web renders each `Pressable` row as a focusable `<div
 * role="menuitem">` (its own key handler already turns Enter/Space into a
 * press), so the only missing piece is roving focus: Tab gets the user *into*
 * the list, but nothing then lets them walk it. This adds that, ArrowUp/Down
 * cycling and Home/End jumping, scoped to keydown events that bubble up from a
 * row inside `containerRef` — so a key pressed while focus sits on the trigger
 * or the backdrop outside the menu is left alone.
 *
 * A no-op on native (touch menus have no focus ring to rove) and whenever the
 * list carries no `role="menu"` (the caller passes `active={false}` for
 * `role="none"`).
 */
export function useMenuKeyboardNavigation(containerRef: RefObject<View | null>, active: boolean): void {
  // biome-ignore lint/plugin: roving focus is an external DOM side effect — key handling and imperative focus moves have no declarative RN equivalent.
  useEffect(() => {
    if (Platform.OS !== 'web' || !active) return;
    // biome-ignore lint/plugin: on web RNW renders the View to a DOM element, so the ref is really an HTMLElement; RN's View type can't express that.
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.querySelectorAll) return;

    // Focusable menuitems, in DOM order. A disabled row is `aria-disabled` and
    // `tabindex="-1"`, and a hidden row can't take focus — both are skipped.
    const items = () =>
      [...node.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')].filter(
        (el) => el.tabIndex !== -1 && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0),
      );

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isMenuNavKey(event.key)) return;
      const list = items();
      if (list.length === 0) return;
      const current = document.activeElement instanceof HTMLElement ? list.indexOf(document.activeElement) : -1;
      const next = nextMenuIndex(current, list.length, event.key);
      const row = list[next];
      if (!row) return;
      event.preventDefault();
      row.focus({ preventScroll: true });
    };

    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [containerRef, active]);
}
