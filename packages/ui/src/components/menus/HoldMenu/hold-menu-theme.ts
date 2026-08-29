/**
 * The `HoldMenu` palette — upstream react-native-hold-menu's colors, gathered
 * in one module so the hardcoded values (which are the library's exact look)
 * are documented in a single place with a single exemption per line.
 *
 * The color-check script (`scripts/check-no-hardcoded-colors.mjs`) fails on
 * raw hex/rgba literals in component files unless the line carries the
 * `theme-exempt` comment. These constants are the upstream palette — not theme
 * tokens — so every colored export here is annotated.
 *
 * Only the backdrop dim and the panel fill survive: the row, border and text
 * colours moved onto the generic `Menu`, which reads them from theme tokens.
 * The panel fill stays because it is the panel's own frame — a near-opaque
 * wash the upstream palette pins, not a row colour the `Menu` would resolve.
 */

/** Backdrop dim layered over the blur — a light translucent scrim so the frosted page behind reads through on both native and web. */
export const BACKDROP_BLUR_BACKGROUND_COLOR = 'rgba(0, 0, 0, 0.25)'; // theme-exempt: upstream hold-menu backdrop palette

/** Panel fill, light theme — near-opaque so the rows read without a blur behind them. */
export const MENU_PANEL_LIGHT_COLOR = 'rgba(255, 255, 255, .95)'; // theme-exempt: upstream hold-menu panel palette

/** Panel fill, dark theme — near-opaque so the rows read without a blur behind them. */
export const MENU_PANEL_DARK_COLOR = 'rgba(39, 39, 39, .8)'; // theme-exempt: upstream hold-menu panel palette
