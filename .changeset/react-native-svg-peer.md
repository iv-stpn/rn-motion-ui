---
"rn-motion-ui": minor
---

Move `react-native-svg` to `peerDependencies`.

As a native module it must be installed and autolinked by the consumer app; shipping it as a regular dependency risks duplicate autolink or version conflicts at the native layer — the classic RN library footgun.

Consumers who relied on the transitive install will now need to add `react-native-svg` to their own `dependencies`.
