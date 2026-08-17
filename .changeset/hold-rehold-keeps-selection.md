---
'rn-motion-ui': patch
---

fix(FileSystem): re-holding a selected entry keeps it selected, so a hold-drag can carry the whole selection again

The long-press hold was an additive toggle: re-holding an already selected row
removed it from the selection, so the drag that followed lifted just that one
row instead of the group. The hold is now additive and add-only — it joins the
held entry to the selection and never removes one — matching the platform file
manager convention (hold = grab/add, tap or Ctrl/Cmd-click = toggle). A
selection therefore survives a re-hold and the same selected rows can be
dragged repeatedly.
