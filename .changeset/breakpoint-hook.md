---
'rn-motion-ui': minor
---

feat: `useBreakpoint` — width breakpoints without resize re-renders

New `rn-motion-ui/hooks/use-breakpoint` exports `useBreakpoint()` and
`useBreakpointAtLeast(value)`. Both subscribe to `Dimensions` but store only the
resolved tier, so a component re-renders when the breakpoint flips rather than
on every resize frame the way `useWindowDimensions` does.

The scale (`base` / `sm` / `md` / `lg` / `xl` / `2xl`) mirrors Tailwind's default
`screens` and is the single source of truth for responsive decisions in the
package — the pure helpers live in `rn-motion-ui/breakpoints` for components that
measure their own container instead of the window.

Every component that previously hard-coded a cutoff now accepts an override:

- `AdaptiveModal`, `FullSheet` — `wideBreakpoint` (default `'sm'`, was a literal 640)
- `AdaptiveDropdown` — `wideBreakpoint` (default `'md'`, was a literal 768)
- `FileSystem` — `breakpoints={{ minimal, compact, tablet }}` for its
  container-measured header tiers (defaults 360 / 560 / 768), plus
  `contextMenuWideBreakpoint` (default `'md'`, was a literal 768) for the window
  width at which entry context menus open as a cursor-anchored panel rather than
  a bottom sheet

Each takes a breakpoint name or a raw pixel number. Defaults are unchanged, so
this is additive.
