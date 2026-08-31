---
'rn-motion-ui': patch
---

fix(HoldMenu): inline Android backdrop blur caused the render-thread crash

**Root cause (device tombstone):** opening a HoldMenu on the Android
storybook APK SIGSEGV'd with 500+ frames of `RenderNode::prepareTreeImpl →
prepareListAndChildren` — a native stack overflow on the RenderThread. The
HoldMenu backdrop's `OverlayBlur` renders `@danielsaraldi/react-native-blur-view`'s
`BlurView` INLINE inside the very `BlurTarget` it is pointed at (the
`BlurProvider` wraps the whole story, including the portal host the backdrop
lives in). When the scrim draws (backdrop opacity → 1 at open), the peer's
`RenderNodeBlurController.drawSnapshot` records the target's `RenderNode`
into its own blur node (`canvas.drawRenderNode(BlurTarget.renderNode)`); the
target's display list contains the blur view, so the RenderNode graph cycles
and HWUI's tree preparation recurses until the ~8 MB RenderThread stack runs
out. Before the blur-peer consolidation (17fe2a4f) the native `OverlayBlur`
resolved to null on Android and the backdrop was a plain dim — HoldMenu
worked. The modal menus' blur views are unaffected: they render inside RN
Modals (a separate window), outside the BlurTarget.

**Fix:** `OverlayBlur` gains an `inline` prop; on Android an inline scrim
skips the `BlurView` and degrades to the plain translucent dim (iOS
`UIVisualEffectView` and web CSS `backdrop-filter` blur behind themselves and
keep the frost). Applied to the two inline scrims: the HoldMenu backdrop and
FileSystem's background menu (same latent crash).

Also keeps the two hardening changes from the first round: the story's
WhatsApp FlatList now sets `removeClippedSubviews={false}` (RN 0.86 defaults
it to true on Android; the FileSystem lists already carry it), and the
open-side commits (panel rows + twin children) are deferred one frame out of
the gesture's touch dispatch window. Plus `layout: 'centered'` on the four
story groups that had no layout parameter (FileSystem, Table,
ReorderableList, SortableList), which un-blanks them on the native storybook
(a missing layout resolves to the same empty canvas container that
white-screened the fullscreen menu stories, 4250db21).
