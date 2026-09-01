---
'rn-motion-ui': patch
---

fix(HoldMenu): correct the teleported overlay's vertical position

The Android overlay host is a sibling of the `BlurTarget`, so its containing
block is the `BlurProvider`'s parent — which is inset from the window whenever
something sits above the provider (storybook's chrome, a header, a nested
screen). The teleported menu and twins were re-adding only the root's page
offset to their root-space coordinates, which positioned them in window space
and left them `hostPageY` too low.

The overlay host now measures its own window offset and the teleported menu and
twins subtract it, so root-space coordinates convert into host space exactly and
the menu lands where it would have inside the root. Inline overlays (iOS/web,
and Android without the blur peer) are unchanged.
