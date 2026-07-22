---
"rn-motion-ui": patch
---

Add `./package.json` to the exports map.

With a sealed `exports` map, tooling that resolves `rn-motion-ui/package.json` directly (Metro, Expo Doctor, some bundlers) would fail with a package-not-found error. The entry is a bare self-reference: `"./package.json": "./package.json"`.

`check-exports.mjs` is updated to skip this key in both validation passes so it never reports it as a dangling or missing entry.
