---
"rn-motion-ui": minor
---

New `ThemedIcon` at `rn-motion-ui/icon` wraps any icon from `rn-motion-ui/icons` and resolves its stroke colour from the active theme, so an icon can be placed by the name of the surface it sits on rather than by a colour threaded down from a hook call.

Two ways to name that colour, `token` winning if both are given:

- `variant` takes any `ButtonVariant` or `ElevatedVariant` name and maps it to that fill's legible partner — `variant="primary"` gives `primary-foreground`, `variant="ghost"` gives `muted-foreground`, `variant="success"` gives `success-foreground`, and the outline/ghost danger variants give the `danger` hue itself since there is no fill to sit on. The mapping is the same one `ElevatedButton`'s `elevatedContentColor` and `Button`'s label cva already use, so an icon passed as a button adornment lands on the colour that button's own label would. Defaults to `secondary`, i.e. the plain `foreground` token.
- `token` skips the lookup and resolves a `ThemeToken` directly, for icons whose colour isn't a button variant — a `success-foreground` check inside a green circle, or a colour that flips between two tokens on a state, `token={isActive ? 'foreground' : 'muted-foreground'}`.

Everything else in `IconProps` (`size`, `strokeWidth`, `style`, `accessibilityLabel`) is forwarded untouched.

Internally, the components that were each calling `useThemeColor`/`useThemeColors` solely to hand a colour to an icon now use it instead: `ActionFeedbackModal`, `BloomMenu`, `BouncyAccordion`, `CommandPalette`, `FeedbackWidget`, `FileTree`'s search input, `Input`, `OtpInput`, `OverflowActions`, `Table`'s pagination footer, and the `FileSystem` toolbar, header, list view, menus, filter menu, filter pills, and date-range modal. Rendered colours are unchanged. Where the icon wanted the `foreground` token anyway, the wrapper is dropped altogether — icons already fall back to `foreground` when given no `color`, as in `BloomMenu`'s cells.

`MenuRow` in `MultiStepMenu` gains `iconColor`, defaulting to the `white` it previously hard-coded. That default is right for the vivid iOS-style icon squares the row is built around, but `iconBackgroundColor` is a free-form colour, and a pale or neutral fill needs a darker icon to stay legible. Its active label also moves from a literal `text-white` to `text-primary-foreground`, which is the same colour but follows the theme.
