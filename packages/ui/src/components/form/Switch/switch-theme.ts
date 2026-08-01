// biome-ignore-all lint/style/useExportsLast: the exported types are the vocabulary the theme tables below are typed in
// The Switch's colour system: the three fills a switch is made of, the built-in
// themes that name them, and the resolver that turns either into concrete sRGB.
//
// Split out of switch.tsx the way button-scale.ts is split out of the button
// family — this is data plus one resolver hook, with no JSX and none of the
// switch's press/shake machinery, so the table can be read (and a theme added)
// without scrolling past the component.
//
// Colours are resolved to concrete strings rather than expressed as Tailwind
// classes because the track and thumb fills are set through `style`: a theme slot
// accepts an arbitrary CSS colour, which no class can carry, and the resolved
// value is also what an animated `backgroundColor` would need if the track ever
// cross-fades. Token names still go through the theme bridge, so a themed slot
// follows light/dark and consumer `@theme` overrides exactly as a class would.

import { cssColorToOklch, oklchToSrgb } from '../../../lib/color';
import { type ThemeToken, useThemeColors } from '../../../theme/use-theme-color';

/**
 * A colour slot in a switch theme — either a semantic token name (resolved from
 * the active theme, so it follows light/dark and consumer `@theme` overrides),
 * the same with a Tailwind-style alpha suffix (`'muted-foreground/60'`), or any
 * literal CSS colour string RN understands (`'#0ea5e9'`, `'rgba(0,0,0,0.4)'`).
 *
 * Token names win over literals when a string is both — `'white'` and `'black'`
 * are tokens, and they hold exactly the CSS value of the same name anyway.
 */
export type SwitchColor = ThemeToken | `${ThemeToken}/${number}` | (string & Record<never, never>);

/** The three fills a switch theme is made of. */
export type SwitchThemeColors = {
  /** Track fill while selected. */
  track?: SwitchColor;
  /** Track fill while unselected. */
  trackOff?: SwitchColor;
  /** Thumb fill, in both states. */
  thumb?: SwitchColor;
};

/** Built-in themes, one per status token plus the monochrome `primary`. */
export type SwitchThemeName = 'info' | 'primary' | 'success' | 'warning' | 'danger' | 'special';

/** The theme's three fills, resolved to concrete sRGB strings. */
export type SwitchColors = { track: string; trackOff: string; thumb: string };

/**
 * Grey off-track, shared by every built-in theme: a translucent mid-grey that
 * lands legible against both a light and a dark page, and keeps enough contrast
 * under the thumb in either scheme.
 */
const TRACK_OFF: SwitchColor = 'muted-foreground/60';

/**
 * The built-in themes. Each pairs a vivid track fill with the thumb colour that
 * stays legible on it. Status fills all take a `white` thumb; `primary` takes
 * `primary-foreground` instead, because `primary` is near-white in dark mode and
 * a white thumb would vanish into it.
 */
const SWITCH_THEMES: Record<SwitchThemeName, Required<SwitchThemeColors>> = {
  info: { track: 'info', trackOff: TRACK_OFF, thumb: 'white' },
  primary: { track: 'primary', trackOff: TRACK_OFF, thumb: 'primary-foreground' },
  success: { track: 'success', trackOff: TRACK_OFF, thumb: 'white' },
  warning: { track: 'warning', trackOff: TRACK_OFF, thumb: 'white' },
  danger: { track: 'danger', trackOff: TRACK_OFF, thumb: 'white' },
  special: { track: 'special', trackOff: TRACK_OFF, thumb: 'white' },
};

// `<token>/<alpha>` — alpha is a Tailwind-style percentage (60 → 0.6).
const TOKEN_ALPHA_RE = /^([a-z0-9-]+)\/(\d{1,3})$/;

/**
 * Resolve one colour slot against the active theme's token table.
 *
 * A bare token name resolves straight through. A `token/NN` suffix re-alphas the
 * resolved value (replacing any alpha the token carries, as Tailwind's own slash
 * modifier does). Anything else — a hex, an `rgb()`, a named CSS colour — is
 * already a concrete colour and passes through untouched.
 */
function resolveColor(spec: SwitchColor, colors: Record<string, string | undefined>): string {
  const direct = colors[spec];
  if (direct !== undefined) return direct;

  const match = TOKEN_ALPHA_RE.exec(spec);
  const token = match?.[1];
  const alpha = match?.[2];
  if (token === undefined || alpha === undefined) return spec;

  const base = colors[token];
  // Unknown token, or one in a notation lib/color can't read (a named colour):
  // hand back the spec rather than guess at a fill.
  const oklch = base === undefined ? null : cssColorToOklch(base);
  if (!oklch) return spec;
  return oklchToSrgb(oklch.lightness, oklch.chroma, oklch.hue, Number(alpha) / 100);
}

/**
 * Resolve a `theme` prop to the three concrete fills the track and thumb paint
 * with. A name picks a built-in theme; an object overrides individual slots on
 * top of `info`, so `{ track: '#0ea5e9' }` keeps the grey off-track and the
 * white thumb.
 */
export function useSwitchColors(theme: SwitchThemeName | SwitchThemeColors): SwitchColors {
  const colors = useThemeColors();
  const base = typeof theme === 'string' ? SWITCH_THEMES[theme] : SWITCH_THEMES.info;
  const overrides = typeof theme === 'string' ? null : theme;
  return {
    track: resolveColor(overrides?.track ?? base.track, colors),
    trackOff: resolveColor(overrides?.trackOff ?? base.trackOff, colors),
    thumb: resolveColor(overrides?.thumb ?? base.thumb, colors),
  };
}
