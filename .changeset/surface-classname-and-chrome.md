---
"rn-motion-ui": minor
---

feat(elevated): export `SURFACE_CLASSNAME`, and drop the built-in frame from `FileSystem` and the `AdaptiveDropdown` panel

New `SURFACE_CLASSNAME` on `rn-motion-ui/elevated` — a level-indexed map pairing each surface background with the matching elevation shadow, so a custom surface can take both halves of the ladder at one level without calling `surfaceBackground` and `elevatedShadow` separately.

```ts
import { SURFACE_CLASSNAME } from 'rn-motion-ui/elevated';

<View className={SURFACE_CLASSNAME[5]} />; // bg-surface-5 shadow-elevated-5
```

It is a plain record, not a function, so it is indexed rather than clamped: `surfaceBackground` and `elevatedShadow` still take any number and clamp it into range, while an out-of-range index here is a type error and, from untyped JS, `undefined`. Reach for the functions when the level is computed at runtime.

**Visual change.** `FileSystem`'s root no longer draws `rounded-xl border border-border`, and `AdaptiveDropdown`'s floating panel no longer draws `border border-border`. Both now render an unframed surface, leaving the frame to the container they sit in — a `FileSystem` inside a card or a pane of its own was stacking two borders, and there was no way to opt out.

`FileSystem` takes the old chrome back through `className="rounded-xl border border-border"`; the shared `cn` resolves consumer classes last-wins, so it applies. The dropdown panel has no such escape hatch — `contentClassName` reaches the body inside the panel, not the panel itself — so its border cannot currently be restored from the outside. It keeps its `rounded-2xl` and its `elevation` shadow, which is what separates it from the page.

Internally, the per-file `cn` copies in `Card`, `Skeleton` and `AdaptiveModal` — each a comment claiming the package ships no shared `cn` — are replaced by the real `src/lib/cn.ts`. Those copies only concatenated, so a consumer class and a component default targeting the same utility group both survived into the class string and the winner came down to stylesheet order. They now resolve last-wins in the consumer's favour, which is what their prop docs already promised.
