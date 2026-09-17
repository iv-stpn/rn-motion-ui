---
'rn-motion-ui': minor
---

Simplify the elevation system to three levels plus flat

The surface elevation ladder collapses from eight levels to three, keeping
`0` as the flat resting surface. `SurfaceLevel` / `SurfaceElevation` narrow
to `1 | 2 | 3` (plus `0`), and the `surface-4`…`-8`, `shadow-surface-4`…`-8`,
`shadow-elevated-4`…`-8` and `surface-rim-4`…`-8` tokens are removed.

Breaking changes:

- Inline controls (Button, IconButton, CloseButton, Card, Input,
  CheckboxCard, RadioCard, WheelPicker, SwipeableList, MorphingFAB,
  MorphingSwitcher, row-group) now default to `elevation = 0` — flat, with no
  shadow or border — instead of `3`. Elevation is reserved for modals and
  elevated menus.
- Menus and modals (AdaptiveDropdown, AdaptiveModal, BottomSheet,
  CommandPalette, Drawer, FullSheet, HoverMenu, MorphingMenu, MorphingModal,
  Popover, ActionFeedbackModal) now float at `elevation = 3` instead of `6`.
  The level-3 shadow is re-tuned to the former level-6 weight, so the top
  rung still reads as a modal or menu.
- Dark-mode surface fills no longer step lighter with elevation — depth in
  dark mode comes from the shadow alone (`surface-1/2/3` only).
