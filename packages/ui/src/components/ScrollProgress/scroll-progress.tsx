import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Soft follow so the indicator trails the scroll smoothly instead of snapping.
const PROGRESS_SPRING = { stiffness: 120, damping: 30, mass: 0.6 };

interface CommonProps {
  /** A reanimated shared value in [0,1] tracking scroll progress. */
  progress: SharedValue<number>;
  /** Spring-smooth the value. Disabled automatically under reduced motion. */
  spring?: boolean;
  style?: StyleProp<ViewStyle>;
  color?: string;
  testID?: string;
}

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

export function ScrollProgress(props: ScrollProgressProps) {
  if (props.variant === 'circle') return <ScrollProgressCircle {...props} />;
  return <ScrollProgressBar {...props} />;
}

function useSmoothed(progress: SharedValue<number>, spring: boolean) {
  const reduce = useReducedMotion();
  return useDerivedValue(() => (spring && !reduce ? withSpring(progress.value, PROGRESS_SPRING) : progress.value));
}

function ScrollProgressBar({ progress, spring = true, height = 3, color = '#111111', style, testID }: ScrollProgressBarProps) {
  const value = useSmoothed(progress, spring);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0, Math.min(1, value.value)) }] }));
  return (
    <View testID={testID} style={[{ height, width: '100%', overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height, width: '100%', backgroundColor: color, transformOrigin: 'left' }, animatedStyle]} />
    </View>
  );
}

function ScrollProgressCircle({
  progress,
  spring = true,
  size = 40,
  thickness = 3,
  color = '#111111',
  style,
  testID,
}: ScrollProgressCircleProps) {
  const value = useSmoothed(progress, spring);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - Math.max(0, Math.min(1, value.value))),
  }));
  return (
    <View testID={testID} style={style}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
