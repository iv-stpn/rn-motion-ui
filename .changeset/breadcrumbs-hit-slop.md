---
'rn-motion-ui': patch
---

Tighten `Breadcrumbs`' visual footprint without shrinking its touch target.

Segment padding (`px-1 py-0.5`) moved to a `hitSlop` of the same dimensions, so the label keeps a tight visual shape while the pressable area is unchanged. The content row's `px-3 py-1.5` padding is dropped too. The separator caret now has its own size (16 base / 14 small) instead of sharing the icon size, so a ChevronRight reads independently of the leading glyph.
