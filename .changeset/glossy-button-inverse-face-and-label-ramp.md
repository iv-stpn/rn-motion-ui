---
'rn-motion-ui': patch
---

fix(Button): render the GlossyButton `inverse` face as the opposite theme's neutral, and retune the label size ramp

- GlossyButton `inverse` now paints the `primary` fill (the opaque twin of the
  other theme's glass face) with `primary-foreground` as its label, lit by the
  hand-authored neutral pair flipped to the opposite page — instead of a
  derived recipe off `primary-foreground`. The key reads exactly as `neutral`
  does across a page swap, with no per-hue table to extend.
- The label size ramp (`LABEL_TEXT_CLASS`) is spelled out as static literals
  instead of taking them from `TEXT_INTERACTIVE`: `sm` stays `text-xs`, and
  `md`, `lg`, and `icon` now share `text-sm` rather than stepping `lg` up. Past
  the `md` box the extra height and padding already carry the size difference,
  and a 16px label reads oversized inside a button.
