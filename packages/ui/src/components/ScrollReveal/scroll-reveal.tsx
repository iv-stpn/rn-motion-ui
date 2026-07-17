import { type ReactNode, useCallback } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

export type ScrollRevealProps = {
  children: ReactNode;
  /** Scroll offset (px) of the enclosing scroll area — a reanimated shared value. */
  scrollY: SharedValue<number>;
  /** Visible height (px) of the scroll area; used to know when the element enters view. */
  viewportHeight: number;
  /** Slide distance in px before reveal. */
  y?: number;
  /**
   * Portion of the way up the viewport at which the element is fully revealed.
   * 0.3 (default) = revealed once its top has travelled 30% up from the bottom edge.
   */
  amount?: number;
  /** Reveal only once (default) or every time it re-enters view. */
  once?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Reveals its child (fade + slide up) as it scrolls into the viewport, driven by
 * the enclosing scroll area's offset.
 *
 * RN adaptation: the web original used framer's `useInView` (IntersectionObserver)
 * plus a CSS `blur()` filter. RN has neither, so reveal is scrubbed from the parent
 * scroll offset via `interpolate`, and the enter-blur is dropped (opacity + slide
 * only). Pass the parent ScrollView's live offset as `scrollY` and its height as
 * `viewportHeight`. The component must be a direct child of the scrolled content so
 * its `onLayout` y is measured in the same coordinate space as `scrollY`.
 */
export function ScrollReveal({
  children,
  scrollY,
  viewportHeight,
  y = 16,
  amount = 0.3,
  once = true,
  style,
  testID,
}: ScrollRevealProps) {
  const reduce = useReducedMotion();
  const layoutY = useSharedValue(0);
  const measured = useSharedValue(false);
  const latched = useSharedValue(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      layoutY.value = e.nativeEvent.layout.y;
      measured.value = true;
    },
    [layoutY, measured],
  );

  // progress 0→1 as the element's top rises from the viewport bottom to `amount`.
  const progress = useDerivedValue(() => {
    if (!measured.value) return latched.value;
    const top = layoutY.value - scrollY.value; // element top relative to viewport
    const enter = viewportHeight;
    const done = viewportHeight * (1 - amount);
    const p = interpolate(top, [enter, done], [0, 1], Extrapolation.CLAMP);
    if (once) {
      if (p > latched.value) latched.value = p;
      return latched.value;
    }
    return p;
  });

  const animatedStyle = useAnimatedStyle(() =>
    reduce
      ? { opacity: progress.value }
      : {
          opacity: progress.value,
          transform: [{ translateY: interpolate(progress.value, [0, 1], [y, 0]) }],
        },
  );

  return (
    <Animated.View testID={testID} onLayout={onLayout} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
