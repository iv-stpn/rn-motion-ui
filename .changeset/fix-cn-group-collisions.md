---
"rn-motion-ui": patch
---

Fix `cn` conflict-resolution group collisions for `flex-*` and `border-*` utilities.

- `flex-row`/`flex-col`/… (flex-direction) and `flex-1`/`flex-auto`/… (the flex shorthand) are different properties, so they now get separate groups. Previously they shared one `flex-direction` group, so `flex-row flex-1` collapsed and the direction utility was dropped.
- Border-width patterns (`border-b`, `border-t`, `border-2`, …) are now matched before the border-color catch-all. The color regex matched the side letter in `border-b`, so `border-b border-border` previously collapsed both into the color group and the one-sided border *width* was silently dropped.
