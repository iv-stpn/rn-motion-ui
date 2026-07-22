import { Platform, useColorScheme } from 'react-native';

/**
 * The semantic color tokens exported by rn-motion-ui/tokens.css.
 *
 * Each key corresponds to a `--color-<token>` CSS custom property.
 */
type ThemeToken =
  | 'surface'
  | 'foreground'
  | 'card'
  | 'muted'
  | 'muted-foreground'
  | 'border'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'secondary-foreground'
  | 'destructive'
  | 'success'
  | 'warning';

/**
 * Static color maps — hex/rgba approximations of the tokens.css @theme values.
 *
 * Used on native (where CSS vars are unavailable) and as the web SSR fallback.
 * React Native only accepts sRGB color formats (hex, rgb, rgba, hsl, hsla),
 * so we store pre-converted values here rather than the raw oklch strings from
 * tokens.css (which work in browsers but not in RN StyleSheet / SVG props).
 *
 * Keep these in sync with tokens.css whenever the @theme block changes.
 */
const LIGHT: Record<ThemeToken, string> = {
  surface: '#fafafa', // oklch(99% 0 0)
  foreground: '#111111', // oklch(15% 0 0)
  card: '#f4f4f5', // oklch(97% 0 0)
  muted: '#f4f4f5', // oklch(97% 0 0)
  'muted-foreground': '#737373', // oklch(50% 0 0)
  border: 'rgba(17,17,17,0.06)', // oklch(15% 0 0 / 0.06)
  primary: '#111111', // oklch(15% 0 0)
  'primary-foreground': '#fafafa', // oklch(99% 0 0)
  secondary: '#f4f4f5', // oklch(97% 0 0)
  'secondary-foreground': '#111111', // oklch(15% 0 0)
  destructive: '#e5484d', // oklch(62% 0.22 25)
  success: '#22c55e', // oklch(70% 0.18 155)
  warning: '#eab308', // oklch(78% 0.18 75)
};

const DARK: Record<ThemeToken, string> = {
  surface: '#111111', // oklch(9% 0 0)
  foreground: '#f4f4f5', // oklch(96% 0 0)
  card: '#1c1c1c', // oklch(13% 0 0)
  muted: '#222222', // oklch(16% 0 0)
  'muted-foreground': '#8f8f8f', // oklch(60% 0 0)
  border: 'rgba(250,250,250,0.08)', // oklch(99% 0 0 / 0.08)
  primary: '#f4f4f5', // oklch(96% 0 0)
  'primary-foreground': '#111111', // oklch(15% 0 0)
  secondary: '#252525', // oklch(18% 0 0)
  'secondary-foreground': '#f4f4f5', // oklch(96% 0 0)
  destructive: '#ef4444', // oklch(66% 0.22 25)
  success: '#4ade80', // oklch(72% 0.18 155)
  warning: '#facc15', // oklch(80% 0.18 75)
};

/**
 * Resolve a semantic token to a concrete color string at runtime.
 *
 * - **Web**: reads the CSS custom property (`--color-<token>`) from the document
 *   root via `getComputedStyle`, so it always reflects the active Tailwind theme
 *   (including any consumer `@theme` overrides). Falls back to the static map
 *   during SSR when the DOM is unavailable.
 * - **Native**: uses `useColorScheme()` to pick between the light/dark static
 *   maps derived from `tokens.css`. No provider or setup required.
 *
 * @example
 * // Pass resolved color to a Reanimated worklet:
 * const spinnerColor = useThemeColor('primary');
 * const style = useAnimatedStyle(() => ({ borderColor: spinnerColor }));
 *
 * @example
 * // Pass resolved color to a react-native-svg prop:
 * const fill = useThemeColor('success');
 * return <Path fill={fill} d="..." />;
 */
export function useThemeColor(token: ThemeToken): string {
  // useColorScheme is called unconditionally to satisfy the rules-of-hooks.
  // Platform.OS is a build-time constant so the branch below never flips at
  // runtime, but the hook must still be called on every render path.
  const scheme = useColorScheme();

  if (Platform.OS !== 'web') return (scheme === 'dark' ? DARK : LIGHT)[token];

  // Web: read the live CSS custom property so consumer @theme overrides are
  // respected. Falls back to the static light-mode value during SSR.
  if (typeof document === 'undefined') return LIGHT[token];

  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim();
  return raw || LIGHT[token];
}

/**
 * Snapshot of all token values for the current color scheme.
 *
 * Useful when multiple tokens are needed at once (avoids N separate
 * `getComputedStyle` calls on web).
 */
export function useThemeColors(): Record<ThemeToken, string> {
  const scheme = useColorScheme();

  if (Platform.OS !== 'web') return scheme === 'dark' ? DARK : LIGHT;

  if (typeof document === 'undefined') return LIGHT;

  const style = getComputedStyle(document.documentElement);
  // biome-ignore lint/plugin: {} as Record<ThemeToken,string> is safe — we populate every key in the loop below
  const result = {} as Record<ThemeToken, string>;
  // biome-ignore lint/plugin: Object.keys(LIGHT) is exactly ThemeToken[] — LIGHT is typed Record<ThemeToken,string>
  for (const token of Object.keys(LIGHT) as ThemeToken[]) {
    const raw = style.getPropertyValue(`--color-${token}`).trim();
    result[token] = raw || LIGHT[token];
  }
  return result;
}

export type { ThemeToken };
