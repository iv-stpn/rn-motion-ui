import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { cssColorToSrgb, oklchToSrgb } from '../lib/color';

/**
 * The semantic color tokens exported by rn-motion-ui/tokens.css.
 *
 * Each key corresponds to a `--color-<token>` CSS custom property.
 *
 * Surfaces follow the cubby-ui elevation ladder: `surface-1` (the page)
 * through `surface-8`, plus the `surface-hover` / `surface-selected`
 * translucent state overlays. `surface-3` is the resting level for contained
 * content (cards, popovers, dialogs, inputs).
 *
 * Status tokens come in triads: the bare name (`success`, `warning`, `info`,
 * `danger`) is a soft plate background; `*-foreground` is legible text/icon
 * color on that plate or on any neutral surface; `*-border` is a matching
 * edge. `destructive` stays the vivid action color for destructive buttons.
 */
type ThemeToken =
  | 'surface-1'
  | 'surface-2'
  | 'surface-3'
  | 'surface-4'
  | 'surface-5'
  | 'surface-6'
  | 'surface-7'
  | 'surface-8'
  | 'surface-hover'
  | 'surface-selected'
  | 'foreground'
  | 'muted'
  | 'muted-foreground'
  | 'border'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'secondary-foreground'
  | 'accent'
  | 'accent-foreground'
  | 'destructive'
  | 'destructive-foreground'
  | 'success'
  | 'success-foreground'
  | 'success-border'
  | 'warning'
  | 'warning-foreground'
  | 'warning-border'
  | 'info'
  | 'info-foreground'
  | 'info-border'
  | 'danger'
  | 'danger-foreground'
  | 'danger-border';

/**
 * OKLCH definitions mirroring the tokens.css @theme block — [L, C, H, alpha?].
 *
 * These are the single native source of truth: the sRGB maps used on native
 * (and as the web SSR fallback) are derived from them at module load via
 * lib/color.ts, so there are no hand-converted hex values to drift out of
 * sync. Keep these tuples identical to the values in tokens.css whenever the
 * @theme block changes.
 */
type Oklch = readonly [number, number, number, number?];

const LIGHT_OKLCH: Record<ThemeToken, Oklch> = {
  'surface-1': [0.97, 0, 0],
  'surface-2': [0.985, 0, 0],
  'surface-3': [1, 0, 0],
  'surface-4': [1, 0, 0],
  'surface-5': [1, 0, 0],
  'surface-6': [1, 0, 0],
  'surface-7': [1, 0, 0],
  'surface-8': [1, 0, 0],
  'surface-hover': [0, 0, 0, 0.04],
  'surface-selected': [0, 0, 0, 0.08],
  foreground: [0.18, 0.004, 270],
  muted: [0.94, 0, 0],
  'muted-foreground': [0.5, 0.004, 270],
  border: [0, 0, 0, 0.1],
  primary: [0.22, 0, 0],
  'primary-foreground': [0.98, 0.002, 270],
  secondary: [0.92, 0, 0],
  'secondary-foreground': [0.32, 0.004, 270],
  accent: [0.91, 0, 0],
  'accent-foreground': [0.22, 0.004, 270],
  destructive: [0.53, 0.19, 25],
  'destructive-foreground': [0.98, 0.002, 270],
  success: [0.97, 0.04, 145],
  'success-foreground': [0.48, 0.18, 145],
  'success-border': [0.9, 0.1, 145],
  warning: [0.98, 0.06, 85],
  'warning-foreground': [0.58, 0.14, 85],
  'warning-border': [0.92, 0.1, 85],
  info: [0.97, 0.04, 250],
  'info-foreground': [0.45, 0.2, 250],
  'info-border': [0.9, 0.1, 250],
  danger: [0.97, 0.04, 25],
  'danger-foreground': [0.55, 0.18, 25],
  'danger-border': [0.9, 0.1, 25],
};

