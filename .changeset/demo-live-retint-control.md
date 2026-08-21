---
'rn-motion-ui': patch
---

feat(demo): add a live retint-on-save tint control

The demo's neutral-axis tint now comes from a `tokens.config.json` (`hue` +
`chroma`) instead of a hand-tuned `tokens.css`. `metro.config.js` runs the
`rn-motion-ui-tokens` generator on boot and on every config change, writing a
gitignored `tokens.css`; a `/__tint` dev endpoint plus an in-app `TintControl`
close the loop from the UI. Applying a tint reloads the page — uniwind bakes
resolved colours into inline styles on web, so a CSS-only regeneration can't
recolor already-mounted components. The demo is also wrapped in
`SafeAreaProvider` so `FileSystemBackgroundMenu`'s safe-area read no longer
crashes.
