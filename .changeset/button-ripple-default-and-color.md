---
'rn-motion-ui': minor
---

Ripple is now on by default for the button family, and the ripple wears the button's own foreground colour instead of a fixed white/dark shimmer.

Every button (`Button`, `ElevatedButton`, `ButtonSwap`, `IconButton`) now spawns a Material ripple on press unless `ripple={false}`. The ripple's colour is derived from the button's active ink — its `*-foreground` label colour, resolved through the theme — so the wash matches the variant and flips correctly in dark mode (previously a filled `primary` wore a hardcoded white shimmer that vanished against its near-white dark-mode fill). The ripple now blooms out on press-in, holds at full opacity while the button is pressed, and fades on release, instead of dissolving the instant it spawned.
