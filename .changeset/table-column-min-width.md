---
'rn-motion-ui': patch
---

feat(Table): `minWidth` column floor forces horizontal scroll instead of squeezing

A column whose `width` would resolve narrower than its `minWidth` — an `fr`
column squeezed by a narrow container, or a fixed `width` smaller than the
floor — now clamps up to `minWidth` in `computeColumnWidths`, pushing the
total past the container width and turning on horizontal scroll rather than
rendering the column unreadably narrow. `minWidth` is a floor, not a share:
fr columns still divide the remaining space, but each is then raised to its
own floor. The pre-layout render (before `onLayout` reports a width) honors
the same floor via `columnLayoutStyle` / `columnLayoutClass`.

Regression coverage: `computeColumnWidths` unit tests for the fr and px
floors, plus a `MinWidth` story that asserts the email column keeps its
240px floor inside a 320px container and that the horizontal-scroll wrapper
mounts.
