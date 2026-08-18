---
'rn-motion-ui': patch
---

feat(Checkbox): shared animated box with a `tone` prop, reused by CheckboxCard

The animated box + check/dash mark that `Checkbox` and `CheckboxCard` each
carried a private copy of is now one exported `CheckboxBox`, so the two
controls stay visually in lockstep. `Checkbox` gains a `tone` prop (the
accent for the fill, border and mark, defaulting to `primary`);
`CheckboxCard` renders the shared box with `tone="info"` instead of its
hand-rolled info fill. The box now animates its own background between the
surface and accent fills instead of cross-fading an overlapping -0.5px
overlay, and the check/dash glyphs are re-centered on the stroke.
