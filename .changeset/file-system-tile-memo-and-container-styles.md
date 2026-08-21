---
'rn-motion-ui': patch
---

perf(FileSystem): memoize the icon and gallery tiles and stabilize their container styles

`IconTile` and the gallery `StripTile` are now wrapped in `memo`, and the
`containerStyles` objects handed to `HoldItem` are hoisted to a module constant
or memoized instead of recreated on every render. A fresh object literal was
defeating `HoldItem`'s own memo and re-running its hold/gesture/drag stack for
every tile on every re-render.
