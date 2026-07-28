import { createContext, useContext, useState } from 'react';
import { I18nManager, Platform } from 'react-native';
import { useMountEffect } from './use-mount-effect';

export type Direction = 'ltr' | 'rtl';

/**
 * Set by `DirectionProvider` (its own module, so this one stays hook-only).
 * `null` means "nobody said", which falls through to the platform default.
 */
// biome-ignore lint/style/useExportsLast: the context is the seam between this module and direction-provider.tsx, so it belongs beside the hooks that read it
export const DirectionContext = createContext<Direction | null>(null);

/**
 * The ambient writing direction, read from wherever the platform keeps it.
 *
 * The two platforms disagree about where that is, and the disagreement is not
 * cosmetic:
 *
 * - **Native** reads `I18nManager.isRTL` — an app-wide flag fixed at launch
 *   (changing it requires a restart). React Native uses it to flip `row`
 *   layouts and to resolve `start`/`end` styles for you.
 * - **Web** has no such flag. `react-native-web`'s `I18nManager` is a stub
 *   whose `isRTL` is hard-coded `false` and whose `forceRTL` does nothing, so
 *   any code branching on it is silently LTR-only in every browser. Direction
 *   on the web comes from the `dir` attribute and CSS `direction`, applied per
 *   subtree rather than per app.
 *
 * So `I18nManager.isRTL` alone cannot be the library's answer.
 */
function platformDirection(): Direction {
  if (Platform.OS !== 'web') return I18nManager.isRTL ? 'rtl' : 'ltr';
  // Guarded for SSR, like the theme colour reads.
  if (typeof document === 'undefined') return 'ltr';
  const declared = document.documentElement.getAttribute('dir');
  if (declared === 'rtl' || declared === 'ltr') return declared;
  return getComputedStyle(document.documentElement).direction === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * The writing direction in effect: the nearest `DirectionProvider`, else the
 * platform default.
 *
 * Pass `override` to let a component take a `direction` prop that wins over
 * both — the escape hatch for a widget that is deliberately fixed, such as a
 * numeric axis or a code sample, inside an otherwise RTL page.
 *
 * Prefer `start`/`end` styles over `left`/`right` wherever the platform will do
 * the flipping for you. This hook is for what that cannot reach: animation
 * deltas, gesture math, and anything computed in a worklet, where the sign of a
 * translation has to be chosen explicitly.
 */
export function useDirection(override?: Direction): Direction {
  const fromContext = useContext(DirectionContext);
  // Read the DOM once on mount rather than during render: it keeps the first
  // paint deterministic (and SSR-safe), and re-reading every render would be a
  // layout-thrashing `getComputedStyle` per component.
  const [platform, setPlatform] = useState<Direction>('ltr');
  useMountEffect(() => setPlatform(platformDirection()));

  return override ?? fromContext ?? platform;
}

/** True when the ambient (or overridden) direction is right-to-left. */
export function useIsRTL(override?: Direction): boolean {
  return useDirection(override) === 'rtl';
}
