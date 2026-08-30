---
'rn-motion-ui': patch
---

fix(Checkbox): nudge the check and dash glyphs up-left to sit optically centred

The glyphs were nudged right of the viewBox centre, but the check's bottom vertex
and its long upper diagonal still pulled the optical centre down-right of the
stroke bbox, leaving both marks reading as slightly too low and too far right.
Both the check and indeterminate dash now sit one half-unit (half a pixel) up-left
so the marks look centred and stay aligned through the cross-fade.
