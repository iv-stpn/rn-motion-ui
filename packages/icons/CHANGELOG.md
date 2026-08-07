# rn-motion-ui-icons

## 1.0.0

### Patch Changes

- 706dac3: **New package**: `rn-motion-ui-icons` — the MingCute set, one subpath per icon.

  The icon set used to be a single generated `icons.tsx` inside `rn-motion-ui`: 109
  Lucide icons in one 2,700-line module. That shape had a ceiling. Adding an icon
  meant regenerating the file and shipping it to everyone, one module meant a
  bundler had to be trusted to shake 108 icons you did not import, and 109 was
  simply not many — every few components arrived wanting a glyph the file did not
  have.

  This package is the set as its own thing: 3,335 MingCute icons, 1,668 filled and
  1,667 outline, each its own module behind its own export.

  ```tsx
  import { CheckLine } from "rn-motion-ui-icons/icons/check-line";
  import { FolderFill } from "rn-motion-ui-icons/icons/folder-fill";

  <CheckLine size={20} />;
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
  (default 24), `color`, `style`, `accessibilityLabel`, `testID`. Omitting the
  label leaves the icon decorative rather than announcing it; the icon takes
  `accessibilityRole="image"` only when a label is present.

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

- 4eea56d: Every icon takes a `testID`

  An icon was addressable in a test only through its accessibility label, which
  tied a test selector to user-facing copy and left decorative icons — the ones
  with no label, by design — unreachable. `IconProps` now carries `testID`, passed
  straight to the root `Svg`:

  ```tsx
  <CheckLine testID="confirm-check" />
  ```

  The prop is optional and adds nothing when omitted, so an icon that does not ask
  for one renders exactly as before. This matches the `testID` the form components
  in `rn-motion-ui` already accept, so a screen mixing the two has one way to
  select either.

- 9fd7f7d: **Icon `color` prop now accepts theme tokens with full autocomplete.**

  Pass any `ThemeToken` value (`"primary"`, `"muted-foreground"`, `"danger"`, …) directly to an icon's `color` prop and the icon will resolve it live — updating automatically when the color scheme changes, just like `useThemeColor` would.

  ```tsx
  // before — manual resolution required
  const color = useThemeColor('primary');
  <ArrowRightLine color={color} />

  // after — token passed directly, stays reactive
  <ArrowRightLine color="primary" />
  ```

  Raw strings (hex, rgb, named CSS colors) and the omit-for-default behaviour are unchanged.

  **Type change:** `color` on `IconProps` is now `ThemeToken | (string & {})` instead of `string`. This is source-compatible — all existing string assignments still compile — but IDEs will now surface the full token list as autocomplete suggestions.

- Updated dependencies [a4e9e3e]
- Updated dependencies [6605e30]
- Updated dependencies [99e42b1]
- Updated dependencies [ae616b8]
- Updated dependencies [92504b5]
- Updated dependencies [b7ea1df]
- Updated dependencies [0756779]
- Updated dependencies [44a0672]
- Updated dependencies [631606c]
- Updated dependencies [072fe70]
- Updated dependencies [e86dced]
- Updated dependencies [e86dced]
- Updated dependencies [d6b0d95]
- Updated dependencies [1d16717]
- Updated dependencies [2f9bfc7]
- Updated dependencies [85d5ada]
- Updated dependencies [e7acea7]
- Updated dependencies [234a3cb]
- Updated dependencies [234a3cb]
- Updated dependencies [56b1f2f]
- Updated dependencies [3f7a5df]
- Updated dependencies [4c88409]
- Updated dependencies [dfbc2da]
- Updated dependencies [ff3582a]
- Updated dependencies [706dac3]
- Updated dependencies [e9f5fe0]
- Updated dependencies [e0b326e]
- Updated dependencies [f3e006d]
- Updated dependencies [603c921]
- Updated dependencies [1d9a279]
- Updated dependencies [d8c1833]
- Updated dependencies [97a2b25]
- Updated dependencies [b2aabe1]
- Updated dependencies [48e1a5c]
- Updated dependencies [51dd604]
- Updated dependencies [f3e006d]
- Updated dependencies [04e622d]
- Updated dependencies [51c43f7]
  - rn-motion-ui@5.0.0
