---
'rn-motion-ui': minor
---

feat(Button): `primary` variant and fill-aware elevation shadows

`Button` and `ElevatedButton` gain a `primary` variant — the filled monochrome
plate (the `primary`/`primary-foreground` pair), replacing the old `inverse`
variant. `neutral` is now the neutral scheme (`foreground` fill, `background`
label) instead of aliasing the monochrome plate. `ThemedIcon` and
`StatefulButton` follow the same rename, and every `inverse` usage across the
components is migrated to `primary` or `neutral`.

Filled variants (`primary` and the status fills `danger`/`success`/`warning`/
`info`) now cast a fill-aware elevation shadow when raised: a crisp 1px
fill-coloured ring plus a graduated dark-neutral drop, instead of the surface
ladder's subtle shadow that read as "flat" against an opaque fill. Transparent
variants and `neutral` keep the surface ladder.
