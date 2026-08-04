# rn-motion-ui-icons

The [MingCute](https://github.com/Richard9394/MingCute) icon set for
[`rn-motion-ui`](https://www.npmjs.com/package/rn-motion-ui) — 3,335 icons, one
subpath export per icon, no barrel.

Every icon is a `react-native-svg` component, so the same import renders on
native (iOS/Android) and on the web through `react-native-web`. No icon font, no
native linking.

## Install

```sh
npm install rn-motion-ui-icons
# or: bun add rn-motion-ui-icons
```

### Peer dependencies

Install these in your app (they are not bundled):

```sh
npm install react react-native react-native-svg rn-motion-ui
```

| Peer | Supported range |
| --- | --- |
| `react` | `>=18.0.0` |
| `react-native` | `>=0.76.0` |
| `react-native-svg` | `>=15.0.0` |
| `rn-motion-ui` | `^4.0.0` |

`rn-motion-ui` is a peer because icons read their default colour from its theme
layer — see [Colour](#colour).

## Usage

Each icon lives at its own subpath. Import it directly:

```tsx
import { CheckLine } from 'rn-motion-ui-icons/icons/check-line';
import { FolderFill } from 'rn-motion-ui-icons/icons/folder-fill';

<CheckLine size={20} />
<FolderFill size={32} color="#2563eb" />
```

There is no barrel export by design. Importing an icon reaches exactly one
module, so you get what you asked for regardless of how well your bundler shakes
trees — the other 3,334 icons cost nothing.

## Naming

Every icon is suffixed `-line` (1,667 outline) or `-fill` (1,668 filled). The
exported component is the PascalCase of the file name, digits included:

| Subpath | Export |
| --- | --- |
| `icons/check-line` | `CheckLine` |
| `icons/folder-fill` | `FolderFill` |
| `icons/more-1-line` | `More1Line` |
| `icons/user-2-line` | `User2Line` |

Names come from MingCute, not Lucide or Material — kebab-case the concept, add
`-line` or `-fill`. Browse the full set at
[mingcute.com](https://www.mingcute.com/).

## Props

All icons share one prop type, `IconProps`:

```tsx
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
```

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `size` | `number` | `24` | Square edge length in px. |
| `color` | `string` | `foreground` token | Fill / stroke colour. |
| `style` | `StyleProp<ViewStyle>` | — | Passed to the root `Svg`. |
| `accessibilityLabel` | `string` | — | Omit to leave the icon decorative. |

An icon takes `accessibilityRole="image"` only when `accessibilityLabel` is
present. Leave the label off for icons sitting next to text that already names
the action, and set it when the icon is the only thing conveying meaning.

There is no `strokeWidth`. A MingCute glyph is drawn at the weight it was
designed at — outline icons at stroke 2, filled ones with no stroke at all — so a
width prop would only distort the geometry.

## Colour

With no `color` prop, an icon resolves the `foreground` theme token through
`useThemeColor` from `rn-motion-ui`. An icon dropped onto a themed surface is
already the right colour, and follows light/dark with it:

```tsx
<CheckLine />                  {/* foreground token, follows the theme */}
<CheckLine color="#2563eb" />  {/* explicit, ignores the theme */}
```

That default is the reason `rn-motion-ui` is a peer dependency. Every colour it
can resolve is documented under **Theming** in the
[`rn-motion-ui` README](https://github.com/iv-stpn/rn-motion-ui#readme).

## Generated source

This package ships TypeScript source, no prebuilt bundle — the same arrangement
as `rn-motion-ui`, and it needs the same bundler setup (see that package's
**Consumer setup**).

Icons are generated from [`@iconify-json/mingcute`](https://www.npmjs.com/package/@iconify-json/mingcute)
(v1.2.8) by `scripts/gen-icons.mjs` and committed, so the generator is a
dev-time dependency and never ships:

```sh
bun run --cwd packages/icons gen
```

Do not edit files under `src/icons/` by hand — the next run overwrites them.

## License

`(MIT AND Apache-2.0)` — two licenses, because this package is two things.

| What | License |
| --- | --- |
| The wrapper components, `IconProps`, the generator | [MIT](./LICENSE) © Ivan Stepanian |
| The icon artwork (every SVG path) | [Apache-2.0](./LICENSE-APACHE) © MingCute Design |

The glyphs are [MingCute](https://github.com/Richard9394/MingCute), redistributed
here as React Native components under Apache-2.0 §4. Attribution and the list of
what was changed are in [NOTICE](./NOTICE). MingCute is not affiliated with this
package and does not endorse it.

Using the icons means complying with both — in practice, keep the `NOTICE` and
`LICENSE-APACHE` files that ship in the package, which is the default if you just
install it.
