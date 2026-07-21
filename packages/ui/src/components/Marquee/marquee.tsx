import { Children, type ReactNode, useCallback, useEffect, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';

export type MarqueeDirection = 'left' | 'right' | 'up' | 'down';

export type MarqueeProps = {
  children: ReactNode;
  /** Scroll direction. */
  direction?: MarqueeDirection;
  /** Seconds for one full loop of the content. */
  speed?: number;
  /** Gap between repeated items, in px. */
  gap?: number;
  /** Additional NativeWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Infinite marquee. Two identical tracks translate in lockstep; when the first
 * scrolls fully out, the animation resets seamlessly because the second has
 * taken its place. Reanimated drives the loop on the UI thread.
 *
 * RN fallback note: the web original used a CSS `mask-image` edge fade, which
 * has no RN equivalent — the effect is dropped here (content simply scrolls).
 */
export function Marquee({ children, direction = 'left', speed = 20, gap = 16, className, style, testID }: MarqueeProps) {
  const reduce = useReducedMotion();
  const vertical = direction === 'up' || direction === 'down';
  const reverse = direction === 'right' || direction === 'down';
  const [size, setSize] = useState(0);
  const offset = useSharedValue(0);
  const items = Children.toArray(children);

  // biome-ignore lint/plugin: Reanimated withRepeat loop must be started and cancelled as a side effect — not expressible as derived state
  useEffect(() => {
    if (!size || reduce) {
      offset.value = 0;
      return;
    }
    const distance = size + gap;
    const from = reverse ? -distance : 0;
    const to = reverse ? 0 : -distance;
    offset.value = from;
    offset.value = withRepeat(withTiming(to, { duration: speed * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(offset);
  }, [size, gap, speed, reverse, reduce, offset]);

  const animatedStyle = useAnimatedStyle(() =>
    vertical ? { transform: [{ translateY: offset.value }] } : { transform: [{ translateX: offset.value }] },
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setSize(vertical ? height : width);
    },
    [vertical],
  );

  return (
    <View testID={testID} style={[{ overflow: 'hidden' }, style]} className={cn('relative', className)}>
      <Animated.View style={[{ flexDirection: vertical ? 'column' : 'row', gap }, animatedStyle]}>
        <View onLayout={onLayout} style={{ flexDirection: vertical ? 'column' : 'row', gap }}>
          {items.map((child, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static duplicated slots, order never mutates
            <View key={i}>{child}</View>
          ))}
        </View>
        {/* Second track fills the gap as the first scrolls away. */}
        <View aria-hidden={true} style={{ flexDirection: vertical ? 'column' : 'row', gap }}>
          {items.map((child, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static duplicated slots, order never mutates
            <View key={i}>{child}</View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
