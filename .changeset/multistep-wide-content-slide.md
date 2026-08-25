---
'rn-motion-ui': patch
---

fix(MultiStepMenu): roll content up on back-to-root and fade in the first layer

On the small screen the content below the title slid horizontally while the title
rolled up, so the two moved out of sync. Returning to the root now rolls the
content up a matching amount alongside the title (both the exiting deeper pane
and the entering root pane), and entering the first layer from the root fades it
in with opacity instead of sliding in from the side — there's no parent pane to
slide against. Deeper navigation keeps its horizontal slide, and a deeper menu's
content fades out almost instantly as it leaves, so its rows don't linger on
screen during the slide.

The below-the-header title animates its height and margin on enter/exit so the
header collapses smoothly instead of snapping, and the wide-screen content pane
(previously an instant swap) now slides horizontally with the sidebar selection.
