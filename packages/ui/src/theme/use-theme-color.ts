import { useEffect, useState } from 'react';
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
 * Force a re-render whenever the active theme changes on web.
 *
 * `getComputedStyle` reads the CSS var at the moment of the call, so without a
 * subscription the resolved color is frozen at whatever the theme was at the
 * last commit. `useColorScheme()` only tracks the OS `prefers-color-scheme`
 * media query — it does NOT notice a manual `.dark`/`.light` class toggle on
 * `<html>` (which is how the Storybook toolbar, and most app theme toggles,
 * switch themes). The result: components flipped black → white (or vice versa)
 * a frame late, or never, because no re-render was scheduled after the swap.
 *
 * This subscribes to both signals — the media query AND class-attribute
 * mutations on `<html>` — and bumps a tick to re-render so `getComputedStyle`
 * re-reads the now-current value. Native and SSR are no-ops (the guard returns
 * before touching `window`/`document`/`MutationObserver`, which don't exist
 * there); on native the `useColorScheme()` call in each hook already drives
 * re-renders.
 */
function useWebThemeChange(): void {
  const [, bump] = useState(0);
  // biome-ignore lint/plugin: subscribing to the OS media query + <html> class mutations is an external side effect — no derived state or RN event handler can replace a matchMedia/MutationObserver subscription
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const mq = globalThis.window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => bump((t) => t + 1);
    mq.addEventListener('change', onChange);
    const observer = new MutationObserver(onChange);
    // Only `class` flips theme tokens — observing every attribute would also
    // fire for unrelated <html> attribute writes (data-*, aria-*, dir, …).
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      mq.removeEventListener('change', onChange);
      observer.disconnect();
    };
  }, []);
}

// --- Web sRGB resolution ----------------------------------------------------
// tokens.css defines colours as oklch, which browsers render fine for static
// CSS / SVG props BUT Reanimated's colour parser cannot interpolate (it only
// understands sRGB hex/rgb/rgba/hsl — see react-native-reanimated/Colors). An
// animated `backgroundColor`/`color` set to an oklch value is silently dropped,
// so e.g. ActionFeedbackModal's morph vessel stays transparent and its glyph
// vanishes against the card. Resolve oklch (and any other non-sRGB CSS colour)
// to an sRGB string by rasterising it to a 1×1 <canvas> pixel and reading the
// pixel back via getImageData — the rasterised pixel is always sRGB, so the
// browser does the conversion regardless of how it serialises the colour. The
// same value then works for StyleSheet/SVG props AND Reanimated colour
// animations. Native already uses the sRGB LIGHT/DARK maps below, so this keeps
// web parity with native.
let pixelCtx: CanvasRenderingContext2D | null | undefined;
const srgbCache = new Map<string, string>();
// A colour no token uses, so we can tell whether the canvas accepted `color`
// (fillStyle moves off the sentinel) or rejected it (stays on the sentinel).
const SENTINEL = '#010203';
const NON_SRGB = /oklch|oklab|color\(/i;

function toSrgb(color: string): string {
  // Only non-sRGB notations need converting; pass hex/rgb/rgba/hsl/named through.
  if (!NON_SRGB.test(color)) return color;
  const cached = srgbCache.get(color);
  if (cached) return cached;
  if (pixelCtx === undefined)
    pixelCtx =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  let resolved = color;
  if (pixelCtx) {
    // fillStyle stays on SENTINEL if the browser rejects `color`; otherwise it
    // moves to the (normalised) accepted value — the signal that rasterising
    // will produce a meaningful pixel.
    pixelCtx.fillStyle = SENTINEL;
    pixelCtx.fillStyle = color;
    if (pixelCtx.fillStyle !== SENTINEL) {
      pixelCtx.clearRect(0, 0, 1, 1);
      pixelCtx.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, a = 0] = pixelCtx.getImageData(0, 0, 1, 1).data;
      resolved = a >= 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(4))})`;
    }
  }
  srgbCache.set(color, resolved);
  return resolved;
}

/**
 * Resolve a semantic token to a concrete color string at runtime.
 *
 * - **Web**: reads the CSS custom property (`--color-<token>`) from the document
 *   root via `getComputedStyle`, so it always reflects the active Tailwind theme
 *   (including any consumer `@theme` overrides). oklch values are resolved to
 *   sRGB (see `toSrgb`) so they're usable by Reanimated colour animations, which
 *   can't parse oklch. Re-renders when the theme changes — via the OS
 *   `prefers-color-scheme` media query or a manual `.dark`/`.light` class on
 *   `<html>` — so the value never goes stale on a theme toggle. Falls back to
 *   the static map during SSR when the DOM is unavailable.
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
  useWebThemeChange();

  if (Platform.OS !== 'web') return (scheme === 'dark' ? DARK : LIGHT)[token];

  // Web: read the live CSS custom property so consumer @theme overrides are
  // respected. Falls back to the static light-mode value during SSR.
  if (typeof document === 'undefined') return LIGHT[token];

  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim();
  return raw ? toSrgb(raw) : LIGHT[token];
}

/**
 * Snapshot of all token values for the current color scheme.
 *
 * Useful when multiple tokens are needed at once (avoids N separate
 * `getComputedStyle` calls on web).
 */
export function useThemeColors(): Record<ThemeToken, string> {
  const scheme = useColorScheme();
  useWebThemeChange();

  if (Platform.OS !== 'web') return scheme === 'dark' ? DARK : LIGHT;

  if (typeof document === 'undefined') return LIGHT;

  const style = getComputedStyle(document.documentElement);
  // biome-ignore lint/plugin: {} as Record<ThemeToken,string> is safe — we populate every key in the loop below
  const result = {} as Record<ThemeToken, string>;
  // biome-ignore lint/plugin: Object.keys(LIGHT) is exactly ThemeToken[] — LIGHT is typed Record<ThemeToken,string>
  for (const token of Object.keys(LIGHT) as ThemeToken[]) {
    const raw = style.getPropertyValue(`--color-${token}`).trim();
    result[token] = raw ? toSrgb(raw) : LIGHT[token];
  }
  return result;
}

export type { ThemeToken };
