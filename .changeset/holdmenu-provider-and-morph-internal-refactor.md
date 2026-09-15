---
'rn-motion-ui': patch
---

Refactor `HoldMenuProvider`, `MorphingFAB` and `MorphingSwitcher` internals

Internal-only cleanup to satisfy the linter — no public API or behaviour
change:

- `HoldMenuProvider` hoists its `menuProps` default to a module constant,
  extracts the `onOpen`/`onClose` reaction into a `useMenuOpenClose` hook, and
  renders through a presentational `ProviderShell`.
- `MorphingFAB` and `MorphingSwitcher` replace their `++measureSeq.current`
  bump with an explicit `measureSeq.current += 1`.
