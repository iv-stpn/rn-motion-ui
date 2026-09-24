---
'rn-motion-ui': patch
---

`FileSystem`'s hold-menu overlay (the blur/opacity scrim behind an entry or background context menu) now extends across the whole component — header, breadcrumbs, filters and footer included — instead of dimming only the file area. The drag scope still wraps just the body, so a drag ghost still can't float over the toolbar.
