# rn-motion-ui

[![npm version](https://img.shields.io/npm/v/rn-motion-ui.svg)](https://www.npmjs.com/package/rn-motion-ui)

**[Live demo →](https://iv-stpn.github.io/rn-motion-ui/)**

A monorepo of animated React Native + React Native Web UI components, styled with Tailwind via [uniwind](https://github.com/nativewind/uniwind) and powered by a custom Moti/Reanimated 4 layer.

Components are written as React Native primitives — they run on native (iOS/Android via Expo or bare RN) **and** on the web via `react-native-web`, with a single shared codebase.

---

## Package

| Package | Description |
| --- | --- |
| [`rn-motion-ui`](./packages/ui/) | Animated RN + RNW UI components, Moti/Reanimated 4 primitives, hooks, and utils — published as one package with subpath exports (no barrels) |

Every export lives at its own subpath — no barrel, no dead weight. Four namespaces:

| Namespace | Subpath pattern | Example |
| --- | --- | --- |
| **Components** | `rn-motion-ui/<name>` | `import { Button } from 'rn-motion-ui/button'` |
| **Hooks** | `rn-motion-ui/hooks/<name>` | `import { useInView } from 'rn-motion-ui/hooks/use-in-view'` |
| **Moti layer** | `rn-motion-ui/moti/<name>` | `import { MotiView } from 'rn-motion-ui/moti/view'` |
| **Lib / utils** | `rn-motion-ui/ease`, `…/icons`, `…/utils/typeguards` | `import { spring } from 'rn-motion-ui/ease'` |

### Components

`action-feedback-modal` · `action-swap` · `adaptive-dropdown` · `adaptive-modal` · `animated-badge` · `animated-list` · `animated-number` · `availability-scheduler` · `bloom-menu` · `bottom-sheet` · `bouncy-accordion` · `button` · `card` · `card-choice` · `checkbox` · `command-palette` · `cylinder-carousel` · `dock` · `drawer` · `dynamic-island` · `feedback-widget` · `file-upload` · `full-sheet` · `hover-menu` · `input` · `loader` · `marquee` · `morphing-modal` · `multi-step-menu` · `not-found` · `number-ticker` · `otp-input` · `overflow-actions` · `popover` · `radio` · `range-slider` · `scroll-progress` · `scroll-reveal` · `scroll-to` · `skeleton` · `smooth-scroll` · `stateful-button` · `swipeable-list` · `switch` · `table` · `tabs` · `text-cascade` · `text-reveal` · `text-rolling` · `text-shimmer` · `wheel-picker`

### Hooks

`hooks/use-arm-on-view` · `hooks/use-hover-capable` · `hooks/use-in-view` · `hooks/use-interval` · `hooks/use-modal-render` · `hooks/use-mount-effect` · `hooks/use-page-visible` · `hooks/use-reduced-motion` · `hooks/use-scramble` · `hooks/use-shake-animation`

### Moti layer

Animated primitives: `moti/view` · `moti/text` · `moti/image` · `moti/scroll-view` · `moti/safe-area-view` · `moti/progress`

Presence: `moti/presence` · `moti/presence-context`

Pressable / hover: `moti/pressable` · `moti/pressable-context` · `moti/pressable-types` · `moti/hover` · `moti/hover-context` · `moti/merge`

Core / hooks: `moti/motify` · `moti/motify-svg` · `moti/use-motify` · `moti/use-animation-state` · `moti/use-dynamic-animation` · `moti/use-moti-pressable` · `moti/use-moti-pressables` · `moti/use-moti-pressable-animated-props` · `moti/use-moti-pressable-interpolate` · `moti/use-moti-pressable-transition`

Types / constants: `moti/types` · `moti/color-keys`

### Table helpers

The `table` component ships several companion subpaths: `table-header` · `table-row` · `table-styles` · `table-types` · `table-utils` · `use-table` · `use-column-reorder`

---

## Development

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.x
- Node.js ≥ 20 (for Playwright)

### Install

```sh
bun install
```

### Storybook (web)

Runs the full component library in a browser with hot reload:

```sh
bun run storybook
```

### Storybook (native)

Runs the component library on a simulator or device via Expo Go / bare RN:

```sh
bun run storybook:native
```

### Lint & typecheck

```sh
bun run lint         # Biome — whole workspace
bun run lint:fix     # auto-fix
bun run typecheck    # tsc --noEmit across all packages
```

### Tests

```sh
bun run test         # Storybook/Vitest interaction tests (real Chromium via Playwright)
```

45 story files, 159 tests. Stories with a `play` function run their interaction assertions in a real Chromium browser via `@storybook/addon-vitest`.

---

## Consumer setup

### Build requirements

This repo ships **TypeScript source** — no prebuilt bundles. Two build-time plugins are required in your app:

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

> **Note on `optimizeDeps`:** Uniwind excludes `react-native` from Vite's dep optimizer, which breaks `@react-native/normalize-colors`. The reference config force-includes `react-native-web` to work around this.

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

- **No barrels** — every component has its own subpath export. Consumers only bundle what they import.
- **`sideEffects: false`** on all packages — tree-shaking friendly.
- **`useReducedMotion`** consumed by every animated component; 43 component files carry accessibility props.
- **Strict TypeScript** across the workspace (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`).
- **Biome** for linting and formatting (184 files, lint-clean baseline).
- **Husky** pre-commit (lint + typecheck) and pre-push (test) hooks.

---

## License

[MIT](./packages/ui/LICENSE) © Ivan Stepanian
