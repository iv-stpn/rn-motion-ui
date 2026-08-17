---
'rn-motion-ui': minor
---

feat(ui): hold-menu — `HoldItem` gains drag, activation callbacks, and disabled rows; file-system migrates onto it

- **Drag**: `HoldItem` accepts `dragOptions`, upgrading its hold into a drag
  source through the same `useDraggable` plumbing the file-system rows and
  tiles already resolve. A hold still opens the menu, and a move past
  `escapeSlop` closes the menu (and its overlay) before the ghost lifts.
  Native-only — on web the menu is a right-click with no hold gesture to
  upgrade, and a `hold` item with no drag now falls back to a touch long-press.
- **Activation callbacks**: `HoldItem` fires `onHold` on any activation (hold,
  tap, double-tap) and `onOpenChange` on open and close. A side-effect such as
  a multi-select toggle can ride the same gesture that opens the menu — and
  still fires when `items` is empty. `disabled` makes the trigger fully inert.
- **Disabled rows**: `MenuItemProps.disabled` greys a row out and blocks its
  press, mirroring the `HoldContextMenu` states the file-system's
  "No actions available" and disabled-action rows need.
- **File-system migration**: every entry view wraps rows and tiles in
  `HoldItem` inside a `HoldMenuProvider` anchored to the file area, replacing
  `HoldContextMenu`. The lifted twin is now hidden from the accessibility tree
  (`aria-hidden` / `importantForAccessibility`), so entries no longer read
  twice to screen readers; story assertions were updated to tolerate the
  duplicate copy.
