---
'rn-motion-ui': patch
---

chore: remove the orphaned root `tokens.css`

The repo-root `tokens.css` was a stale, unimported artifact of running the token
generator from the repo root. It shadowed the canonical
`packages/ui/src/theme/tokens.css` (shipped as `rn-motion-ui/tokens.css`) but had
drifted out of sync, still carrying the pre-refactor `--shadow-input*` tokens and
the pre-deepen `--color-info` value. No entry point imports it: the web and
native storybooks use the shipped sheet, and the demo uses its own
`storybook/demo/tokens.css`.
