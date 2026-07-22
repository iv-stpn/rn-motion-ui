---
"rn-motion-ui": patch
---

Fix the `dots` loader freezing after one cycle in `ActionFeedbackModal` (and anywhere it re-renders mid-loading).

The dots bounce used moti's declarative `loop`, which rebuilds its `withRepeat(withTiming(target))` on every worklet re-run. The Dot re-renders whenever an ancestor `<AnimatePresence>` churns its presence context (a theme toggle, parent state change, etc.) — and `useContext` re-renders bypass `React.memo`. A rebuild that lands while the dot already sits at its `translateY` target leaves the repeat with zero forward distance, so the dot sticks at the top of the bounce permanently ("one cycle then stops"). Reproduced on both native and web.

`Dot` now drives the bounce with a raw Reanimated shared value whose `withRepeat` is created **once** in a `useEffect` (deps: `reduce`/`size`/`speed`/`index`). Re-renders never cancel or rebuild the animation — the stored animation runs indefinitely regardless of ancestor re-renders. The opacity fade-in is a one-shot `withTiming`; under reduced-motion the dot stays put and opacity gently pulses instead of bouncing.
