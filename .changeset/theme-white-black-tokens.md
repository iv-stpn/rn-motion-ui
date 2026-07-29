---
"rn-motion-ui": minor
---

Theme: `white` and `black` are now first-class tokens

Two absolute colors join the token sheet. Unlike every other color token they do **not** flip with the theme — `oklch(100% 0 0)` and `oklch(0% 0 0)` in light, dark, and on native — so they cover the places where a fixed color is the design intent rather than an oversight: a glyph sitting on a vivid status fill, a gloss highlight, a scrim.

They are available everywhere the other tokens are — the `bg-white` / `text-black` / `border-white` utilities, and `useThemeColor` / `useThemeColors`:

```tsx
<Text className="text-white">Legible on a vivid fill in both schemes</Text>
```

```ts
const white = useThemeColor('white'); // "rgb(255, 255, 255)"
```

`ThemeToken` gains `'white' | 'black'`, and both are declared in all three places a token lives — the `@theme` block, the two dark blocks, and the native OKLCH tables — so `check-token-parity` covers them like the rest. Being achromatic, they pass through `npx rn-motion-ui-tokens` retinting untouched.

Reach for these instead of a hardcoded `#fff` / `#000`. For anything that should track the theme, `foreground` / `surface-N` are still the answer.
