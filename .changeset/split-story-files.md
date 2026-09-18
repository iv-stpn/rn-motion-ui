---
'rn-motion-ui': patch
---

Split the oversized `file-system.stories.tsx` and `table.stories.tsx` into focused story files and shared helpers, and reintroduce a 600-line cap for `*.stories.tsx`.

No public API change: the existing interaction tests carry over unchanged.