const DARK_OKLCH: Record<ThemeToken, Oklch> = {
  'surface-1': [0.205, 0.004, 270],
  'surface-2': [0.235, 0.004, 270],
  'surface-3': [0.264, 0.004, 270],
  'surface-4': [0.293, 0.004, 270],
  'surface-5': [0.321, 0.004, 270],
  'surface-6': [0.348, 0.004, 270],
  'surface-7': [0.375, 0.004, 270],
  'surface-8': [0.402, 0.004, 270],
  'surface-hover': [1, 0, 0, 0.04],
  'surface-selected': [1, 0, 0, 0.08],
  foreground: [0.94, 0.004, 270],
  muted: [0.24, 0.004, 270],
  'muted-foreground': [0.73, 0.004, 270],
  border: [1, 0, 0, 0.1],
  primary: [0.95, 0.004, 270],
  'primary-foreground': [0.13, 0.004, 270],
  secondary: [0.35, 0.004, 270],
  'secondary-foreground': [0.94, 0.004, 270],
  accent: [0.31, 0.004, 270],
  'accent-foreground': [0.95, 0.004, 270],
  destructive: [0.5, 0.22, 25],
  'destructive-foreground': [1, 0, 0],
  success: [0.26, 0.07, 145],
  'success-foreground': [0.72, 0.15, 145],
  'success-border': [0.36, 0.11, 145],
  warning: [0.28, 0.06, 85],
  'warning-foreground': [0.78, 0.12, 85],
  'warning-border': [0.38, 0.09, 85],
  info: [0.26, 0.07, 250],
  'info-foreground': [0.72, 0.16, 250],
  'info-border': [0.36, 0.11, 250],
  danger: [0.26, 0.07, 25],
  'danger-foreground': [0.75, 0.15, 25],
  'danger-border': [0.36, 0.11, 25],
};

/** Resolve an OKLCH definition table to concrete sRGB strings. */
function buildSrgbMap(source: Record<ThemeToken, Oklch>): Record<ThemeToken, string> {
  // biome-ignore lint/plugin: {} as Record<ThemeToken,string> is safe — the loop below populates every key of the fully-typed source table
  const map = {} as Record<ThemeToken, string>;
  // biome-ignore lint/plugin: Object.entries over a Record<ThemeToken, Oklch> yields exactly the ThemeToken keys
  for (const [token, [lightness, chroma, hue, alpha]] of Object.entries(source) as [ThemeToken, Oklch][]) {
    map[token] = oklchToSrgb(lightness, chroma, hue, alpha);
  }
  return map;
}

// Static maps — used on native (where CSS vars are unavailable) and as the web
// SSR fallback. React Native only accepts sRGB color formats, so the oklch
// definitions are converted once at module load.
const LIGHT: Record<ThemeToken, string> = buildSrgbMap(LIGHT_OKLCH);
const DARK: Record<ThemeToken, string> = buildSrgbMap(DARK_OKLCH);

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

/**
 * Resolve a semantic token to a concrete color string at runtime.
 *
 * - **Web**: reads the CSS custom property (`--color-<token>`) from the document
 *   root via `getComputedStyle`, so it always reflects the active Tailwind theme
 *   (including any consumer `@theme` overrides). oklch values are resolved to
 *   sRGB via the pure formula in lib/color.ts so they're usable by Reanimated
 *   colour animations, which can't parse oklch. Re-renders when the theme
 *   changes — via the OS `prefers-color-scheme` media query or a manual
 *   `.dark`/`.light` class on `<html>` — so the value never goes stale on a
 *   theme toggle. Falls back to the static map during SSR when the DOM is
 *   unavailable.
 * - **Native**: uses `useColorScheme()` to pick between the light/dark static
 *   maps derived from the same oklch definitions. No provider or setup required.
 *
 * @example
 * // Pass resolved color to a Reanimated worklet:
 * const spinnerColor = useThemeColor('primary');
 * const style = useAnimatedStyle(() => ({ borderColor: spinnerColor }));
 *
 * @example
 * // Pass resolved color to a react-native-svg prop:
 * const fill = useThemeColor('success-foreground');
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
  return raw ? cssColorToSrgb(raw) : LIGHT[token];
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
    result[token] = raw ? cssColorToSrgb(raw) : LIGHT[token];
  }
  return result;
}

export type { ThemeToken };
