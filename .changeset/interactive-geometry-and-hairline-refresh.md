---
'rn-motion-ui': minor
---

Redesign the interactive geometry and border system

A library-wide refresh of the shared interactive tokens and the borders drawn
from them. This is a breaking change: sizes, label scale, corner radius, default
shapes and border weights all move at once.

**New `hairline` border (2.5px)** — the single border weight in the library.
Every `border-[1.5px]` and one-sided `border-t/r/b/l-[1.5px]` is now spelled
`hairline` / `hairline-t|r|b|l` (a custom utility, not an arbitrary value), so
borders read at full strength on high-density screens. Card/check states that
"step up" when selected now use `border-[3px]`. The border maths that HoldMenu's
height calculation depends on (segmented seam, panel border) was re-derived for
the new weight.

**Expanded size ramp** — a new `xs` size joins the ramp, and every height steps
up: `xs` 24 / `sm` 36 / `md` 48 / `lg` 64 px (previously 24 / 32 / 40), with
retuned horizontal padding. `Input`, `Button`, `ChoiceGroup`, `ToggleGroup` and
`Tabs` all accept `xs`.

**New shapes** — `square` and `circle` join `rounded` / `pill` on `Button`,
`IconButton`, `Input`, `ChoiceGroup` and `ToggleGroup`. Squares render sharp
(`rounded-none`), circles fully round (`rounded-full`).

**Bigger interactive radius** — `--radius-interactive` moves 6 → 8 px.

**Retuned label scale** — interactive text tracks `12 / 14 / 16 / 18 px`
(`text-xs` → `text-lg`) for `xs` → `lg`, so a button and a neighbouring
input/tab/chip at the same size read the same label.

**Input default shape** — `Input` now defaults to `rounded` instead of `pill`.
