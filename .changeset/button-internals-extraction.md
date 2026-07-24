---
"rn-motion-ui": patch
---

Extract shared Button family machinery (`usePressRipples`, `buildButtonContent`, `ButtonRipples`, `BaseButtonProps`) into `button-internals.tsx`. `Button` now delegates to those helpers, removing ~120 lines of duplication. `StatefulButton` cascade animation simplified to a whole-label roll (per-character stagger removed).
