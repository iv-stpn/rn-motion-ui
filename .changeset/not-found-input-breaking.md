---
"rn-motion-ui": major
---

**Breaking**: remove `NotFoundStacked` and `NotFoundTerminal`; unexport `InputType`.

- `NotFoundStacked` and `NotFoundTerminal` are removed from the `not-found` export — use `NotFoundGlitch` instead.
- `InputType` is no longer re-exported from `input`; it is an internal type.
