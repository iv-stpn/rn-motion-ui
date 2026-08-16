---
'rn-motion-ui': patch
---

fix(ui): FileSystem mobile gestures — drag-store zone isolation, Android nested scroll, stale-pan recovery, selection persistence, tap-to-open, kebab select-on-open

- **Dragzone**: each zone now subscribes to its own cached standing (`{drag,
  isEligible, isOver}`) instead of the whole drag snapshot, so a crossing
  re-renders only the zone entered and the zone left. Every mobile folder row is
  a dropzone, so this removes the drag lag when the pointer crosses folder
  boundaries. Whole-snapshot consumers (drop hint, drag manager overlay) are
  unchanged.
- **Mobile list / grid scrollables**: `nestedScrollEnabled` is set on both, and
  the list's `FlatList` sets `removeClippedSubviews={false}` — Android only
  scrolls a scrollable nested inside a consumer `ScrollView` when it opts into
  nested scrolling, and the clipping default is the same failure mode the Table
  fix (348ad09c) addressed.
- **Native drag pan**: the arm now counts the touches behind it, so a touch-down
  on a stale arm — one whose stream an Android `Modal` took away without an
  up/cancel/finalize, which previously left the row undraggable until remount —
  re-arms instead of counting itself as a second finger.
- **Selection persistence**: navigation (and the lazy children-load drain that
  follows it) no longer prunes the selection, so the mobile checkbox mode
  survives a folder change; switching views now recomputes with pruning, so a
  selection that is not visible in the current view is dropped and the mode
  turns off.
- **Mobile tap contract**: a single tap opens the entry; only a hold enters
  selection mode. Once anything is selected, a tap toggles that entry's
  selection. Desktop views keep click-select / double-click-open.
- **Mobile kebab**: tapping the three-dot menu now also selects the entry (row
  highlighted, mode on) in the same gesture that opens the menu. The slot keeps
  the kebab mounted while its own menu is open, so the selection the tap just
  produced cannot unmount the menu underneath it — the kebab gives way to the
  checkbox once the menu closes.
