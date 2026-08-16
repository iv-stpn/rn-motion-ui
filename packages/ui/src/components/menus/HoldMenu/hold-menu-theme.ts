import { BACKDROP_BLURS } from './hold-menu-constants';

/**
 * The `HoldMenu` palette — upstream react-native-hold-menu's colors, gathered
 * in one module so the hardcoded values (which are the library's exact look)
 * are documented in a single place with a single exemption per line.
 *
 * The color-check script (`scripts/check-no-hardcoded-colors.mjs`) fails on
 * raw hex/rgba literals in component files unless the line carries the
 * `theme-exempt` comment. These constants are the upstream palette — not theme
 * tokens — so every export here is annotated.
 */

/** Backdrop dim behind the menu in the light theme — blur-capable platforms (iOS/Android/web) get a film, platforms without blur the near-opaque scrim. */
export const BACKDROP_LIGHT_BACKGROUND_COLOR = BACKDROP_BLURS
  ? 'rgba(0,0,0,0.2)' // theme-exempt: upstream hold-menu backdrop palette
  : 'rgba(19, 19, 19, 0.95)'; // theme-exempt: upstream hold-menu backdrop palette

/** Backdrop dim behind the menu in the dark theme — a translucent film; platforms without blur keep the near-opaque dim. */
export const BACKDROP_DARK_BACKGROUND_COLOR = BACKDROP_BLURS
  ? 'rgba(0,0,0,0.5)' // theme-exempt: upstream hold-menu backdrop palette, darkened less than upstream per user request
  : 'rgba(0,0,0,0.95)'; // theme-exempt: upstream hold-menu backdrop palette

/** Panel fill over the blur, light theme — translucent so the blur reads through. */
export const MENU_PANEL_LIGHT_COLOR = BACKDROP_BLURS
  ? 'rgba(255, 255, 255, .75)' // theme-exempt: upstream hold-menu panel palette
  : 'rgba(255, 255, 255, .95)'; // theme-exempt: upstream hold-menu panel palette

/** Panel fill over the blur, dark theme — translucent so the blur reads through. */
export const MENU_PANEL_DARK_COLOR = BACKDROP_BLURS
  ? 'rgba(0,0,0,0.5)' // theme-exempt: upstream hold-menu panel palette
  : 'rgba(39, 39, 39, .8)'; // theme-exempt: upstream hold-menu panel palette

/** Hairline between rows, light theme. */
export const BORDER_LIGHT_COLOR = 'rgba(0, 0, 0, 0.1)'; // theme-exempt: upstream hold-menu border palette

/** Hairline between rows, dark theme. */
export const BORDER_DARK_COLOR = 'rgba(255, 255, 255, 0.1)'; // theme-exempt: upstream hold-menu border palette

/** Title row text — grey in both themes, exactly as upstream. */
export const MENU_TITLE_COLOR = 'gray';

/** Action row text, light theme. */
export const MENU_TEXT_LIGHT_COLOR = 'rgba(0, 0, 0, 1)'; // theme-exempt: upstream hold-menu text palette

/** Action row text, dark theme. */
export const MENU_TEXT_DARK_COLOR = 'rgb(255, 255, 255)'; // theme-exempt: upstream hold-menu text palette

/** Destructive row text, light theme. */
export const MENU_TEXT_DESTRUCTIVE_COLOR_LIGHT = 'rgb(255, 59, 48)'; // theme-exempt: upstream hold-menu destructive palette

/** Destructive row text, dark theme. */
export const MENU_TEXT_DESTRUCTIVE_COLOR_DARK = 'rgb(255, 69, 58)'; // theme-exempt: upstream hold-menu destructive palette
