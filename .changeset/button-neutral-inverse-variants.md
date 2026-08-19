---
'rn-motion-ui': minor
---

feat(Button): rename `primary`/`secondary` to `neutral`/`inverse`; fix `inverse` fill

`Button`, `IconButton` and `StatefulButton` rename `primary` → `neutral` and
`secondary` → `inverse` (colours unchanged; the old `inverse` is removed).
`ElevatedButton` and `GlossyButton` `inverse` now render the
`primary`/`primary-foreground` pair swapped — the `neutral` of the opposite
theme — and `ThemedIcon` drops its `primary`/`secondary` keys to match.
