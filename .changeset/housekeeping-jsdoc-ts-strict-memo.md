---
"rn-motion-ui": patch
---

**Housekeeping: JSDoc, TypeScript strictness, React.memo, and error hardening**

- **Moti animation engine** — Added comprehensive JSDoc to all 20+ public APIs in the `moti/` module (`motify`, `useMotify`, `useAnimationState`, `useDynamicAnimation`, `AnimatePresence`, `MotiPressable`, `useMotiPressable`, `useMotiPressables`, `useMotiPressableAnimatedProps`, `useMotiPressableInterpolate`, `useMotiPressableTransition`, `MotiView`, `MotiText`, `MotiImage`, `MotiScrollView`, `MotiSafeAreaView`, `Hoverable`/`MotiHover`, `useMotiHover`, plus the `MotiProps`, `MotiTransition`, and `MotiTransitionProp` types). Each entry includes param/return docs and a usage example where appropriate.
- **TypeScript** — Enabled `noUnusedLocals` and `noUnusedParameters` in `tsconfig.base.json`. Removed dead imports, constants, and functions across 5 story/test files.
- **React.memo** — Memoized the four heaviest leaf components: `GlossyButton`, `WheelPicker`, `SwipeableList`, and `Table<T>`.
- **Context guards** — `RadioCardItem`, `CheckboxCardItem`, and `DockItem` now throw a descriptive error when used outside their required parent component, instead of failing silently.
- **Unhandled rejections** — Added `.catch()` guards to `measure()` calls in `ReorderableItem` and a `try`/`catch` around the `measureZones` `Promise.all` in the drag store.
