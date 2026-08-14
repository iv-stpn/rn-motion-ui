---
"rn-motion-ui": patch
---

**HoldContextMenu: draggable works on Android**

- The `<HoldDraggable>` host now pins `collapsable={false}`, matching `<Draggable>`. On Android the renderer flattens collapsable views out of the native hierarchy, stranding the pan gesture on a view that no longer exists and letting the enclosing ScrollView swallow the drag — which is why the hold-menu drag worked on web and iOS but not Android.
