# rn-motion-ui

[![npm version](https://img.shields.io/npm/v/rn-motion-ui.svg)](https://www.npmjs.com/package/rn-motion-ui)
[![license](https://img.shields.io/npm/l/rn-motion-ui.svg)](./packages/ui/LICENSE)

**[Live demo →](https://iv-stpn.github.io/rn-motion-ui/)**

Animated React Native + React Native Web UI components, styled with Tailwind via [uniwind](https://github.com/nativewind/uniwind) and driven by a Moti / Reanimated 4 animation layer.

Components are written as React Native primitives — they compile to native (iOS / Android via Expo or bare RN) **and** to the web via `react-native-web` with a single shared codebase. No platform forks.

---

## Packages

| Package | Description |
| --- | --- |
| [`rn-motion-ui`](./packages/ui/) | Components, hooks, Moti layer, and utils — published as one package with subpath exports (no barrels) |

---

## Components

Every component lives at its own subpath — no barrel, no dead weight:

```ts
import { Button } from 'rn-motion-ui/button'
import { Card } from 'rn-motion-ui/card'
import { useInView } from 'rn-motion-ui/hooks/use-in-view'
```

> The lists below are generated from the package's `exports` map by
> `node packages/ui/scripts/check-readme.mjs --fix`, which CI re-runs on every push.

<!-- generated:components -->
`action-feedback-modal` · `action-swap` · `adaptive-dropdown` · `adaptive-modal` · `animated-badge` · `animated-list` · `animated-number` · `bloom-menu` · `bottom-sheet` · `bouncy-accordion` · `button` · `card` · `checkbox` · `checkbox-card` · `command-palette` · `cylinder-carousel` · `dock` · `drawer` · `dynamic-island` · `elevated-button` · `feedback-widget` · `file-system` · `file-tree` · `full-sheet` · `glossy-button` · `hover-menu` · `icon` · `input` · `loader` · `marquee` · `menu-item` · `morphing-modal` · `multi-step-menu` · `not-found` · `number-ticker` · `otp-input` · `overflow-actions` · `popover` · `radio` · `radio-card` · `range-slider` · `scroll-progress` · `scroll-reveal` · `scroll-to` · `skeleton` · `smooth-scroll` · `star-rating` · `stateful-button` · `swipeable-list` · `switch` · `table` · `tabs` · `text` · `text-cascade` · `text-reveal` · `text-rolling` · `text-shimmer` · `wheel-picker`
<!-- /generated:components -->

<details>
<summary>Hooks</summary>

<!-- generated:hooks -->
`hooks/direction-provider` · `hooks/use-arm-on-view` · `hooks/use-breakpoint` · `hooks/use-direction` · `hooks/use-focus-trap` · `hooks/use-hover-capable` · `hooks/use-in-view` · `hooks/use-interval` · `hooks/use-modal-render` · `hooks/use-mount-effect` · `hooks/use-page-visible` · `hooks/use-reduced-motion` · `hooks/use-safe-insets` · `hooks/use-scramble` · `hooks/use-shake-animation`
<!-- /generated:hooks -->
</details>

<details>
<summary>Utilities</summary>

Pure helpers and the theme layer — tokens, easings, the surface ladder, the icon set, and the runtime colour resolvers.

<!-- generated:utilities -->
`breakpoints` · `color` · `ease` · `elevated` · `icons` · `lib/cn` · `lib/typeguards` · `theme/motion` · `theme/use-theme-color`
<!-- /generated:utilities -->
</details>

<details>
<summary>Moti layer</summary>

Animated primitives: `moti/view` · `moti/text` · `moti/image` · `moti/scroll-view` · `moti/safe-area-view` · `moti/progress`

Presence: `moti/presence` · `moti/presence-context`

Pressable / hover: `moti/pressable` · `moti/pressable-context` · `moti/pressable-types` · `moti/hover` · `moti/hover-context` · `moti/merge`

Core / hooks: `moti/motify` · `moti/motify-svg` · `moti/use-motify` · `moti/use-animation-state` · `moti/use-dynamic-animation` · `moti/use-moti-pressable` · `moti/use-moti-pressables` · `moti/use-moti-pressable-animated-props` · `moti/use-moti-pressable-interpolate` · `moti/use-moti-pressable-transition`

Types / constants: `moti/types` · `moti/color-keys`
</details>

<details>
<summary>Table helpers</summary>

<!-- generated:table -->
`table-header` · `table-row` · `table-types` · `table-utils` · `use-column-reorder` · `use-table`
<!-- /generated:table -->
</details>

<details>
<summary>Advanced / internal</summary>

The shell and presence hook the sheet family (`bottom-sheet`, `full-sheet`, `drawer`, `adaptive-modal`) is built on. Exported so a consumer can build a sheet of their own on the same primitives — but they are infrastructure, not a component API, and they change with the components that use them rather than on their own deprecation cycle.

<!-- generated:internal -->
`overlay/overlay-shell` · `overlay/use-sheet-presence`
<!-- /generated:internal -->
</details>

---

## Consumer setup

This package ships **TypeScript source** — no prebuilt bundles. Two build-time plugins are required:

1. **`react-native-reanimated/plugin`** (Babel) — transforms Reanimated worklets.
2. **`uniwind`** — resolves `className` props on RN components to styles at build time.

### Native (Expo / Metro)

`babel.config.js`:

```js
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'],
};
```

Set up `uniwind` per its [docs](https://github.com/nativewind/uniwind) (Metro transformer + `global.css` Tailwind entry).

### Web (Vite / react-native-web)

Alias `react-native` → `react-native-web`, pipe the Reanimated Babel plugin through your React transform, and add the `uniwind` Vite plugin. See [`storybook/web/.storybook/main.ts`](./storybook/web/.storybook/main.ts) for a complete working reference.

> **`optimizeDeps` note:** Uniwind excludes `react-native` from Vite's dep optimizer, which breaks `@react-native/normalize-colors`. The reference config force-includes `react-native-web` to work around this.

---

## Theming

Import the token sheet in your global CSS, then override any token in a later `@theme` block:

```css
@import "tailwindcss";
@import "uniwind";
@import "rn-motion-ui/tokens.css";

@theme {
  --color-primary: oklch(52% 0.22 250); /* your brand color */
}
```

### Surface elevation ladder

Backgrounds follow [cubby-ui's surfaces system](https://www.cubby-ui.dev/docs/getting-started/surfaces): an elevation ladder `surface-1` … `surface-8` with paired shadow recipes.

| Class | Role |
| --- | --- |
| `bg-surface-1` | Page background |
| `bg-surface-3` | Cards, popovers, dialogs, inputs |
| `bg-surface-4`–`8` | Stacked overlays |
| `shadow-surface-N` | Elevation shadow — pair with the matching `bg-surface-N` |
| `bg-surface-hover` | Translucent hover overlay on any surface level |
| `bg-surface-selected` | Translucent selected overlay on any surface level |

In light mode, surfaces 3+ are pure white and shadows alone carry depth. In dark mode each level steps up in lightness with a subtle neutral tint (hue 270, chroma 0.004).

### Status triads

`success` / `warning` / `info` / `danger` / `special` each ship as a vivid fill plus a white foreground, so a filled status plate is two classes:

```tsx
<View className="rounded-lg bg-success p-3">
  <Text className="text-success-foreground">Saved!</Text>
</View>
```

`danger` is the destructive fill. `special` is the one non-semantic member — a promotion or an upgrade path, where the other four each carry a meaning. `warning`, `info` and `special` hold the same value in both schemes; they already sit at mid lightness, so there is nothing a dark-mode lift fixes.

### Absolute colors

`white` and `black` are the two tokens that do **not** flip with the theme — identical in light and dark, on web and native. They cover the cases where a fixed color is the design intent rather than an oversight: a glyph on a vivid status fill, a gloss highlight, a scrim.

```tsx
<Text className="text-white">On a vivid fill in both schemes</Text>
```

```ts
const white = useThemeColor('white'); // "rgb(255, 255, 255)"
```

Reach for them instead of a hardcoded `#fff` / `#000`. For anything that should track the theme, use `foreground` / `surface-N`.

### Elevation prop

Surface components (`Card`, `Popover`, `AdaptiveDropdown`, `HoverMenu`, `MorphingModal`, `ActionFeedbackModal`, `AdaptiveModal`, `FeedbackWidget`) accept an `elevation` prop (`1`–`8`). It drives the background, drop shadow, and — in dark mode — the inset rim highlight together, keeping fill and rim calibrated at the same level.

### Runtime color access (native / Reanimated)

`useThemeColor(token)` / `useThemeColors()` (from `rn-motion-ui/theme/use-theme-color`) resolve tokens to concrete sRGB strings for RN StyleSheet, SVG props, and Reanimated color animations. On web they read live CSS variables; on native they fall back to static maps derived from the same OKLCH definitions via `rn-motion-ui/color` — a pure-formula OKLCH → sRGB converter you can also use directly.

```ts
import { oklchToSrgb, cssColorToSrgb } from 'rn-motion-ui/color'
```

---

## Development

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.x
- Node.js ≥ 20 (for Playwright)

### Install

```sh
bun install
```

### Storybook

```sh
bun run storybook          # web (Vite, hot reload)
bun run storybook:native   # iOS/Android via Expo Go
```

### Lint, typecheck & test

```sh
bun run lint          # Biome — whole workspace
bun run lint:fix      # auto-fix
bun run typecheck     # tsc --noEmit across all packages
bun run test          # Vitest + Playwright interaction tests (real Chromium)
```

<!-- generated:counts -->
57 story files, 185 stories.
<!-- /generated:counts -->
Every story runs as a vitest test; those with a `play` function run their interaction assertions in a real Chromium browser via `@storybook/addon-vitest`. `packages/ui` also carries a jsdom unit suite over the pure layers (Moti worklets, `lib/`, the FileTree controller, the OTP edit logic).

---

## Releasing

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

```sh
bun run changeset          # describe your change
bun run version-packages   # bump versions + generate changelogs
bun run release            # publish to npm
```

CI (`.github/workflows/release.yml`) runs the changesets action on every push to `main` — it either opens a "Version Packages" PR or publishes if that PR is already merged.

---

## Architecture notes

- **No barrels** — every component has its own subpath export; consumers only bundle what they import.
- **`sideEffects: ["**/*.css"]`** — CSS token file is side-effectful; all TS source is tree-shakeable.
- **`useReducedMotion`** consumed by every animated component — respects the OS reduced-motion preference.
- **Strict TypeScript** across the workspace (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`).
- **Biome** for linting and formatting (184 files, lint-clean baseline).
- **Husky** pre-commit (lint + typecheck) and pre-push (test) hooks.

---

## Acknowledgements

- Many components in this library are inspired by or adapted from **[beUI](https://github.com/starc007/ui-components)** — a motion component library for React / Next.js by Saurabh Chauhan. beUI's component designs and interaction patterns were ported to the React Native primitive model, swapping Framer Motion for Moti / Reanimated.
- Token system and surface ladder follow the conventions of **[cubby-ui](https://www.cubby-ui.dev/docs/getting-started/surfaces)**.
- Animation layer built on **[Moti](https://moti.fyi/)** by Fernando Rojo.

---

## License

[MIT](./packages/ui/LICENSE) © Ivan Stepanian
