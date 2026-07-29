---
"rn-motion-ui": minor
---

`FileSystem`: the background context menu now opens over the empty area

`getBackgroundContextMenuActions` used to need a view to right-click. The placeholder that stands in for the file area — an empty folder, a search with no hits, filters that match nothing, a folder still loading — is now mounted in the same background surface the list and icons views use, so a right-click (web) or long-press (native) anywhere in it opens the background menu. An empty folder is exactly where a "New folder" action matters most.

It uses the same single-open coordination as the views, so opening it closes any other file-system menu.

**Also:** the background menu's title at the root now comes from the `title` prop instead of a hardcoded `'Files'`. Inside a folder it is the folder name, as before.
