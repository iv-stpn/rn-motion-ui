---
'rn-motion-ui': patch
---

fix(HoldMenu): keep the teleported Android overlay scoped to its local container

The overlay host that restored Android's backdrop blur teleports the backdrop,
menu and twins out of the `BlurTarget` into a full-screen sibling — whose
containing block is the window, not the `HoldMenuProvider`'s root. The menu and
twins compute their `top`/`left` in the root's coordinate space, so rendering
them in the window-space host displaced them by the root's page offset (any
inset root: a header above the provider, storybook's padding, a nested screen).

The provider now mirrors the root's measured page offset into shared values and
the teleported menu/twins re-add it, so they land exactly where they would have
inside the root. Inline overlays (iOS/web, and Android without the blur peer)
are unchanged.
