import { cva, type VariantProps } from 'class-variance-authority';
import { type ReactNode, useEffect } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AlertLine as AlertTriangle } from 'rn-motion-ui-icons/icons/alert-line';
import { CheckLine as Check } from 'rn-motion-ui-icons/icons/check-line';
import { InformationLine as AlertCircle, InformationLine as Info } from 'rn-motion-ui-icons/icons/information-line';
import { LoadingLine as LoaderCircle } from 'rn-motion-ui-icons/icons/loading-line';
import { RoundLine as Circle } from 'rn-motion-ui-icons/icons/round-line';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { TIMING_INSTANT } from '../../../theme/motion';
import { useThemeColors } from '../../../theme/use-theme-color';
import { Text } from '../../typography/Text/text';

/** One full revolution of the loading spinner. */
const SPIN_DURATION_MS = 1000;
/** Degrees per revolution — the loop restarts from 0, which is the same pose. */
const SPIN_TO_DEG = 360;
/** Half a pulse — the ping-pong doubles it into a full breathe cycle. */
const PULSE_DURATION_MS = 800;
// cubic-bezier(0.4, 0, 0.6, 1) — Tailwind's `animate-pulse` easing, same as Skeleton.
const PULSE_EASING = Easing.bezier(0.4, 0, 0.6, 1);
const PULSE_OPACITY_FROM = 0.08;
const PULSE_OPACITY_TO = 0.16;
const PULSE_SCALE_FROM = 0.94;
const PULSE_SCALE_TO = 1.08;

const PULSE_STYLE = { position: 'absolute', inset: 0, borderRadius: 999, pointerEvents: 'none' } as const;

export type AnimatedBadgeStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'loading';
// biome-ignore lint/style/useExportsLast: these type aliases are used directly by the cva constants below; moving them after inverts the natural dependency order
export type AnimatedBadgeSize = 'sm' | 'md';

// cva drives only the static container/label layout (height, padding, gap,
// radius). The badge is a solid filled plate — background *colour* animates on
// the root MotiView (see BADGE_BACKGROUND) — moti interpolates concrete colour
// values, not a className swap, so the colour lives there rather than here.
const container = cva('flex-row shrink-0 items-center overflow-hidden rounded-full', {
  variants: {
    size: {
      sm: 'h-6 gap-1 px-2',
      md: 'h-7 gap-1 px-3',
    },
  },
  defaultVariants: { size: 'md' },
});

const labelClass = cva('', {
  variants: {
    status: {
      neutral: 'text-muted-foreground',
      info: 'text-info-foreground',
      success: 'text-success-foreground',
      warning: 'text-warning-foreground',
      danger: 'text-danger-foreground',
      loading: 'text-primary',
    },
    size: { sm: 'text-xs', md: 'text-xs' },
  },
  defaultVariants: { status: 'neutral', size: 'md' },
});

// Stroke colours resolve the semantic token to a concrete value for
// react-native-svg (SVG stroke can't read a Tailwind class). Status variants
// use their `*-foreground` pair partner — white, for legibility on the vivid
// filled status plate in both themes; neutral/loading use the muted-foreground/
// foreground tokens so they invert in dark mode.
function useIconColor(colors: ReturnType<typeof useThemeColors>): Record<AnimatedBadgeStatus, string> {
  return {
    neutral: colors['muted-foreground'],
    info: colors['info-foreground'],
    success: colors['success-foreground'],
    warning: colors['warning-foreground'],
    danger: colors['danger-foreground'],
    loading: colors.foreground,
  };
}

// Animated container fill colours — the vivid filled status plates. moti
// interpolates concrete colour values (not className swaps), so the resolved
// token strings feed the animation directly and still track light/dark because
// useThemeColors() re-resolves on theme change.
function useBadgeBackground(colors: ReturnType<typeof useThemeColors>): Record<AnimatedBadgeStatus, string> {
  return {
    neutral: colors.muted,
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    loading: colors.muted,
  };
}

type BadgeSpinnerProps = { children: ReactNode };
type BadgePulseProps = { color: string };

/**
 * Continuous 0°→360° rotation, driven imperatively.
 *
 * This deliberately does *not* use MotiView's `animate`/`loop` transition. Moti
 * resolves its pose inside a `useAnimatedStyle` whose dependencies include the
 * `animate` object, and that object is a fresh literal on every render — so any
 * parent re-render (a status change, an interval tick, a theme swap) re-ran the
 * worklet and re-issued `withTiming(360deg)` *from the current angle*. The spin
 * restarted mid-revolution and took the full duration to cover the remaining
 * arc, which read as a stutter and a speed change rather than one steady spin.
 *
 * A shared value started once in an effect is immune to that: the loop lives on
 * the UI thread and re-renders never touch it. `Easing.linear` is the other half
 * — `withTiming` defaults to `Easing.inOut(Easing.quad)`, which eases to a stop
 * at each revolution boundary, so even an uninterrupted loop visibly paused
 * once per turn. Mirrors the TextShimmer loop.
 */
