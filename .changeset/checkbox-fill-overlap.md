---
'rn-motion-ui': patch
---

fix(Checkbox): draw the checked fill over the border via an explicit -0.5px inset

The fill on Checkbox and CheckboxCard sat at the border's inner edge, leaving
the border's antialiased inner edge visible as a hairline seam between the
border and the selected background. The previous class-based `-inset-0.5`
overlap could be dropped by the class resolver on some platforms; the overlap
is now an explicit inline style (`position: absolute` + `top/right/bottom/left:
-0.5`) so it provably draws over the border everywhere. The parent's
`overflow-hidden rounded-md` still clips it to the exact box shape.
