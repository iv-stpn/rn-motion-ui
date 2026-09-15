---
'rn-motion-ui': patch
---

Add `secondary` and `accent` variants across buttons, switch and icons

The two monochrome brand fills join the existing `primary`/`neutral`/status set
as first-class variants, so they can be selected without hand-rolled styling.

**`Button`** — `ButtonVariant` grows `secondary` (`bg-secondary`) and `accent`
(`bg-accent`), each pairing with its own `*-foreground` label and leading-icon
colour. Both are light fills, so they take the dark ripple rather than the white
shimmer reserved for the opaque dark/vivid fills (`FILLED_RIPPLE_VARIANTS`), and
they're absent from `FILLED_FILL_TOKEN` — their light fills read the dark ladder
drop fine, so a raised button keeps `shadow-elevated-N` instead of the
fill-aware ring.

**`ElevatedButton`** — `ElevatedVariant` grows `secondary` and `accent` with the
same bg/label/foreground-token tables. They join the monochrome set
(`MONOCHROME_FILL_VARIANTS`) so they cast the fixed dark-neutral drop, and the
light-ripple set (`LIGHT_RIPPLE_VARIANTS`) so the ripple shimmers dark on them.

**`Switch`** — `SwitchThemeName` grows `secondary` and `accent`, each resolving
to its own `*-foreground` thumb (both fills are near-white in one scheme, so a
white thumb would vanish).

**`ThemedIcon`** — `IconVariant` maps `secondary` → `secondary-foreground` and
`accent` → `accent-foreground`.

The storybook playgrounds for `Button`, `ButtonSwap`, `ElevatedButton`, `Switch`
and `Checkbox` expose the new variants in their pickers and gallery rows
(`__stories__/**` is excluded from the published package).
