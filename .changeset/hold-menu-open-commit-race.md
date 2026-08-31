---
'rn-motion-ui': patch
---

fix(HoldMenu): defer open-side commits out of the gesture dispatch window

The panel rows and the portal twin's lifted copy mounted on the JS thread
synchronously with the LongPress gesture's `onStart` (via `runOnJS`), so a
new native subtree — with its Reanimated enter animations — committed while
RNGH was still processing the touch that activated the hold. On Android
Fabric that is a native-crash risk (the storybook APK died the instant a
hold menu opened). Both mounts now land one frame later, after the gesture's
touch dispatch has completed; the 150 ms panel/twin fade-ins never notice
the 16 ms delay.

Also un-blank the four story groups that had no `layout` parameter
(FileSystem, Table, ReorderableList, SortableList): a missing layout
resolves to an empty canvas container style on the native storybook —
identical to the `fullscreen` container that white-screened the menu
stories (4250db21) — and collapsed the BlurProvider → flex-1 → ScrollView
chain, rendering them as blank white canvases on the Android APK. They now
use `layout: 'centered'` like every other story group. The HoldMenu
Interactive story also drops its unused Reanimated `Animated.FlatList` in
favour of a plain `FlatList`.
