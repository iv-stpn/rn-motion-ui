---
'rn-motion-ui': patch
---

Restore the `react-native` export condition on `./toaster`, so native builds get the Reanimated toast rather than the Sonner web adapter.

`./toaster` is a platform twin — `toaster.native.tsx` (Reanimated) on native, `toaster.tsx` (a Sonner adapter) on web — and Metro does not apply `.native` platform-extension substitution to a path the exports map has already resolved to an explicit filename, so the `react-native` condition on the entry is the only thing routing between them. It was dropped in 7.10.1 and has been missing since.

Nothing failed at build time, because `toaster.native.tsx` still shipped: it was present on disk and simply unreachable. Native consumers on 7.10.1–7.11.1 got the web twin, whose render opens with a bare `<style>` element. That is harmless in a browser, but on native it is an unregistered host component, so mounting `<Toaster>` threw `Invariant Violation: View config getter callback for component 'style' must be a function` before the root view was committed — and with `<Toaster>` mounted at the app root above no error boundary, a toast-library fault took the whole app down instead of one surface.

`scripts/check-exports.mjs` is both the validator and the `--write` regenerator, and its `buildEntry()` knew exactly two twins, listed by hand (`./moti/hover` and `./surface`). `./toaster` is a derived key, so a `--write` run rewrote it from `buildEntry()` and silently stripped the condition the list did not name. The twin is now derived from disk rather than listed — no maintenance as twins are added — and two checks close the gap that let this ship:

- a declared entry must now match the one generated from disk, instead of merely existing (the old check compared keys, so a field stripped from a present entry passed it);
- any declared entry whose file has a `.native` sibling must carry a `react-native` condition pointing at it, which also guards the hand-curated twins (`./moti/hover`, `./overlay/blur-provider`) that `--write` never rewrites and that nothing had ever validated.
