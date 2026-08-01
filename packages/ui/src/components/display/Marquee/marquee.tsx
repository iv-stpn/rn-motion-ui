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
import { type Direction, useIsRTL } from '../../../hooks/use-direction';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';

/**
 * Whether the content travels toward increasing X (right) or Y (down).
 *
 * Only the logical values consult the writing direction; `left`/`right`/`up`/
 * `down` are physical by definition and stay put.
 */
function resolveReverse(direction: MarqueeDirection, isRTL: boolean): boolean {
  if (direction === 'start') return isRTL;
  if (direction === 'end') return !isRTL;
  return direction === 'right' || direction === 'down';
}

/**
 * Which way the content travels.
 *
 * `start` and `end` are relative to the writing direction — `start` moves
 * content toward the leading edge (left in LTR, right in RTL), which is the way
 * a ticker reads. `left`/`right` are physical and never flip; reach for them
 * when the motion is tied to something on screen rather than to the text.
 */
export type MarqueeDirection = 'start' | 'end' | 'left' | 'right' | 'up' | 'down';

export type MarqueeProps = {
  children: ReactNode;
  /** Scroll direction. @default 'start' */
  direction?: MarqueeDirection;
  /**
   * Overrides the ambient writing direction for the `start`/`end` resolution.
   * Rarely needed — the value from `DirectionProvider` (or the platform) is
   * normally right.
   */
  writingDirection?: Direction;
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
 */
export function Marquee({
  children,
  direction = 'start',
  writingDirection,
  speed = 20,
  gap = 16,
  className,
  style,
  testID,
}: MarqueeProps) {
  const reduce = useReducedMotion();
  const isRTL = useIsRTL(writingDirection);
  const vertical = direction === 'up' || direction === 'down';
  // `reverse` means "travels toward increasing X/Y". Under RTL the belt's own
  // flex row is mirrored by the platform, so the first track sits on the right
  // and travel has to mirror with it — otherwise the loop tears open a gap
  // instead of the duplicate track sliding in behind the first.
  const reverse = resolveReverse(direction, isRTL);
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
        {/* Second track fills the gap as the first scrolls away. It is the same
            content over again, so it is hidden from assistive technology —
            otherwise every logo, quote or headline in the marquee is announced
            twice. `aria-hidden` covers web; the two RN props cover iOS and
            Android, where the duplicate was previously read out in full. */}
        <View
          aria-hidden={true}
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: vertical ? 'column' : 'row', gap }}
        >
          {items.map((child, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static duplicated slots, order never mutates
            <View key={i}>{child}</View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
