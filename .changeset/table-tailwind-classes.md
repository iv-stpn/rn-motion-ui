---
"rn-motion-ui": minor
---

Restyle `Table` with NativeWind `className` and expose per-slot customization props.

- Table internals now use Tailwind/uniwind `className` (merged via `cn`) instead of `StyleSheet` + the `useTableColors` hook. Colors resolve through the existing theme tokens (`bg-muted`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary`, …) and are overridable with classes. Numeric values that can't be classes (column widths, row/container height, drop-indicator offset) stay inline.
- New flat customization props on `Table`: `headerClassName`, `rowClassName`, `cellClassName`, `cardClassName`, `footerClassName` (the existing `className` covers the outer container). Each merges last-wins over the defaults — e.g. `rowClassName="bg-card"` overrides the row background. `style` / `cardStyle` / `stripedStyle` are retained for dynamic inline overrides.
- Removed the `./table-styles` package export and deleted `table-styles.ts` and `table-theme.ts`. This drops a previously-published import path (`rn-motion-ui/table-styles`); migrate to the `className` / `*ClassName` props. Bumped as minor per maintainer decision.
