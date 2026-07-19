# @rn-motion-ui/moti

A reimplementation of [Moti](https://moti.fyi/) (originally by [Fernando Rojo](https://github.com/nandorojo)) targeting **react-native-reanimated 4** and **react-native 0.86+**.

Moti's original API introduced breaking changes incompatible with Reanimated 4 at the time of writing. This package preserves the same ergonomics (`MotiView`, `AnimatePresence`, `useMotiPressable`, …) while running on the new Reanimated 4 worklet runtime.

> **Attribution** — This package derives its API design and worklet logic from Moti (MIT). See [LICENSE](./LICENSE) for the full NOTICE.

## Install

This package is a regular dependency of `@rn-motion-ui/rn`. You only need to install it directly if you use the Moti primitives without the UI layer:

```sh
npm install @rn-motion-ui/moti
# or: bun add @rn-motion-ui/moti
```

### Peer dependencies

```sh
npm install react react-native react-native-reanimated
```

| Peer | Supported range |
| --- | --- |
| `react` | `>=18.0.0` |
| `react-native` | `>=0.76.0` |
| `react-native-reanimated` | `>=4.0.0` |

## Usage

```tsx
import { MotiView } from '@rn-motion-ui/moti/view';
import { AnimatePresence } from '@rn-motion-ui/moti/presence';

export function FadeIn() {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0 }}
    >
      {/* content */}
    </MotiView>
  );
}
```

## Subpath exports

| Import | Source |
| --- | --- |
| `@rn-motion-ui/moti/view` | `MotiView` |
| `@rn-motion-ui/moti/text` | `MotiText` |
| `@rn-motion-ui/moti/image` | `MotiImage` |
| `@rn-motion-ui/moti/scroll-view` | `MotiScrollView` |
| `@rn-motion-ui/moti/presence` | `AnimatePresence` |
| `@rn-motion-ui/moti/pressable` | `MotiPressable` |
| `@rn-motion-ui/moti/hover` | `MotiHoverable` |
| `@rn-motion-ui/moti/motify` | `motify` (HOC) |
| `@rn-motion-ui/moti/use-motify` | `useMotify` |
| `@rn-motion-ui/moti/use-animation-state` | `useAnimationState` |
| `@rn-motion-ui/moti/use-dynamic-animation` | `useDynamicAnimation` |
| `@rn-motion-ui/moti/types` | shared TypeScript types |

## License

[MIT](./LICENSE) © Ivan Stepanian — includes NOTICE crediting Moti / Fernando Rojo.
