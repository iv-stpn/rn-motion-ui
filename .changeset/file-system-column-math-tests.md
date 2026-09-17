---
'rn-motion-ui': patch
---

Extract FileSystem column hit-test math into a testable module

The columns view's pane geometry and row-mapping arithmetic move into a
pure `logic/file-system-column` module, so the drag hit-test and marquee
row-mapping are covered by unit tests rather than only the story play.
