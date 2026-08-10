---
"rn-motion-ui": patch
---

**Fix exports validation: 4-segment component paths and pre-commit auto-fix**

- `check-exports.mjs` `deriveExportKey` now handles 4-segment component paths (`components/<category>/<Dir>/<file>`) in addition to 3-segment, so the primary entry-point file per component is correctly auto-detected and validated.
- The pre-commit hook now runs `check-exports.mjs` after lint+typecheck. On failure, it auto-fixes dangling paths with `--write` and stages the result. If `--write` cannot resolve everything, the commit is blocked with a clear error.
- Added missing export entries for `./hooks/use-controlled` and `./hooks/use-press-state`.
