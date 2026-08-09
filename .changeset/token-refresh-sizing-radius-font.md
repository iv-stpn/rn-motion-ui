---
"rn-motion-ui": patch
---

**Token refresh: tighter sizing, smaller radius, new typography + background tokens**

Interactive surface heights reduced further (sm: 24, md: 32, lg: 40) and lg horizontal padding increased to 22px. Corner radius tightened: `--radius-interactive` 10→6px, `--radius-menu` 16→6px.

New tokens: `--color-background` (theme-flipping white/black), `--font-sans`, `--font-serif`, `--font-mono` (typography family stack), and `--menu-vertical-padding` (4px). The `background` colour is also added to the `ThemeToken` union and its OKLCH lookup tables so `useThemeColor('background')` resolves correctly in both schemes. The `Text` component gains a `font` prop (`"sans" | "serif" | "mono"`) that maps to the corresponding CSS utility class.
