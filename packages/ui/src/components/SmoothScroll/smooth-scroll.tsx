import { useReducedMotion } from '@rn-motion-ui/hooks/use-reduced-motion';
import { createContext, type ReactNode, type RefObject, useCallback, useContext, useMemo, useRef } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';

export type ScrollToOptions = {
  /** Extra px offset from the target (e.g. to clear a sticky header). */
  offset?: number;
  /** Jump instantly rather than animating. */
  immediate?: boolean;
};

// biome-ignore lint/style/useExportsLast: API type before SmoothScrollContext constant — collocated for readability
export type SmoothScrollApi = {
  /** Ref of the underlying ScrollView; drive it imperatively if needed. */
  scrollRef: RefObject<ScrollView | null>;
  /** Live scroll offset in px along the scroll axis. */
  scrollY: SharedValue<number>;
  /** Scroll position as 0..1 of the scrollable length. */
  progress: SharedValue<number>;
  /** Programmatic scroll. Respects reduced motion (jumps instantly). */
  scrollTo: (target: number, options?: ScrollToOptions) => void;
};

const SmoothScrollContext = createContext<SmoothScrollApi | null>(null);

export type SmoothScrollProps = {
  children: ReactNode;
  orientation?: 'vertical' | 'horizontal';
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A scroll container that exposes its live scroll state (offset + 0..1 progress)
 * and a programmatic `scrollTo` to descendants via context, and to any callers
 * of {@link useSmoothScroll}.
 *
 * RN adaptation: the web original wrapped Lenis for buttery wheel/lerp smoothing.
 * RN has excellent native momentum scrolling, so there is no Lenis equivalent —
 * the `lerp`/`duration`/`wheelMultiplier`/`touch` knobs are dropped and the OS
 * drives the physics. The scroll-state API (scrollY/progress/scrollTo) is
 * preserved so scroll-driven children (ScrollReveal, ScrollProgress)
 * keep working.
 */
export function SmoothScroll({ children, orientation = 'vertical', style, contentContainerStyle, testID }: SmoothScrollProps) {
  const reduce = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useSharedValue(0);
  const progress = useSharedValue(0);
  const horizontal = orientation === 'horizontal';

  // Writing shared values from the JS thread is valid (no worklet needed), so a
  // plain onScroll keeps this renderable in web story tests.
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentSize, layoutMeasurement, contentOffset } = e.nativeEvent;
      const offset = horizontal ? contentOffset.x : contentOffset.y;
      const max = horizontal ? contentSize.width - layoutMeasurement.width : contentSize.height - layoutMeasurement.height;
      scrollY.value = offset;
      progress.value = max > 0 ? offset / max : 0;
    },
    [horizontal, scrollY, progress],
  );

  const scrollTo = useCallback(
    (target: number, options?: ScrollToOptions) => {
      const to = target + (options?.offset ?? 0);
      const animated = !(reduce || options?.immediate);
      scrollRef.current?.scrollTo(horizontal ? { x: to, animated } : { y: to, animated });
    },
    [reduce, horizontal],
  );

  const api = useMemo<SmoothScrollApi>(() => ({ scrollRef, scrollY, progress, scrollTo }), [scrollY, progress, scrollTo]);

  return (
    <SmoothScrollContext.Provider value={api}>
      <ScrollView
        ref={scrollRef}
        testID={testID}
        horizontal={horizontal}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={style}
        contentContainerStyle={contentContainerStyle}
      >
        {children}
      </ScrollView>
    </SmoothScrollContext.Provider>
  );
}

/**
 * Read the enclosing <SmoothScroll> state. Throws when used outside a provider
 * (unlike the web version, RN has no window-level scroll to fall back to).
 */
// biome-ignore lint/style/useComponentExportOnlyModules: useSmoothScroll is the public API for this component; splitting it into a separate file would break the co-location of context + hook + component
export function useSmoothScroll(): SmoothScrollApi {
  const ctx = useContext(SmoothScrollContext);
  if (!ctx) throw new Error('useSmoothScroll must be used inside <SmoothScroll>');
  return ctx;
}
