import { useEffect, useMemo, useState } from 'react';
import { Dimensions } from 'react-native';
import {
  type Breakpoint,
  type BreakpointOverrides,
  type BreakpointValue,
  breakpointForWidth,
  isWidthAtLeast,
  scaleSignature,
} from '../lib/breakpoints';

/**
 * Freezes an overrides object to its value identity, so an inline
 * `{{ md: 700 }}` prop — a new object every render — doesn't re-subscribe the
 * Dimensions listener on each pass.
 */
function useStableOverrides(overrides?: BreakpointOverrides): BreakpointOverrides | undefined {
  const signature = scaleSignature(overrides);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `signature` is the value-identity of `overrides` — depending on the object itself would defeat the memo
  return useMemo(() => overrides, [signature]);
}

/**
 * The current width breakpoint, without re-rendering on every dimension change.
 *
 * `useWindowDimensions` re-renders on each resize frame — dragging a browser
 * window edge across 200 px pushes ~200 renders through the whole subtree even
 * though the layout decision derived from it never changed. This subscribes to
 * the same `Dimensions` event but stores only the resolved breakpoint, so a
 * render happens exactly when the tier flips.
 *
 * Pass `overrides` to move individual edges of the default (Tailwind) scale;
 * an inline object literal is fine, the subscription keys off the resolved
 * values rather than object identity.
 *
 * ```tsx
 * const bp = useBreakpoint();                  // 'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
 * const bp = useBreakpoint({ md: 720 });       // same, with a narrower md edge
 * ```
 *
 * Use {@link useBreakpointAtLeast} when the component only needs one cutoff, and
 * `breakpointForWidth` from `rn-motion-ui/breakpoints` when the width comes from
 * a measured container instead of the window.
 */
export function useBreakpoint(overrides?: BreakpointOverrides): Breakpoint {
  const scale = useStableOverrides(overrides);
  const [breakpoint, setBreakpoint] = useState(() => breakpointForWidth(Dimensions.get('window').width, scale));

  // biome-ignore lint/plugin: Dimensions subscription lifecycle — setup/teardown is inherently an effect
  useEffect(() => {
    const apply = (width: number) => {
      const next = breakpointForWidth(width, scale);
      // Identity bail-out: React skips the re-render when the tier is unchanged,
      // which is the common case for a resize event.
      setBreakpoint((current) => (current === next ? current : next));
    };

    // The scale may have changed, and the window may have resized between the
    // initial state and this effect running.
    apply(Dimensions.get('window').width);

    const subscription = Dimensions.addEventListener('change', ({ window }) => apply(window.width));
    return () => subscription.remove();
  }, [scale]);

  return breakpoint;
}

/**
 * Whether the window is at least `value` wide — `'md'` (resolved against the
 * active scale) or a raw pixel number. Re-renders only when the answer flips,
 * so this is the cheapest way to drive a two-layout component.
 *
 * ```tsx
 * const isWideScreen = useBreakpointAtLeast('md');
 * ```
 */
export function useBreakpointAtLeast(value: BreakpointValue, overrides?: BreakpointOverrides): boolean {
  const scale = useStableOverrides(overrides);
  const [matches, setMatches] = useState(() => isWidthAtLeast(Dimensions.get('window').width, value, scale));

  // biome-ignore lint/plugin: Dimensions subscription lifecycle — setup/teardown is inherently an effect
  useEffect(() => {
    const apply = (width: number) => {
      const next = isWidthAtLeast(width, value, scale);
      setMatches((current) => (current === next ? current : next));
    };

    apply(Dimensions.get('window').width);

    const subscription = Dimensions.addEventListener('change', ({ window }) => apply(window.width));
    return () => subscription.remove();
  }, [value, scale]);

  return matches;
}
