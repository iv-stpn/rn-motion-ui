import type { ThemeToken } from 'rn-motion-ui/theme/use-theme-color';
import { useThemeColors } from 'rn-motion-ui/theme/use-theme-color';

/**
 * Resolves the `color` prop of an icon to a concrete sRGB string.
 *
 * - `undefined`      → the `foreground` theme token (the default)
 * - A `ThemeToken`   → the live resolved theme color; updates on scheme change
 * - Any other string → returned as-is (hex, rgb, named CSS color, …)
 *
 * Calling `useThemeColors()` once per render is fine: the hook is a single
 * `getComputedStyle` pass on web and a direct map lookup on native, and it
 * already drives its own re-renders via `useColorScheme` + the web
 * MutationObserver subscription inside the hook.
 */
/** Type guard: true iff `key` is an own property of the token map. */
function isThemeToken(key: string, colors: Record<ThemeToken, string>): key is ThemeToken {
  return Object.hasOwn(colors, key);
}

export function useIconColor(colorProp: ThemeToken | (string & {}) | undefined): string {
  const themeColors = useThemeColors();
  if (colorProp === undefined) return themeColors.foreground;
  if (isThemeToken(colorProp, themeColors)) return themeColors[colorProp];
  return colorProp;
}
