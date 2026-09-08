---
'rn-motion-ui': patch
---

feat(Dock/MorphingDockSwitch): pill dock bars, capsule items and animated labels

Both docks now read as a single pill, and their icon buttons are capsules (wider
than tall) instead of squares. The active highlight covers the full item, and
toggling `showLabels` scales the icon and fades the caption in and out.

- **New component** — `rn-motion-ui/morphing-dock-switch` exposes
  `<MorphingDockSwitch />`: a dock whose trailing double-caret button unfolds it
  into a vertical switcher (the active item becomes the header row, the rest fill
  in with labels revealed). Shares the `size` / `floating` / `elevation` /
  `showLabels` contract with `Dock`.
- **Pill / capsule geometry** — the container silhouette is fully rounded
  (`rounded-full`), and each dock element is a capsule — `1.2×` width icon-only,
  `1.8×` when labelled — rather than a square. The gliding active highlight now
  overlays the whole item instead of an inset pill.
- **Animated labels** — `showLabels` widens the items and enlarges the icon (a
  `1.25×` scale), while the caption appears/disappears with a scale + fade
  animation through `AnimatePresence`. Icons also sit larger overall (base size
  raised from `0.45×` to `0.5×` the item side).
