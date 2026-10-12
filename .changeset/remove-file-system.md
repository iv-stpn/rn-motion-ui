---
"rn-motion-ui": major
---

Remove the FileSystem component, explorer hooks/types, custom-view and render-slot API, and file-browser stories/demos. File browsing moves into Offkeep, where layouts and state can integrate directly with the application.

Keep standalone file icons, menus and drag primitives. Expose the existing drag scope/geometry/transfer, file icon rendering, menu placement, overlay blur and haptic helpers for applications composing their own screens. Consumers importing `rn-motion-ui/file-system` must migrate before upgrading to version 8.
