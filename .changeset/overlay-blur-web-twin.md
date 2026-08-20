---
'rn-motion-ui': patch
---

fix(Overlay): web scrim blur no longer requires the optional native peer

The overlay backdrop blur moved its guarded `@sbaiahmed1/react-native-blur`
require into a `.native.tsx` twin; web resolves a CSS `backdrop-filter` twin
(`blur(30px)`) and never imports the optional peer, so the web bundle builds
without it. Previously the static `require` hard-failed web bundling whenever
the optional peer wasn't hoisted into the resolving workspace's node_modules
(e.g. a pruned install where storybook/web is the bundling workspace).
