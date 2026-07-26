---
"rn-motion-ui": patch
---

Storybook: rebuild the component stories around a single interactive playground per component, and expand `play`-function coverage.

Each component now exposes one `Interactive` story that doubles as its catalogue — live controls on top, then rows of samples for the states a press can't reach — replacing the long tails of one-argument stories (`Loading`, `Disabled`, `Pill`, …) that used to sit beside each other in the sidebar. The shared chrome lives in `src/__stories__/story-harness.tsx` (`Playground`, `Controls`, `Toggle`, `Choice`, `Action`, `Section`, `Variants`, `Sample`, `Note`), with `story-trigger.tsx` supplying a swappable open-trigger for the overlay stories and `story-elevations.ts` the shared 1–8 elevation chip table.

The harness is deliberately built from bare `Pressable`/`View` rather than the library's own `Switch`/`Radio`, so a story for `Switch` never has the harness and the subject answer the same `findByRole('switch')` query; every control carries a `story-*` `testID` so `play` functions can drive it unambiguously.

`src/**/__stories__/**` is added to the package's `files` exclusions, so the harness ships no more than the stories it serves do.
