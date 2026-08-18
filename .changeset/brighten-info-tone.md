---
'rn-motion-ui': patch
---

feat(tokens): brighten the info tone

`info` was a deep indigo (`oklch(50% 0.2 260)`) that read muddy in light
themes and nearly merged with `primary` in dark ones. It now lightens to
`oklch(65% 0.17 247)` — a clearer blue — so info-toned surfaces (the
CheckboxCard box, the FileSystem drop hint) read as their own accent rather
than a second primary.
