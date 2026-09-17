---
'rn-motion-ui': patch
---

Colour outline buttons and stateful icons from the foreground token

The `outline` button variant now draws its border with the `foreground`
token — white on dark, black on light — instead of the subtle `border`
hairline, so it reads as a high-contrast outline in both themes. The
StatefulButton stories now colour the idle icon from the active variant's
foreground and expose a Variants gallery plus a variant control.
