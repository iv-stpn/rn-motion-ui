---
"rn-motion-ui": patch
---

fix(theme): native read the dark values in both schemes — tokens.css now declares each scheme through `@variant`

Every surface on native rendered its dark value regardless of the active scheme. In the native Storybook the symptom was a page that disagreed with itself: white chrome, dark cards. Web was unaffected throughout.

tokens.css expressed dark mode the way a plain Tailwind sheet does — light values in `@theme`, dark values in `@media (prefers-color-scheme: dark) { :root:not(.light) }` plus a bare `.dark` block. Both dark forms are correct CSS and both work on web. Neither is a shape uniwind recognises as a theme.

uniwind builds `vars.light` and `vars.dark` from one shared global base that diverges *solely* via per-theme override buckets, and it fills those buckets only from declarations whose selector carries `:where(.light, …)` / `:where(.dark, …)`. Compiling the sheet produced no buckets at all: the `.dark` block parsed as a utility class named `dark`, and the media-query dark values fell through to the global base as the last write. So both scheme maps existed, both were byte-identical, and both held dark values — which is also why toggling the scheme changed nothing.

The per-scheme values now live in top-level `@variant light` / `@variant dark` blocks, which expand to exactly that `:where()` shape. `@theme` keeps the light values, since that is what registers each token with Tailwind and what lands on `:root` for the web base, and keeps the tokens that don't flip (`--shadow-elevated-*`, `--spacing-button-*`, `--radius-button-*`) — a value that lives only in `@theme` is now theme-independent by construction.

Web behaviour is unchanged. `@variant` compiles to the same three rules the sheet previously spelled out by hand: a `.dark` class rule, a `.light` class rule, and an OS-preference rule that either class suppresses. A `.light` class is still an absolute override that opts out of OS dark.

Two consequences worth knowing:

- **uniwind is now load-bearing for scheme switching on native**, where before the sheet also carried a plain-CSS fallback. It was already required for `className` to do anything at all, so nothing that worked before stops working.
- **Both `@variant` blocks must declare the identical token set.** uniwind logs a parity error per missing token rather than throwing, so drift is quiet. `scripts/check-token-parity.mjs` now holds `@theme` ⇄ `@variant light` ⇄ `@variant dark` ⇄ the native `LIGHT_OKLCH`/`DARK_OKLCH` tables to one another, and runs in CI.

The native Storybook preview also drives the scheme through `Uniwind.setTheme()` instead of `Appearance.setColorScheme()`, seeded at module scope so the first paint is already correct, and synced from the `darkMode` arg in an effect rather than during render. `setTheme()` notifies every mounted `className` consumer; doing that mid-render was tearing down Storybook's in-flight render, which is where the `cannot render when not prepared` and `canvasElement is unset` rejections came from.
