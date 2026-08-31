---
'rn-motion-ui': patch
---

fix(HoldMenu): defer open-side commits and stop the Android render-tree overflow

Two related Android-native crash fixes for the hold-menu open path:

1. **`removeClippedSubviews` on the story's WhatsApp FlatList** — the actual
   stack overflow. RN 0.86 defaults `removeClippedSubviews` to TRUE on
   Android, and the list's rows are `collapsable={false}` Animated.View +
   GestureDetector subtrees (every `HoldItem`). Opening a menu re-renders
   every bubble; the RecyclerView then detaches/re-attaches a clipped cell
   whose subtree already has a parent, and HWUI's
   `RenderNode::prepareTreeImpl` recurses on the resulting cycle until the
   RenderThread stack overflows (SIGSEGV, 500+ identical frames). Every
   FileSystem list view in this package already sets
   `removeClippedSubviews={false}` for the same reason; the story's list now
   does too. The same recycle path also explains the storybook UI's details
   sheet crashing while the story is displayed (its present re-renders the
   story).

2. **One-frame deferral of the open-side commits** (`hold-item.tsx`
   `handleWillOpen`, `menu-list.tsx` `setter`): the panel rows and the
   portal twin's lifted copy mounted new native subtrees (with Reanimated
   enter animations) in the same tick as the LongPress gesture's `onStart`
   touch dispatch (via `runOnJS`) — a separate Fabric/RNGH commit-during-
   dispatch hazard. Both now land one frame later; the 150 ms fade-ins never
   notice the 16 ms delay.

Also un-blank the four story groups that had no `layout` parameter
(FileSystem, Table, ReorderableList, SortableList): a missing layout
resolves to an empty canvas container style on the native storybook —
identical to the `fullscreen` container that white-screened the menu
stories (4250db21) — and collapsed the BlurProvider → flex-1 → ScrollView
chain, rendering them as blank white canvases on the Android APK. They now
use `layout: 'centered'` like every other story group.
