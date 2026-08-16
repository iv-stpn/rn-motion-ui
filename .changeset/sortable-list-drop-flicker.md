---
'rn-motion-ui': patch
---

fix(ui): SortableList — snap the transform in the same frame as the drop reorder

- **Drop flicker fixed.** On a committed reorder the moved items' DOM nodes are
  re-inserted at their new slots in the React render, but their `translateY`
  reset to `0` was driven by the item's `useAnimatedReaction`, a `useEffect`-based
  hook whose effect runs *after* paint. That left a one-frame window where a
  re-inserted node still carried its drag-time offset, so it flashed at the wrong
  slot before settling — the flicker on drop (web and native). Each item now
  resets its `translateY` (and syncs its drop-version bookmark) in a
  `useLayoutEffect` keyed on its canonical `index`, which runs synchronously with
  the DOM reorder before paint, so the snap and the reorder land in the same
  frame. The reaction is unchanged and still drives the in-flight drag animation
  and the smooth cancel/self-drop revert.
