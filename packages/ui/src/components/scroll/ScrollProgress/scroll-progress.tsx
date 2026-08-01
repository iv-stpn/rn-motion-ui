import { useCallback, useState } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useThemeColor } from '../../../theme/use-theme-color';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Soft follow so the indicator trails the scroll smoothly instead of snapping.
const PROGRESS_SPRING = { stiffness: 120, damping: 30, mass: 0.6 };

/**
 * Granularity of the announced percentage. The bar itself is driven entirely on
 * the UI thread; this is the one value that has to cross back to JS, because
 * `accessibilityValue` is a render-time prop. Quantising to 5% keeps that to ~20
 * re-renders across a whole page instead of one per frame, and a screen reader
 * has no use for a finer reading than that anyway.
 */
const ANNOUNCE_STEP = 5;

type CommonProps = {
  /** A reanimated shared value in [0,1] tracking scroll progress. */
  progress: SharedValue<number>;
  /** Spring-smooth the value. Disabled automatically under reduced motion. */
  spring?: boolean;
  /** Additional NativeWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  color?: string;
  /**
   * Names the indicator for assistive technology.
   * @default 'Scroll progress'
   */
  accessibilityLabel?: string;
  testID?: string;
};

export interface ScrollProgressBarProps extends CommonProps {
  variant?: 'bar';
  /** Bar thickness in px. */
  height?: number;
}

export interface ScrollProgressCircleProps extends CommonProps {
  variant: 'circle';
  /** Diameter in px. */
  size?: number;
  /** Stroke width in px. */
  thickness?: number;
}

export type ScrollProgressProps = ScrollProgressBarProps | ScrollProgressCircleProps;

// biome-ignore lint/style/useExportsLast: component exported before useSmoothed helper — collocated for readability
export function ScrollProgress(props: ScrollProgressProps) {
  if (props.variant === 'circle') return <ScrollProgressCircle {...props} />;
  return <ScrollProgressBar {...props} />;
}

function useSmoothed(progress: SharedValue<number>, spring: boolean) {
  const reduce = useReducedMotion();
  return useDerivedValue(() => (spring && !reduce ? withSpring(progress.value, PROGRESS_SPRING) : progress.value));
}

/**
 * The a11y props for the indicator: a progressbar reporting whole percent,
 * mirrored off the shared value in `ANNOUNCE_STEP` increments.
 *
 * Reading the raw value would be one setState per animation frame, so the
 * reaction only crosses back to JS when the quantised bucket changes.
 */
function useProgressAccessibility(value: SharedValue<number>, label: string) {
  const [percent, setPercent] = useState(0);
  const commit = useCallback((next: number) => setPercent(next), []);

  useAnimatedReaction(
    () => {
      const clamped = Math.max(0, Math.min(1, value.value));
      return Math.round((clamped * 100) / ANNOUNCE_STEP) * ANNOUNCE_STEP;
    },
    (bucket: number, previous: number | null) => {
      if (bucket !== previous) scheduleOnRN(commit, bucket);
    },
  );

  // Both spellings on purpose. react-native-web does not understand React
  // Native's nested `accessibilityValue` object — it only forwards the flat
  // `aria-value*` props — so a native-only spelling reports nothing at all in a
  // browser, and vice versa.
  return {
    accessibilityRole: 'progressbar',
    accessibilityLabel: label,
    accessibilityValue: { min: 0, max: 100, now: percent, text: `${percent}%` },
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    'aria-valuenow': percent,
    'aria-valuetext': `${percent}%`,
  } as const;
}

function ScrollProgressBar({
  progress,
  spring = true,
  height = 3,
  color: colorProp,
  className,
  style,
  accessibilityLabel = 'Scroll progress',
  testID,
}: ScrollProgressBarProps) {
  const defaultColor = useThemeColor('foreground');
  const color = colorProp ?? defaultColor;
  const value = useSmoothed(progress, spring);
  const a11y = useProgressAccessibility(value, accessibilityLabel);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0, Math.min(1, value.value)) }] }));
  return (
    <View {...a11y} testID={testID} className={className} style={[{ height, width: '100%', overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height, width: '100%', backgroundColor: color, transformOrigin: 'left' }, animatedStyle]} />
    </View>
  );
}

function ScrollProgressCircle({
  progress,
  spring = true,
  size = 40,
  thickness = 3,
  color: colorProp,
  className,
  style,
  accessibilityLabel = 'Scroll progress',
  testID,
}: ScrollProgressCircleProps) {
  const defaultColor = useThemeColor('foreground');
  const color = colorProp ?? defaultColor;
  const value = useSmoothed(progress, spring);
  const a11y = useProgressAccessibility(value, accessibilityLabel);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.max(0, Math.min(1, value.value))),
  }));
  return (
    <View {...a11y} testID={testID} className={className} style={style}>
      {/* The SVG is the progressbar's rendering, not a separate image — the
          role and value live on the wrapper, so the arc stays out of the tree. */}
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden={true}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={thickness} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Start the arc at 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}
