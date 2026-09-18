---
'rn-motion-ui': minor
---

Default the button family to the pill shape

`Button`, `ElevatedButton`, `ButtonSwap`, `IconButton` and `StatefulButton`
now default to the `pill` shape (fully-rounded) instead of the `rounded`
square. The `rounded` shape is unchanged and still available via
`shape="rounded"`; only the default has moved. `IconButton`'s square box
therefore renders as a circle by default.
