// biome-ignore-all lint/style/noExcessiveLinesPerFile: all loader variants (spinner, dots, bars, dot-matrix, dither) collocated for consistent import

import { useEffect } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_IN_OUT } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { useThemeColor } from '../../../theme/use-theme-color';

export type LoaderVariant = 'spinner' | 'dots' | 'bars' | 'dot-matrix' | 'dither';

export type LoaderProps = {
  /** Which animation to render. */
  variant?: LoaderVariant;
  /** Base square size in px. Everything scales from this. */
  size?: number;
  /** Seconds per animation cycle. */
  speed?: number;
  /** Stroke/fill colour for the loader. */
  color?: string;
  /** Accessible label announced to screen readers. */
  label?: string;
  /** Additional UniWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// biome-ignore lint/style/useExportsLast: Loader exported before private PartProps and variant functions — collocated for readability
export function Loader({
  variant = 'spinner',
  size = 32,
  speed = 1,
  color: colorProp,
  label = 'Loading',
  className,
  style,
  testID,
}: LoaderProps) {
  const reduce = useReducedMotion();
  const defaultColor = useThemeColor('foreground');
  const color = colorProp ?? defaultColor;
  const shared = { size, speed, color, reduce };
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      testID={testID}
      className={cn('items-center justify-center', className)}
      style={[{ minWidth: size, minHeight: size }, style]}
    >
      {variant === 'spinner' && <Spinner {...shared} />}
      {variant === 'dots' && <Dots {...shared} />}
      {variant === 'bars' && <Bars {...shared} />}
      {variant === 'dot-matrix' && <DotMatrix {...shared} />}
      {variant === 'dither' && <Dither {...shared} />}
    </View>
  );
}

type PartProps = { size: number; speed: number; color: string; reduce: boolean };

function Spinner({ size, speed, color, reduce }: PartProps) {
  const stroke = Math.max(2, size * 0.09);
  const r = (size - stroke) / 2;
  const dur = speed * 1000;

  // Drive the rotation imperatively — same pattern as BadgeSpinner. MotiView's
  // declarative `loop` re-issues the animation on every parent re-render (theme
  // toggle, presence context churn), restarting mid-revolution; `Easing.linear`
  // keeps the speed constant through the repeat boundary so the arc never pauses.
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);

  // biome-ignore lint/plugin: Reanimated withRepeat loop must be started and cancelled as a side effect — not expressible as derived state
  useEffect(() => {
    if (reduce) {
      rotation.value = 0;
      opacity.value = withRepeat(withTiming(0.5, { duration: 700 }), -1, true);
      return () => cancelAnimation(opacity);
    }
    opacity.value = 1;
    rotation.value = withRepeat(withTiming(360, { duration: dur, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotation);
  }, [reduce, dur, rotation, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animatedStyle, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={stroke} />
        <Path
          d={`M ${size / 2} ${size / 2 - r} A ${r} ${r} 0 0 1 ${size / 2 + r} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

function Dot({ size, speed, color, reduce, index }: PartProps & { index: number }) {
  const dim = size * 0.24;
  const top = -size * 0.3;
  const half = speed * 500;
  // Drive the bounce with a raw Reanimated shared value whose `withRepeat` is
  // created ONCE (in this effect) — not via moti's declarative `loop`. moti
  // rebuilds its `withRepeat(withTiming(target))` on every worklet re-run, and
  // the Dot re-renders whenever an ancestor `<AnimatePresence>` churns its
  // presence context (theme toggle, parent state) — which bypasses React.memo,
  // since `useContext` always re-renders consumers. A rebuild that lands while
  // the dot sits at its translateY target leaves the repeat with zero forward
  // distance, freezing the dot at the top of the bounce ("one cycle then
  // stops"). Storing the animation in a shared value created once means
  // re-renders never cancel or rebuild it; the bounce runs indefinitely.
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.5);
  // biome-ignore lint/plugin: the loop animation is an imperative side-effect assigned to a shared value — not expressible as derived state, and must run once per [reduce,size,speed,index] rather than every render
  useEffect(() => {
    if (reduce) {
      translateY.value = 0;
      opacity.value = withRepeat(withTiming(1, { duration: half, easing: EASE_IN_OUT }), -1, true);
      return () => cancelAnimation(opacity);
    }
    opacity.value = withTiming(1, { duration: 240 });
    translateY.value = withDelay(
      index * speed * 160,
      withRepeat(withTiming(top, { duration: half, easing: EASE_IN_OUT }), -1, true),
    );
    // The `withRepeat` is owned by the shared value, so React unmounting the
    // Dot does NOT stop it (unlike a moti `loop`, which useAnimatedStyle tears
    // down). Cancel it here so a loader that unmounts mid-flight doesn't leave
    // an infinite animation driving `translateY` on the shared page forever —
    // same contract as Spinner.
    return () => cancelAnimation(translateY);
  }, [reduce, top, half, index, speed, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[animatedStyle, { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: color }]} />;
}

function Dots({ size, speed, color, reduce }: PartProps) {
  return (
    <View className="flex-row items-center" style={{ gap: size * 0.14 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} size={size} speed={speed} color={color} reduce={reduce} index={i} />
      ))}
    </View>
  );
}

function Bars({ size, speed, color, reduce }: PartProps) {
  const bar = size * 0.16;
  // Animate height (not scaleY): scaling would also squash the vertical
  // border-radius, flattening the round caps into ellipses. Driving height keeps
  // the caps true half-circles (radius = half width) at every bar height.
  const minH = size * 0.3;
  return (
    <View className="flex-row items-center" style={{ gap: size * 0.1, height: size }}>
      {[0, 1, 2, 3].map((i) => (
        <MotiView
          key={i}
          from={{ height: minH }}
          animate={reduce ? { height: size * 0.6 } : { height: size }}
          transition={{ type: 'timing', duration: speed * 500, loop: true, repeatReverse: true, delay: i * speed * 120 }}
          style={{ width: bar, borderRadius: bar / 2, backgroundColor: color }}
        />
      ))}
    </View>
  );
}

function DotMatrix({ size, speed, color, reduce }: PartProps) {
  const n = 3;
  const gap = size * 0.14;
  const dot = (size - gap * (n - 1)) / n;
  const cells = Array.from({ length: n * n }, (_, idx) => idx);
  return (
    <View className="flex-row flex-wrap" style={{ width: size, gap }}>
      {cells.map((idx) => {
        const x = idx % n;
        const y = Math.floor(idx / n);

        // Diagonal wave: cells light in order of their distance from the corner.
        const delay = ((x + y) / (2 * (n - 1))) * speed * 1000;
        return (
          <MotiView
            key={idx}
            from={{ opacity: 0.2, scale: 0.7 }}
            animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: speed * 500, loop: true, repeatReverse: true, delay }}
            style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }}
          />
        );
      })}
    </View>
  );
}

// Ordered Bayer 4x4 matrix — the classic dithering threshold pattern.
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function Dither({ size, speed, color, reduce }: PartProps) {
  const n = 4;
  const gap = Math.max(1, size * 0.05);
  const cell = (size - gap * (n - 1)) / n;
  return (
    <View className="flex-row flex-wrap" style={{ width: size, gap }}>
      {BAYER_4.map((order, idx) => (
        <MotiView
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed matrix cells, order never changes
          key={idx}
          from={{ opacity: 0.1 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1 }}
          transition={{
            type: 'timing',
            duration: speed * 500,
            loop: true,
            repeatReverse: true,
            delay: (order / BAYER_4.length) * speed * 1000,
          }}
          style={{ width: cell, height: cell, backgroundColor: color }}
        />
      ))}
    </View>
  );
}
