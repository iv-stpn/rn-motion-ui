---
'rn-motion-ui': patch
---

fix(ToggleGroup): hug height in horizontal mode and unclip vertical labels

Horizontal groups no longer stretch vertically on native: the inner horizontal
`ScrollView` carries `grow-0`, neutralising its default `flexGrow: 1` so the
strip sizes to its items instead of filling the shell's column main axis (width
still comes from the shell's cross-axis stretch, so overflowing rows keep
scrolling).

Vertical groups no longer clip their labels: items drop the fixed
`h-interactive-*` height and grow from `py-3` instead, so each label keeps its
full line box rather than being squeezed into the fixed height minus the
padding.
