---
'rn-motion-ui': minor
---

fix(HoldMenu): restore the real backdrop blur on Android by moving the overlay out of the `BlurTarget`

The earlier Android crash fix (`hold-menu-open-commit-race`) made HoldMenu's
backdrop degrade to a plain translucent dim on Android — the only way to keep
the inline `BlurView` from cycling the peer's RenderNode graph. This change
restores the frosted-glass scrim without the crash by lifting the overlay out
of the target entirely.

- `BlurProvider` now renders an `OverlayHost` as a **sibling** of its
  `BlurTarget`. On Android HoldMenu teleports its backdrop + menu (and each
  `HoldItem`'s twin) into that host through a new internal `overlay-host`
  portal, so the target-based blur captures only the page — not the menu it
  sits under — and the overlay paints crisp above it. A scrim left inside the
  target would either crash (the RenderNode cycle) or frost the menu.
- The overlay pieces now read the menu's shared values from a module-store
  mirror (`context.ts`) because the teleported nodes render in the host's tree,
  outside the `HoldMenuInternalContext.Provider`; in-tree consumers (each
  `HoldItem`) keep reading React context unchanged.
- iOS/web are untouched: their blur is a true backdrop (`UIVisualEffectView` /
  CSS `backdrop-filter`), so the overlay stays inline under the existing
  `PortalProvider` path.

MorphingFAB/MorphingSwitcher keep their dim-only fallback on Android: their
pane must stay in the same view hierarchy as its trigger for the morph
transition, so it cannot be lifted out of the `BlurTarget` the way HoldMenu's
menu can.
