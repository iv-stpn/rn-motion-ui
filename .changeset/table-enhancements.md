---
"rn-motion-ui": minor
---

Add `sortIcon` prop and theme color support to `Table`.

- New `sortIcon` prop on `HeaderCell` — replaces the default `ChevronUp` sort indicator with a custom node
- New `table-theme.ts` — `useTableColors` hook exposing all table-specific color tokens; table internals now read colors from the theme instead of hardcoded values
- Added Storybook stories (`table.stories.tsx`)
