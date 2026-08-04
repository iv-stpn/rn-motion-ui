---
"rn-motion-ui": minor
---

**Breadcrumbs: new component — the trail FileSystem already drew, now its own.**

A breadcrumb trail: the levels above the current one, each a way back, with the
current one as plain text at the end. It knows nothing about what a level *is* —
pass the segments outermost-first and read back the pressed `id`, so a folder
path, a route key and a wizard step are all the same thing to it.

```tsx
import { Breadcrumbs } from 'rn-motion-ui/breadcrumbs';

<Breadcrumbs
  items={[
    { id: '', label: 'Files' },
    { id: 'documents', label: 'Documents' },
    { id: 'documents/reports', label: 'Reports' },
  ]}
  onNavigate={navigateTo}
/>
```

A deep trail scrolls horizontally by default, keeping one line. Set `maxVisible`
instead to hold it to a fixed number of levels: the middle folds behind a `…`
that says how much it hides and hands those levels back when pressed, so nothing
becomes unreachable. `scrollable={false}` wraps instead of scrolling.

The rest of the surface: `separator` replaces the chevron with any node, `size`
picks the text scale (`'sm'` | `'base'`) and takes the separator and icons with
it, an `icon` per item rides ahead of its label, and `currentId` picks which level
is the destination — `null` makes every level pressable, for a trail whose leaf is
not where you are. `className`, `contentClassName` and `itemClassName` reach the
container, the segment row and each segment.

Accessibility: the container is a `list` named `Breadcrumb`, every earlier level
is a `button` named `Go to {label}` (override per item with `accessibilityLabel`),
and the current level is text — being the one unpressable segment is what marks
it as current. RN has no `aria-current`, so the trail does not claim one.

**`FileSystem` now renders this component** instead of its own private trail. No
API change and no visual change: same placement under the header, same hiding at
the root, same `rootLabel` as the leading segment, and the same `Go to {label}`
names its stories already query. Both trails — the bar and the per-row ones under
search results — are now built from one `buildCrumbs`.
