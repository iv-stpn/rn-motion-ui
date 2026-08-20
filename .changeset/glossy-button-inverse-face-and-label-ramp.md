---
'rn-motion-ui': patch
---

fix(Button): retune the label size ramp so the larger sizes share `text-sm`

- The label size ramp (`LABEL_TEXT_CLASS`) is spelled out as static literals
  instead of taking them from `TEXT_INTERACTIVE`: `sm` stays `text-xs`, and
  `md`, `lg`, and `icon` now share `text-sm` rather than stepping `lg` up. Past
  the `md` box the extra height and padding already carry the size difference,
  and a 16px label reads oversized inside a button.
