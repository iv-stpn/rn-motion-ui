---
'rn-motion-ui': major
---

feat: replace `Input`'s `variant` prop with the shared `floating` + `elevation` surface props

**Breaking change**

`Input` was the last surface spelling its own fill and float as a `variant` table (`'base' | 'elevated' | 'floating'`). It now takes the same two props every other surface does:

- `elevation` (`0–8`, default `0`) — the ladder rung, driving the field fill (`bg-surface-N`) and the `shadow-elevated-N` recipe. `0` is the flat resting surface (a `surface-3` fill, no shadow), matching the new flat default on the other surfaces.
- `floating` (`boolean`, default `false`) — swaps that rung's ladder shadow for the large, diffuse halo (`shadow-floating`) the old `variant="floating"` wore.

The state-tinted web border is drawn only at `elevation={0}`; at `1–8` the elevation shadow already carries the rim, so a border would double up.

| before | after | notes |
| --- | --- | --- |
| `variant="base"` (the default) | *(nothing — `elevation` already defaults to `0`)* | identical in light mode; in dark the fill moves from `--color-input` (`oklch(22%)`) to `surface-3` (`oklch(26.4%)`), so the field reads a touch lighter |
| `variant="elevated"` | `elevation={1}` | nearest rung: `bg-surface-1` replaces the `surface-contrast` fill, and the field picks up `shadow-elevated-1` |
| `variant="floating"` | `floating` | exact — at `elevation={0}` the fill is already `bg-surface-3`, so this resolves to the same `bg-surface-3 shadow-floating` |

Because `elevation` and `floating` are independent, combinations the variant table could not express — a raised field at `elevation={5}`, or the halo over any rung — are now reachable.

The `--color-input` token is still defined (and still readable via `useThemeColor('input')`) but nothing in the library consumes it any more; it is kept for app code that wants the old flat field colour.
