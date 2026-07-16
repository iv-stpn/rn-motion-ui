# @rn-motion-ui/rn

Animated React Native + React Native Web UI components, styled with [Tailwind](https://tailwindcss.com/) via [uniwind](https://github.com/nativewind/uniwind) and powered by [Moti](https://moti.fyi/) / [Reanimated](https://docs.swmansion.com/react-native-reanimated/).

The components are written as React Native primitives, so they run on native (iOS/Android via Expo or bare RN) and on the web through `react-native-web`.

## Install

```sh
npm install @rn-motion-ui/rn
# or: bun add @rn-motion-ui/rn
```

### Peer dependencies

Install these in your app (they are not bundled):

```sh
npm install react react-native react-native-reanimated react-native-gesture-handler moti
```

| Peer | Supported range |
| --- | --- |
| `react` | `>=18.0.0` |
| `react-native` | `>=0.76.0` |
| `react-native-reanimated` | `>=3.16.0` (3.x and 4.x both work) |
| `react-native-gesture-handler` | `>=2.0.0` |
| `moti` | `>=0.29.0` |

## Consumer setup

This package **ships TypeScript source** (no prebuilt bundle). Your bundler already transpiles your own app code, so it will transpile these components the same way — but two build-time plugins are required for the components to work correctly:

1. **`react-native-reanimated/plugin`** (Babel) — transforms Reanimated worklets. Without it, easing/animation worklets throw at runtime.
2. **`uniwind`** — resolves the `className` props on RN components to styles at build time. Without it, `className` is ignored.

### Native (Expo / Metro)

`babel.config.js`:

```js
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'],
};
```

Set up `uniwind` per its docs (Metro transformer + a `global.css` Tailwind entry).

### Web (Vite / react-native-web)

Alias `react-native` → `react-native-web`, run the Reanimated Babel plugin through your React transform, and add the `uniwind` Vite plugin. See this repo's `storybook/web/.storybook/main.ts` for a working reference config.

## Usage

```tsx
import { Button, Switch, Tabs } from '@rn-motion-ui/rn';

export function Example() {
  return (
    <Button variant="primary" size="md" onPress={() => {}}>
      Press me
    </Button>
  );
}
```

## License

[MIT](./LICENSE) © Ivan Stepanian
