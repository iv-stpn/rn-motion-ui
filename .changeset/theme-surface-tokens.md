---
'rn-motion-ui': minor
---

refactor(theme): consolidate the input fill/shadow tokens into `surface-contrast` and `floating`

- `--color-input-base` becomes `--color-input`, `--color-input-elevated` becomes
  the general `--color-surface-contrast`, and `--shadow-input-floating` becomes
  `--shadow-floating`. The tokens are no longer input-specific: IconButton,
  MorphingFAB, cards and other raised surfaces now share them.
- Raised `bg-muted` fills migrate to `bg-surface-contrast` (the dedicated
  contrast-surface token) across cards, tabs, sliders, skeletons, list rows and
  menus, so the muted text token is no longer overloaded as a fill.
- BREAKING (type-only): `ThemeToken` drops `input-base` / `input-elevated` in
  favour of `input` / `surface-contrast`.
