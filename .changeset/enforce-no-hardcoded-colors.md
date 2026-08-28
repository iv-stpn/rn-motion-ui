---
'rn-motion-ui': patch
---

chore: block hardcoded colours on push

A `pre-push` guard now runs `check-no-hardcoded-colors.mjs` before tests, so a
raw hex/rgba literal in `src/components` fails the push instead of slipping into
the package. Also rewrote a prose line in `RadioCard` that quoted
`rgba(0,0,0,0)` (the reason `tintAt` exists), so the guard no longer flags its
own explanatory comment as a hardcoded colour.
