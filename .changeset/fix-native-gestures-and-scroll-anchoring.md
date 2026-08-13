---
"rn-motion-ui": patch
---

**Gestures and FileSystem: native drags and scroll anchoring**

- **FileSystem entry animation** — rows animate entry off `isEntering` (a `useEffect`) instead of a first-layout callback, which on native could fire before Reanimated registered the starting height and land the row already-open.
- **FileSystem lazy list expand** — expanding a `hasChildren` folder in the list view now requests its children, so a lazy folder no longer expands over nothing.
- **FileSystem folder move** — moving a folder wholesale no longer leaves an empty husk at its old path: the index tells a moved folder apart from one merely emptied in place by comparing the previous child set.
- **WheelPicker native drag** — native drives the drum through an RNGH pan (web keeps the PanResponder), so a drag blocks an enclosing ScrollView on New Architecture instead of the scroll winning.
- **Draggable host** — the gesture detector wraps the native host directly and pins `collapsable={false}`, so a flattened view can't strand the gesture and let a ScrollView swallow it.
- **Drag ghost anchoring** — the host re-measures its window box at lift, so a scroll between the last layout and the grab no longer strands the ghost off the row.
