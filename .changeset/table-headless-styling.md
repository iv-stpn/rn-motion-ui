---
"rn-motion-ui": minor
---

**Table: move border and background colours out of the component into configurable `className` props**

The Table component previously hardcoded `border-border border-b` on rows, headers, cards, and footer, as well as `bg-surface-selected` on the selected-row overlay, `bg-border` on skeleton pulses, and `bg-primary`/`bg-danger` on row insert/delete buttons. Those are now removed from the component internals and exposed as new `className` props:

- `selectedClassName` — classes merged onto the selected row/card background overlay
- `dropIndicatorClassName` — classes merged onto the column-reorder drop indicator
- `skeletonClassName` — classes merged onto the skeleton pulse bars during loading
- `emptyClassName` — classes merged onto the empty-state wrapper

Stories preserve the classic appearance via a `CLASSIC_TABLE` defaults object spread onto each `<Table>` instance. Remove or override individual entries to customise.
