/**
 * Web keyboard-focus ring — the keyboard half of the hover classes. Hover styles
 * the pointer; this styles the keyboard. A 2px brand-coloured outline offset from
 * the control, shown only on keyboard focus (`:focus-visible`), never on pointer
 * focus.
 *
 * `outline` (not `ring`) so it never fights the elevation `box-shadow` the same
 * element wears — an outline sits outside the box and composites independently.
 * Applies to any focusable control: Button, IconButton, Menu rows, Tabs.
 *
 * No `disabled` gate is needed at the call site: a disabled control can't
 * receive focus, so `:focus-visible` never matches it — unlike `:hover`, which
 * does match disabled elements and so needs the `!isDisabled` guard that the
 * hover classes carry.
 */
export const FOCUS_VISIBLE_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
