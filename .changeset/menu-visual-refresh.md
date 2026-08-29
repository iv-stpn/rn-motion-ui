---
'rn-motion-ui': minor
---

feat(menus): raise default elevation to 6, darken scrims, settle menu radius at 12 px

Every floating menu now rests at a consistent, higher elevation so panels
separate from the page:

- `BottomSheet` (3 → 6), `Drawer`, `FullSheet` and `MorphingMenu` (0 → 6),
  `HoverMenu` and `AdaptiveDropdown` (5 → 6), `Popover` (4 → 6).
- `CommandPalette` gains an `elevation` prop (default 6), matching the rest.

The dimming scrims behind each panel deepen in step: the light `bg-black/20`
scrim becomes `bg-black/40`, the `bg-foreground/20` backdrop becomes `/40`, and
the heavier modal scrims move up too (BottomSheet 45% → 60%, ActionFeedbackModal
40% → 50%).

Menu overlays settle on a 12 px radius (`--radius-menu` 6 → 12, `MENU_RADIUS`
16 → 12), and the `MenuItem` row scale is retuned — taller rows, larger icons
and labels — so the shared row reads the same in every menu.

`CommandPalette` also stops preselecting its first row on open: the highlight
appears only once you press a row.
