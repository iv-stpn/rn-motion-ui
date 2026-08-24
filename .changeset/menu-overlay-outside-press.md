---
'rn-motion-ui': major
---

feat: add `overlay` + `closeOnOutsidePress` to every menu; rename legacy outside-press props

Every menu now takes two independent props, both defaulting to `true`:

- **`overlay`** — whether the dimming backdrop/scrim is rendered behind the panel. Set `false` to float the panel over the page with no scrim.
- **`closeOnOutsidePress`** — whether tapping/clicking outside the panel closes it. Set `false` to require an explicit dismiss action (close button, back gesture, etc.).

Because they are independent, all four combinations are available: dim + close, dim + no-close, transparent + close, transparent + no-close.

**Breaking prop renames** (the major bump):

- `BottomSheet` / `AdaptiveModal`: `closeOnOverlayClick` → `closeOnOutsidePress`.
- `Drawer`: `dismissable` → `closeOnOutsidePress`.

`FullSheet`'s `dismissable` (overall dismissability, not an outside-press toggle) and the date-picker hooks are unchanged.

Affected components: `BottomSheet`, `AdaptiveModal`, `CommandPalette`, `MultiStepMenu`, `AdaptiveDropdown`, `Popover`, `HoverMenu`, `Drawer`, `MorphingModal`, `ActionFeedbackModal`, and `HoldMenuProvider`.

Note: `HoverMenu`'s `overlay` only applies on native — a web hover menu has no scrim by design, since one would cover the trigger and break hover continuity.
