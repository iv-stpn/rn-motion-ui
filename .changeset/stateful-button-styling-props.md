---
'rn-motion-ui': minor
---

feat(StatefulButton): expose the Button styling surface and fix the label weight

`StatefulButton` now accepts the full `Button` styling surface: `className` (outer wrapper), `contentClassName` (pressable plate, merged after the success/error squeeze), `labelClassName` (rolling label, on top of the variant/size ramp), and `style`. `labelClassName` was previously accepted but silently dropped — the content row bypasses the shared label builder — so it is now routed to both copies of the roll-slot label, keeping the invisible sizer measuring the same box the visible label paints in.

`floating` and `elevation` pass through to the flat button and are ignored by the elevated `chip`, which casts its own drop-shadow ring.

The label now renders at `weight="medium"`, matching `Button` (it previously fell back to regular).

The `Interactive` story gains `Styled`/`Floating`/`Elevation` controls, a styling showcase, a shadow ladder, and a test pinning that `labelClassName` styles every state.
