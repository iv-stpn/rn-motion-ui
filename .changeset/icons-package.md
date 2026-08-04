---
"rn-motion-ui-icons": minor
---

**New package**: `rn-motion-ui-icons` — the MingCute set, one subpath per icon.

The icon set used to be a single generated `icons.tsx` inside `rn-motion-ui`: 109
Lucide icons in one 2,700-line module. That shape had a ceiling. Adding an icon
meant regenerating the file and shipping it to everyone, one module meant a
bundler had to be trusted to shake 108 icons you did not import, and 109 was
simply not many — every few components arrived wanting a glyph the file did not
have.

This package is the set as its own thing: 3,335 MingCute icons, 1,668 filled and
1,667 outline, each its own module behind its own export.

```tsx
import { CheckLine } from 'rn-motion-ui-icons/icons/check-line';
import { FolderFill } from 'rn-motion-ui-icons/icons/folder-fill';

<CheckLine size={20} />
```

There is no barrel. Importing an icon reaches exactly one file, so what you get
is what you asked for regardless of how well your bundler shakes trees, and the
other 3,334 cost nothing.

Every icon is `react-native-svg`, so the same import renders on native and on
react-native-web with no icon font and no native linking. Colour defaults to the
`foreground` theme token through `useThemeColor` — which is why `rn-motion-ui` is
a peer here, and why an icon dropped into a themed surface is already the right
colour.

`IconProps` (`rn-motion-ui-icons/icon-props`) is shared by all of them: `size`
(default 24), `color`, `style`, `accessibilityLabel`. Omitting the label leaves
the icon decorative rather than announcing it; the icon takes `accessibilityRole="image"`
only when a label is present.

Icons are generated from `@iconify-json/mingcute` by `scripts/gen-icons.mjs`
(`bun run --cwd packages/icons gen`) and committed, so the generator is a
dev-time dependency and never ships.

There is no `strokeWidth`. A MingCute glyph is drawn at the weight it was
designed at — outline icons at stroke 2, filled ones with no stroke at all — so a
width prop would only let a caller distort the geometry.

The package declares `(MIT AND Apache-2.0)`: the wrapper code is MIT like the
rest of this repo, and the icon artwork is MingCute's, under Apache-2.0. Both
licence texts and a `NOTICE` ship in the tarball. `rn-motion-ui` itself stays
MIT — Apache-2.0 is permissive and not copyleft, so depending on the icons
imposes nothing on your own licence.
