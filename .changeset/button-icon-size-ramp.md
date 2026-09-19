---
'rn-motion-ui': patch
---

Add a shared `BUTTON_ICON_SIZE` ramp so an adornment icon scales with its button.

The leading/trailing icon size was copied per sibling — `IconButton` and `PrimaryActions` each kept their own `{ xs: 12, sm: 14, md: 16, lg: 20 }` table, and `ButtonSwap`'s icon slot was pinned at a fixed 16. They now all read the one `BUTTON_ICON_SIZE` ramp in `button-scale`, so an icon grows with the box it sits in and can't drift off its size. `ButtonSwap`'s leading slot now follows the button's `size` instead of staying 16, and `icon` resolves to `md`'s 16 (it's the `md` box squared).
