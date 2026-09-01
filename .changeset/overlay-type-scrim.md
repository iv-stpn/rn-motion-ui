---
'rn-motion-ui': patch
---

feat(menus): `overlay` becomes an `OverlayType` — menus gain a dim-only scrim

The menu `overlay` prop moves from a boolean to an `OverlayType` union
(`"blur" | "opacity" | "none"`), so a scrim can keep the frost (`"blur"`), drop
to a plain translucent dim (`"opacity"` — lighter on the GPU, and the right call
on dense small-screen surfaces where the blur is lost), or render nothing
(`"none"`).

- Every overlay menu (Drawer, BottomSheet, FullSheet, AdaptiveModal,
  AdaptiveDropdown, ActionFeedbackModal, CommandPalette, HoverMenu, Popover,
  MorphingFAB, MorphingMenu, MorphingModal, MorphingSwitcher, MultiStepMenu,
  HoldMenu) accepts the union, defaulting to `"blur"` — except
  **AdaptiveDropdown, HoverMenu, and Popover**, which now default to `"none"`
  so a floating surface no longer dims the page behind it by default.
- `AdaptiveModal` adds `smallScreenOverlay` so the bottom-sheet branch can
  lighten or drop its scrim while the wide panel keeps `overlay`.

Internally the per-file `overlay ? <OverlayBlur/> : <dim/>` branches collapse
into one shared `OverlayScrim` (internal, not exported), and the largest
cognitive-complexity hotspots — the Table header, the FileSystem row-animation
hook, and the moti `animationConfig` worklet — are split into named helpers so
their `biome-ignore` suppressions could be removed. No behaviour change beyond
the `overlay` prop above.
