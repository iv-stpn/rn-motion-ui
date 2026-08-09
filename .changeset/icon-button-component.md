---
"rn-motion-ui": minor
---

**New `IconButton` component — a purpose-built icon-only button superceding `Button size="icon"`**

`IconButton` is a standalone component for icon-only actions. It shares the same 8 visual variants as `Button` (`primary`, `secondary`, `ghost`, `danger`, `special`, `inverse`, `outlineDanger`, `ghostDanger`) and adds the `icon` / `iconBackgroundColor` / `iconColor` API from `MenuItem` for coloured icon tiles (iOS Settings style).

Key differences from `<Button size="icon">`:
- `icon` prop takes a `ComponentType<IconProps>` — the icon component itself, not a pre-built element
- `iconBackgroundColor` optionally wraps the icon in a coloured rounded-square tile
- `iconColor` overrides the variant-derived icon stroke colour
- `accessibilityLabel` is **required** — an icon-only button needs an accessible name
- No `children`, `leftAdornment`, or `rightAdornment` — the icon IS the content
- Sizes: `'sm' | 'md' | 'lg'` (24×24, 32×32, 40×40 px squares)

Existing `<Button size="icon">` continues to work. `ButtonSpinner` is now exported from `button-internals` to power the loading state.
