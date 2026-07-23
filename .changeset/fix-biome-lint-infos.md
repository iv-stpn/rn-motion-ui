---
"rn-motion-ui": patch
---

Resolve the remaining Biome `info`-level diagnostics from `bun lint` (no runtime change).

- **`useSortedClasses` (36)** across the Table components: let Biome sort the NativeWind `className` tokens into canonical order. Each reorder was verified safe against this repo's `cn` resolver — no string contained two tokens in the same conflict group, so the surviving class set is identical before and after (last-wins resolution is unchanged).
- **`noAwaitInLoops` (2)** in `ActionFeedbackModal`'s `LoadingLoops` story `play`: suppressed with `biome-ignore` because both loops are intentionally sequential and time-dependent (polling for an animated dot to mount; sampling `translateY` 250 ms apart across theme re-renders). The rule's `Promise.all` suggestion would run the iterations concurrently and defeat the test's purpose.
