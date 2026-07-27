---
"rn-motion-ui": patch
---

`GlossyButton` labels now use the Button family's type ramp instead of their own. The ramp moves to `LABEL_TEXT_CLASS` in `button-scale.ts`, and both `Button`'s `label` cva and `GlossyButton` read it, so a glossy `md` renders the same text as a flat `md` — which is what `StatefulButton`'s `chip="glossy"` was already doing for its rolling label. Visible change: glossy labels go `font-medium` on the `text-xs`/`text-sm`/`text-base` ramp rather than `font-normal` at a fixed 17px (14px at `sm`). `ElevatedButton` is unchanged — AlignUI pins its chips to 14px at every size.
