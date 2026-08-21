---
'rn-motion-ui': patch
---

fix(ToggleGroup): stop the segmented control stretching to its parent's width

The shell now carries `self-start max-w-full` — it hugs its items (like
ChoiceGroup and Tabs) instead of stretching to a column parent's cross size,
while an overflowing row still caps at the parent width and scrolls.

fix(MultiStepMenu): roll the small-screen title down instead of pushing it right

The back button is now absolutely positioned inside the header slot, so when it
appears the title rolls straight down (a y translation) into the
below-the-header slot instead of being pushed horizontally by the button taking
layout space in the title's row.
