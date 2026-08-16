---
'rn-motion-ui': minor
---

feat(ui): add `Portal` — replace `@gorhom/portal` with an internal portal primitive

New `./portal` entry exporting `Portal`, `PortalHost` and `PortalProvider`, a
faithful, dependency-free reimplementation of
[@gorhom/portal](https://github.com/gorhom/react-native-portal) (same
provider/context/reducer around named host slots). `HoldMenu` now uses it for
its lifted twin, and `@gorhom/portal` is removed from the dependencies.

- **No remount** — a `Portal` with a stable `name` keeps its host slot, and
  children updates replace the slot's node in place, so a teleported subtree
  never remounts.
- **Paint above overlays** — `PortalProvider` renders its root host after its
  children, so teleported content stacks on top of whatever it wraps.
- **Minimal surface** — the `handleOnMount`/`handleOnUnmount`/`handleOnUpdate`
  override callbacks and the public `usePortal` from gorhom are dropped; add
  them back if a consumer needs imperative control.
