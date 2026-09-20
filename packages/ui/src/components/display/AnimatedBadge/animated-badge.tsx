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
/** Corner radius (px) of the `rounded` shape — the pixel twin of `rounded-md`. */
const ROUNDED_RADIUS = 6;

const PULSE_STYLE = { position: 'absolute', inset: 0, pointerEvents: 'none' } as const;

export type AnimatedBadgeStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'loading';
export type AnimatedBadgeSize = 'sm' | 'md';
// biome-ignore lint/style/useExportsLast: this type alias is used directly by the cva constant below; moving it after inverts the natural dependency order
export type AnimatedBadgeShape = 'pill' | 'rounded';

// cva drives only the static container/label layout (height, padding, gap,
// radius). The badge is a solid filled plate — background *colour* animates on
// the root MotiView (see BADGE_BACKGROUND) — moti interpolates concrete colour
// values, not a className swap, so the colour lives there rather than here.
const container = cva('flex-row shrink-0 items-center overflow-hidden', {
  variants: {
    size: {
      sm: 'h-6 gap-1',
      md: 'h-7 gap-1',
    },
    shape: {
      pill: 'rounded-full',
      rounded: 'rounded-md',
    },
  },
  // A pill's fully-round ends eat horizontal space beside the label, so it
  // needs more padding than a rounded rectangle's tight corners. The rounded
  // inset reads the `--spacing-interactive-pad-*-tight` ramp — its two smallest
  // values — rather than a raw `px-1` / `px-1.5`.
  compoundVariants: [
    { size: 'sm', shape: 'pill', className: 'px-2' },
    { size: 'md', shape: 'pill', className: 'px-3' },
    { size: 'sm', shape: 'rounded', className: 'px-interactive-pad-tight-xs' },
    { size: 'md', shape: 'rounded', className: 'px-interactive-pad-tight-sm' },
  ],
  defaultVariants: { size: 'md', shape: 'pill' },
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
type BadgePulseProps = { color: string; radius: number };

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
function BadgePulse({ color, radius }: BadgePulseProps) {
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

  return <Animated.View style={[PULSE_STYLE, { backgroundColor: color, borderRadius: radius }, style]} />;
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
  /** Corner preset — `pill` (default) rounds to a full capsule, `rounded` a tight 6px corner. */
  shape?: AnimatedBadgeShape;
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
  shape = 'pill',
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
  // The pulse is a full-bleed halo clipped by `overflow-hidden`, so its corners
  // must follow the badge's — a full capsule for `pill`, the 6px corner for
  // `rounded` (999 rounds to a capsule at any scale, which the pill needs while
  // it breathes).
  const pulseRadius = shape === 'rounded' ? ROUNDED_RADIUS : 999;

  const Icon = ICONS[status];
  const contentKey = typeof children === 'string' || typeof children === 'number' ? String(children) : status;

  return (
    <MotiView
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      className={cn(container({ size, shape }), className)}
      style={style}
      animate={{ backgroundColor: BADGE_BACKGROUND[status] }}
      transition={{
        backgroundColor: { type: 'timing', duration: 300 },
      }}
    >
      {doPulse ? <BadgePulse color={ICON_COLOR[status]} radius={pulseRadius} /> : null}
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
