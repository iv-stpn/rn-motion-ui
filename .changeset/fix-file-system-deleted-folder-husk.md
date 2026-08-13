---
"rn-motion-ui": patch
---

**FileSystem: deleting an empty folder no longer leaves a husk**

The index rebuild preserved folders that lost all their children so an *inferred* folder — one implied only by its files — survives when its last child is dragged out. That same rule couldn't tell a folder the consumer explicitly deleted from one that was merely emptied in place, because an empty folder has no children to compare. A deleted empty folder (e.g. the playground's `untitled folder`) came back as an empty husk.

The rebuild now carries the set of folder paths the previous manifest declared with `{ kind: 'folder' }`. A declared folder that is absent from the new items was deleted, not emptied, so it is dropped instead of preserved.
