---
"rn-motion-ui": patch
---

Fix manual light-mode override so it wins over an OS `prefers-color-scheme: dark` preference.

The `@media (prefers-color-scheme: dark)` block in `tokens.css` previously targeted `:root` unconditionally, so selecting light (no `.dark` class) while the OS was dark still resolved to the dark tokens. The block is now gated on `:root:not(.light)`: a `.light` class (on `<html>` or any ancestor) opts out of the automatic OS-preference dark values and falls back to the `@theme` light defaults. `.dark` continues to force dark over an OS-light preference. Backward compatible — no existing selector loses behavior; `.light` is simply now a documented absolute override.
