---
'rn-motion-ui': patch
---

fix(Surface): composite the `glass` tint over the native frost

A frosted `Surface` (`blurRadius > 0`) on native rendered the backdrop blur but
never composited the translucent `glass` tint over it — the web twin does both
(`backgroundColor: tint` alongside `backdropFilter`), so the two platforms
disagreed. On the native blur path the `BlurView` was the whole frost layer and
the tint was only rendered on the degrade path, which meant:

- a frosted pane had no `glass` wash, so in light mode it came out *darker* than
  the page behind it (measured 234,236,236 over a 237,238,241 backdrop) and read
  as a dull flat plate rather than a translucent panel;
- `opacity` was completely inert whenever the blur rendered at all — `1` and
  `0.5` produced pixel-identical output on iOS and Android alike, so the prop
  only ever did anything on the degrade path.

The tint layer is now rendered on both paths, over the `BlurView` by render
order (both at `zIndex: 0`, so the Rim and `children` stay above it). The blur's
own material was dropped from `light`/`dark` to `ultra-thin-material-light`/
`dark` so it no longer compounds with the `glass` wash layered on top — and
because it derives from `useColorScheme()` like the tint does, the two can no
longer drift apart when an app forces a scheme via `Appearance.setColorScheme`,
which the adaptive `regular` would have done by reading the OS trait
collection / `uiMode` instead.

The degrade path (no peer installed, or an Android pane inside its own
`BlurTarget`) and the solid path (`blurRadius: 0`) are untouched — the solid
control measures byte-identical before and after on both platforms. Note the
Android blur path only fires for a pane rendered as a *sibling* of the
`BlurTarget` it frosts (the `OverlayHost` shape); an in-app pane is inside the
target and degrades, which is a separate, intentional limitation.
