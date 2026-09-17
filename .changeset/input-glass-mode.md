---
'rn-motion-ui': patch
---

Add glass mode to Input

`Input` gains the same frosted-glass surface props `Card` and `Surface`
already expose — `blurRadius`, `opacity`, `rim`, `rimWidth`, `intensity` and
`inline`. A positive `blurRadius` renders the field through the shared
`Surface` primitive (a translucent `glass` tint over a backdrop blur, with
the specular edge light when `rim` is set) instead of the solid
`bg-surface-N` fill. The default `blurRadius: 0` is unchanged, so existing
fields render identically.
