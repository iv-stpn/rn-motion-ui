---
'rn-motion-ui': patch
---

fix(HoldMenu): clamp menu travel to the provider root's height, not the window's

The menu's travel math clamped against `windowSize.height`, so when the
provider root is inset from the window — Storybook's padding decorator, a
menu nested inside a scroll view, a root that doesn't fill the screen — the
panel was placed against the wrong bottom and could render off-root. Each
activation now `measure`s the provider root and stores its height in a
shared value; the travel math and the always-mounted twin clamp against that
real bottom, falling back to the window height until the first activation
measures it.
