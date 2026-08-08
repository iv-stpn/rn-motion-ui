---
'rn-motion-ui': patch
---

- **check-readme script**: `--fix` now auto-inserts missing component rows into
  `packages/ui/README.md` by extracting PascalCase exports from each component's
  source, so the UI components table stays in sync without manual edits
- **Husky pre-push hook**: runs `check-readme.mjs --fix` automatically,
  regenerating stale README blocks and inserting unpublished component rows
  before every push
