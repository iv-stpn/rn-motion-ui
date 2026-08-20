---
'rn-motion-ui': patch
---

fix(Tabs): match the segment inset to pill mode

Segment mode used a 2px inset (`p-0.5`) while pill mode used 4px (`p-1`), so
the active segment indicator hugged the outer edge tighter than the pill's
thumb. Segment mode now uses the same 4px inset, so the two shapes share one
gutter.
