---
"rn-motion-ui-icons": minor
---

**Icon `color` prop now accepts theme tokens with full autocomplete.**

Pass any `ThemeToken` value (`"primary"`, `"muted-foreground"`, `"danger"`, …) directly to an icon's `color` prop and the icon will resolve it live — updating automatically when the color scheme changes, just like `useThemeColor` would.

```tsx
// before — manual resolution required
const color = useThemeColor('primary');
<ArrowRightLine color={color} />

// after — token passed directly, stays reactive
<ArrowRightLine color="primary" />
```

Raw strings (hex, rgb, named CSS colors) and the omit-for-default behaviour are unchanged.

**Type change:** `color` on `IconProps` is now `ThemeToken | (string & {})` instead of `string`. This is source-compatible — all existing string assignments still compile — but IDEs will now surface the full token list as autocomplete suggestions.
