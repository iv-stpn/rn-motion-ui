---
"rn-motion-ui": minor
---

Add an `npx rn-motion-ui-tokens` CLI that generates a retinted copy of `tokens.css` for consumers. The neutral ramp's shared tint can't be a `var()` — uniwind folds colours to hex at bundle time and `var()` inside `oklch()` never folds on native — so retinting is a codegen step. The script reads the shipped sheet, rewrites only the neutral-tinted `oklch()` literals to a given `--hue`/`--chroma` (scaling each token's chroma proportionally so partial tints stay partial), and passes comments, shadow recipes, status colours, and all three theme blocks through verbatim. Documented in the README's Theming section.
