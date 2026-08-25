---
'rn-motion-ui': patch
---

fix(MorphingSwitcher): size the stacked carets to sit flush without a negative margin

The `switcher` trigger's stacked caret pair was pulled together with a per-size
`marginTop` of −5 to −7, chosen to close the gap the chevron glyph's padding
leaves inside its 24-unit box. Overlapping the boxes that hard made the pair
sensitive to the glyph's exact metrics, and it read as one squashed mark rather
than two carets.

The pair is now sized instead of shifted: `stackedCaretSize` rises to within a
unit of `caretSize` at every size (sm 9→11, md 10→13, lg 12→15) and both carets
render with no style override, so the boxes sit flush and the strokes land the
same ~2px apart the margin was aiming for. `caretSize` moves up in step (sm
11→12, md 12→14, lg 14→16) to keep the single caret matched to the stacked pair.
`SwitcherScale.stackedCaretStyle` is gone, since nothing overrides the glyph
position any more.
