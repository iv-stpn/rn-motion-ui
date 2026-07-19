# rn-motion-ui

A monorepo of animated React Native + React Native Web UI components, styled with Tailwind via [uniwind](https://github.com/nativewind/uniwind) and powered by a custom Moti/Reanimated 4 layer.

Components are written as React Native primitives — they run on native (iOS/Android via Expo or bare RN) **and** on the web via `react-native-web`, with a single shared codebase.

---

## Packages

| Package | Description |
| --- | --- |
| [`@rn-motion-ui/rn`](./packages/ui/) | 40+ animated UI components (Button, Tabs, BottomSheet, ScrollReveal, …) |
| [`@rn-motion-ui/moti`](./packages/moti/) | Moti reimplementation for Reanimated 4 (`MotiView`, `AnimatePresence`, `MotiPressable`, …) |
| [`@rn-motion-ui/hooks`](./packages/hooks/) | Shared React hooks (`useMountEffect`) |
| [`@rn-motion-ui/utils`](./packages/utils/) | Shared TypeScript utilities (type guards) |

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
bun run lint         # Biome — all 6 workspaces
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
- **Strict TypeScript** across all 6 workspaces (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`).
- **Biome** for linting and formatting (184 files, lint-clean baseline).
- **Husky** pre-commit (lint + typecheck) and pre-push (test) hooks.

---

## License

[MIT](./packages/ui/LICENSE) © Ivan Stepanian
