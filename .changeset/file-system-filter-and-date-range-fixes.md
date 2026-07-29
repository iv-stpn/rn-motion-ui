---
"rn-motion-ui": patch
---

`FileSystem`: fix filter-pill preset no-op and date-range modal stale draft

**Filter-pill date preset** — picking a new date preset on an existing filter pill (e.g. changing "1 month ago" to "3 days ago" via the value chip) was a silent no-op. `setFilterDatePreset` matches on `filter.id`; the pill was passing the filter's facet type instead, so nothing ever matched.

**Date-range modal draft** — closing and reopening the custom date range modal for the same facet showed the previous visit's draft instead of reseeding from the filter's stored bounds. The draft state is now scoped inside `AdaptiveModal`, which unmounts its children on close (wide path via `AnimatePresence` + `useModalRender`; narrow path via `BottomSheet`'s `isMounted` guard). The `DateRangeRequest` carries an `id` counter so reopening the same facet gets a `key` change and re-runs the lazy initialisers from the updated `initialRange`.

Two regression stories cover both fixes: `Demo: Re-value a filter pill` and `Demo: Custom range starts fresh each visit`.
