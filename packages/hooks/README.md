# @rn-motion-ui/hooks

Reusable React hooks shared across the `rn-motion-ui` monorepo.

## Install

```sh
npm install @rn-motion-ui/hooks
# or: bun add @rn-motion-ui/hooks
```

### Peer dependencies

```sh
npm install react react-native
```

> `react-native` is only required by the hooks that touch RN APIs
> (`use-in-view`, `use-page-visible`, `use-reduced-motion`,
> `use-shake-animation`). The pure hooks (`use-arm-on-view`,
> `use-hover-capable`, `use-interval`, `use-modal-render`, `use-mount-effect`,
> `use-scramble`) work with `react` alone.

## Subpath exports

| Import | Export |
| --- | --- |
| `@rn-motion-ui/hooks/use-arm-on-view` | `useArmOnView` — arms (returns `true`) once a View enters the viewport when `startOnView` is enabled; stays `true` permanently afterward. |
| `@rn-motion-ui/hooks/use-hover-capable` | `useHoverCapable` — whether the environment supports hover (always `false` on React Native / touch-first). |
| `@rn-motion-ui/hooks/use-in-view` | `useInView` — React Native equivalent of framer-motion's `useInView`; returns a ref + boolean for whether a `View` is in the viewport (IntersectionObserver on web, mounted-as-visible on native). |
| `@rn-motion-ui/hooks/use-interval` | `useInterval` — runs a callback on a fixed interval, cleaning up on unmount or when the delay changes; pass `null` to pause. |
| `@rn-motion-ui/hooks/use-modal-render` | `useModalRender` — keeps a modal's subtree mounted until its exit animation completes. |
| `@rn-motion-ui/hooks/use-mount-effect` | `useMountEffect` — runs a callback exactly once after the first render (strict-mode safe). |
| `@rn-motion-ui/hooks/use-page-visible` | `usePageVisible` — whether the app/page is currently in the foreground (AppState on native, visibility on web). |
| `@rn-motion-ui/hooks/use-reduced-motion` | `useReducedMotion` — React Native equivalent of framer-motion's `useReducedMotion`; `true` when the user has requested reduced motion. |
| `@rn-motion-ui/hooks/use-scramble` | `useScramble` — progressive character-scramble reveal that settles into the final text over time. |
| `@rn-motion-ui/hooks/use-shake-animation` | `useShakeAnimation` — runs an `Animated.sequence` horizontal shake on a `Animated.Value` whenever a trigger flips true. |

## License

[MIT](./LICENSE) © Ivan Stepanian
