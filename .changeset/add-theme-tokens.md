---
"rn-motion-ui": minor
---

Add semantic color token system (`tokens.css`, `use-theme-color.ts`).

- New `tokens.css` — Tailwind `@theme` block with `--color-*` CSS custom properties for light and dark modes (surface, foreground, primary, destructive, success, warning, etc.)
- New `use-theme-color` hook — reads tokens from CSS custom properties on web (respects consumer `@theme` overrides) and from a static light/dark map on native
- New `useThemeColors` convenience hook returning the full token map at once
