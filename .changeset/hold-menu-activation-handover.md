---
'rn-motion-ui': patch
---

fix(HoldMenu): no lingering copy when the twin travels, and inert holds release to full size

When the menu overflows and lifts the pair, the travelling twin is drawn fully
opaque from its first frame, so the in-place item now drops out on that same
frame (duration 0) instead of holding its full opacity underneath — previously a
copy was left behind at the item's old spot. The cross-fade is now reserved for
the one case where the twin stays put and overlaps the original, keeping the
pair from dimming.

An inert hold — empty items, i.e. the mobile views' multi-select join — now
scales back to full size on completion, so the press pulse returns to rest
instead of staying stuck at the squeezed size.
