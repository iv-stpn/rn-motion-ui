---
'rn-motion-ui': patch
---

Settle the hairline border at 2px

The `hairline` @utility (and its `hairline-t`/`r`/`b`/`l` sides) drops from
2.5px to a clean 2px. A bare 1px `border` still washes out on high-density
screens, so `hairline` remains the single border weight in the library — it
just no longer lands on a fractional pixel.

`CheckboxCard` and `RadioCard` still step their checked/selected edge up to
3px, so the "hairline + 0.5px" half-pixel content shift these components
document is unchanged in spirit; only the resting weight it grows from moved.
