---
'rn-motion-ui': major
---

feat(Marquee)!: remove the `Marquee` component

**Breaking change**

`Marquee` is gone, and with it the `rn-motion-ui/marquee` subpath. The removed
exports are `Marquee`, `MarqueeProps` and `MarqueeDirection`.

There is no drop-in replacement. A marquee is two duplicated tracks translated in
lockstep by a `withRepeat(withTiming(…), -1)` loop on a shared value — roughly
thirty lines against `react-native-reanimated` — so consumers still needing one
should vendor it rather than reach for another component here.

Unaffected: the FileSystem's drag-to-select box, which is also called a marquee
internally (`useFileSystemMarquee`, `selectMarquee`). It is a separate feature and
stays exactly as it is.