function BadgeSpinner({ children }: BadgeSpinnerProps) {
  const angle = useSharedValue(0);

  // biome-ignore lint/plugin: Reanimated withRepeat loop must be started and cancelled as a side effect — not expressible as derived state
  useEffect(() => {
    angle.value = 0;
    angle.value = withRepeat(withTiming(SPIN_TO_DEG, { duration: SPIN_DURATION_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(angle);
  }, [angle]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * The soft halo behind a loading badge. Imperative for the same reason as
 * BadgeSpinner — a re-render restarted the ping-pong from wherever it had got
 * to, so the breathing lost its rhythm. One shared value drives both opacity and
 * scale, which also keeps them exactly in phase: the declarative version left
 * them as two independent properties, and moti defaults `scale` to spring while
 * `opacity` is timing, so they drifted apart as they looped.
 */
function BadgePulse({ color }: BadgePulseProps) {
  const progress = useSharedValue(0);

  // biome-ignore lint/plugin: Reanimated withRepeat loop must be started and cancelled as a side effect — not expressible as derived state
  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: PULSE_DURATION_MS, easing: PULSE_EASING }), -1, true);
    return () => cancelAnimation(progress);
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: PULSE_OPACITY_FROM + (PULSE_OPACITY_TO - PULSE_OPACITY_FROM) * progress.value,
    transform: [{ scale: PULSE_SCALE_FROM + (PULSE_SCALE_TO - PULSE_SCALE_FROM) * progress.value }],
  }));

  return <Animated.View style={[PULSE_STYLE, { backgroundColor: color }, style]} />;
}

type BadgeIconProps = { size: number; color: string };

const ICONS: Record<AnimatedBadgeStatus, (p: BadgeIconProps) => ReactNode> = {
  neutral: Circle,
  info: Info,
  success: Check,
  warning: AlertTriangle,
  danger: AlertCircle,
  loading: LoaderCircle,
};

export interface AnimatedBadgeProps extends VariantProps<typeof container> {
  status?: AnimatedBadgeStatus;
  children?: ReactNode;
  /** Override the leading icon. */
  icon?: ReactNode;
  showIcon?: boolean;
  /** Soft pulse behind the badge (defaults on for `loading`). */
  pulse?: boolean;
  /** Additional UniWind class names merged onto the outer badge. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function AnimatedBadge({
  status = 'neutral',
  size = 'md',
  children,
  icon,
  showIcon = true,
  pulse,
  className,
  style,
  accessibilityLabel,
  testID,
}: AnimatedBadgeProps) {
  const reduce = useReducedMotion();
  const colors = useThemeColors();

  const ICON_COLOR = useIconColor(colors);
  const BADGE_BACKGROUND = useBadgeBackground(colors);

  const doPulse = (pulse ?? status === 'loading') && !reduce;
  const iconSize = size === 'sm' ? 14 : 16;

  const Icon = ICONS[status];
  const contentKey = typeof children === 'string' || typeof children === 'number' ? String(children) : status;

  return (
    <MotiView
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      className={cn(container({ size }), className)}
      style={style}
      animate={{ backgroundColor: BADGE_BACKGROUND[status] }}
      transition={{
        backgroundColor: { type: 'timing', duration: 300 },
      }}
    >
      {doPulse ? <BadgePulse color={ICON_COLOR[status]} /> : null}
      {showIcon ? (
        <View className="items-center justify-center" style={{ width: iconSize, height: iconSize }}>
          <AnimatePresence exitBeforeEnter={true}>
            <MotiView
              key={status}
              from={reduce ? { opacity: 0 } : { opacity: 0.7, translateY: 8, scale: 0.9 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.85 }}
              exitTransition={reduce ? TIMING_INSTANT : { type: 'timing', duration: 160 }}
            >
              {status === 'loading' && !reduce && !icon ? (
                <BadgeSpinner>
                  <Icon size={iconSize} color={ICON_COLOR[status]} />
                </BadgeSpinner>
              ) : (
                (icon ?? <Icon size={iconSize} color={ICON_COLOR[status]} />)
              )}
            </MotiView>
          </AnimatePresence>
        </View>
      ) : null}
      {children === null ? null : (
        <View className="overflow-hidden">
          <AnimatePresence exitBeforeEnter={true}>
            <MotiView
              key={contentKey}
              from={reduce ? { opacity: 0 } : { opacity: 0.76, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -10 }}
              transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.85 }}
              exitTransition={reduce ? TIMING_INSTANT : { type: 'timing', duration: 160 }}
            >
              <Text weight="medium" className={labelClass({ status, size })}>
                {children}
              </Text>
            </MotiView>
          </AnimatePresence>
        </View>
      )}
    </MotiView>
  );
}
