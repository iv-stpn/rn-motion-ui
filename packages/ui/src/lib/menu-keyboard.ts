/** The keys that move a menu's focus highlight. Enter/Space are not here — a
 *  `Pressable` row already turns those into its own press on web, so the menu
 *  only owns the roving-focus keys. */
export type MenuNavKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

/** Narrows a DOM key string to the menu-roving keys. */
export function isMenuNavKey(key: string): key is MenuNavKey {
  return key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End';
}

/**
 * Next focus index for a roving-focus key, wrapping at the ends.
 *
 * `current` is the index of the currently focused row, or `-1` when focus has
 * not yet landed inside the menu (it sits on the container or the trigger).
 * From `-1`, ArrowDown goes to the first row and ArrowUp to the last, matching
 * the WAI-ARIA menu pattern; Home/End jump to the ends regardless.
 *
 * Pure arithmetic so the wrap-around stays under unit test — the DOM half that
 * consumes it (`useMenuKeyboardNavigation`) is exercised through the story
 * harness, not here.
 */
export function nextMenuIndex(current: number, length: number, key: MenuNavKey): number {
  if (length <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (current < 0 || current >= length) return key === 'ArrowUp' ? length - 1 : 0;
  if (key === 'ArrowUp') return (current - 1 + length) % length;
  return (current + 1) % length;
}
