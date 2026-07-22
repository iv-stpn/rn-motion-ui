import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { AlertTriangle, Check, Circle, Info, LoaderCircle, X } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { useThemeColors } from '../../theme/use-theme-color';

export type AnimatedBadgeStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'loading';
// biome-ignore lint/style/useExportsLast: these type aliases are used directly by the cva constants below; moving them after inverts the natural dependency order
export type AnimatedBadgeSize = 'sm' | 'md';

// cva drives only the static container/label layout (height, padding, gap,
// radius, border width). Background + border *colour* now animate on the root
// MotiView (see BADGE_BG / BADGE_BORDER) — moti interpolates concrete colour
// values, not a className swap, so the colours live there rather than here.
const container = cva('flex-row shrink-0 items-center overflow-hidden rounded-full border', {
  variants: {
    size: {
      sm: 'h-6 gap-1.5 px-2',
      md: 'h-8 gap-2 px-3',
    },
  },
  defaultVariants: { size: 'md' },
});

const labelClass = cva('font-medium', {
  variants: {
    status: {
      neutral: 'text-muted-foreground',
      info: 'text-primary',
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-destructive',
      loading: 'text-primary',
    },
    size: { sm: 'text-xs', md: 'text-xs' },
  },
  defaultVariants: { status: 'neutral', size: 'md' },
});

// Stroke colours resolve the semantic token to a concrete value for
// react-native-svg (SVG stroke can't read a Tailwind class). Chromatic
// variants (success/warning/danger) use their token directly; neutral/info/
// loading use the foreground/muted-foreground tokens so they invert in dark mode.
function useIconColor(colors: ReturnType<typeof useThemeColors>): Record<AnimatedBadgeStatus, string> {
  return {
    neutral: colors['muted-foreground'],
    info: colors.foreground,
    success: colors.success,
    warning: colors.warning,
    danger: colors.destructive,
    loading: colors.foreground,
  };
}

// Animated container fill colours. Chromatic bg values are fixed-hue rgba
// tints that look correct on both light and dark surfaces; neutral uses the
// `muted` token so it inverts properly.
// theme-exempt: chromatic tints are hue-locked to their semantic colour (success
// green, warning yellow, etc.) and work on any background without inversion.
function useBadgeBg(colors: ReturnType<typeof useThemeColors>): Record<AnimatedBadgeStatus, string> {
  return {
    neutral: colors.muted,
    info: 'rgba(17,17,17,0.10)' /* theme-exempt */,
    success: 'rgba(34,197,94,0.10)' /* theme-exempt */,
    warning: 'rgba(234,179,8,0.10)' /* theme-exempt */,
    danger: 'rgba(229,72,77,0.10)' /* theme-exempt */,
    loading: 'rgba(17,17,17,0.10)' /* theme-exempt */,
  };
}

// Animated border colours. Neutral uses the `border` token; chromatic variants
// keep fixed-hue rgba so they read on any surface.
// theme-exempt: same rationale as useBadgeBg — chromatic border tints are hue-locked.
function useBadgeBorder(colors: ReturnType<typeof useThemeColors>): Record<AnimatedBadgeStatus, string> {
  return {
    neutral: colors.border,
    info: 'rgba(17,17,17,0.30)' /* theme-exempt */,
    success: 'rgba(34,197,94,0.30)' /* theme-exempt */,
    warning: 'rgba(234,179,8,0.30)' /* theme-exempt */,
    danger: 'rgba(229,72,77,0.30)' /* theme-exempt */,
    loading: 'rgba(17,17,17,0.30)' /* theme-exempt */,
  };
}

type BadgeIconProps = { size: number; color: string };

const ICONS: Record<AnimatedBadgeStatus, (p: BadgeIconProps) => ReactNode> = {
  neutral: Circle,
  info: Info,
  success: Check,
  warning: AlertTriangle,
  danger: X,
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
  /** Additional NativeWind class names merged onto the outer badge. */
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
  const BADGE_BG = useBadgeBg(colors);
  const BADGE_BORDER = useBadgeBorder(colors);
  const s = status ?? 'neutral';
  const doPulse = (pulse ?? s === 'loading') && !reduce;
  const iconSize = size === 'sm' ? 12 : 14;
  const Icon = ICONS[s];
  const contentKey = typeof children === 'string' || typeof children === 'number' ? String(children) : s;

  return (
    <MotiView
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      className={cn(container({ size }), className)}
      style={style}
      animate={{ backgroundColor: BADGE_BG[s], borderColor: BADGE_BORDER[s] }}
      transition={{
        backgroundColor: { type: 'timing', duration: 300 },
        borderColor: { type: 'timing', duration: 300 },
      }}
    >
      {doPulse ? (
        <MotiView
          from={{ opacity: 0.08, scale: 0.94 }}
          animate={{ opacity: 0.16, scale: 1.08 }}
          transition={{ type: 'timing', duration: 800, loop: true, repeatReverse: true }}
          style={[
            { position: 'absolute', inset: 0, borderRadius: 999, backgroundColor: ICON_COLOR[s] },
            { pointerEvents: 'none' },
          ]}
        />
      ) : null}
      {showIcon ? (
        <View style={{ width: iconSize, height: iconSize, alignItems: 'center', justifyContent: 'center' }}>
          <AnimatePresence exitBeforeEnter={true}>
            <MotiView
              key={s}
              from={reduce ? { opacity: 0 } : { opacity: 0.7, translateY: 8, scale: 0.9 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.85 }}
              exitTransition={reduce ? { type: 'timing', duration: 0 } : { type: 'timing', duration: 160 }}
            >
              {s === 'loading' && !reduce && !icon ? (
                <MotiView
                  from={{ rotate: '0deg' }}
                  animate={{ rotate: '360deg' }}
                  transition={{ type: 'timing', duration: 1000, loop: true, repeatReverse: false }}
                >
                  <Icon size={iconSize} color={ICON_COLOR[s]} />
                </MotiView>
              ) : (
                (icon ?? <Icon size={iconSize} color={ICON_COLOR[s]} />)
              )}
            </MotiView>
          </AnimatePresence>
        </View>
      ) : null}
      {children === null ? null : (
        <View style={{ overflow: 'hidden' }}>
          <AnimatePresence exitBeforeEnter={true}>
            <MotiView
              key={contentKey}
              from={reduce ? { opacity: 0 } : { opacity: 0.76, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -10 }}
              transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.85 }}
              exitTransition={reduce ? { type: 'timing', duration: 0 } : { type: 'timing', duration: 160 }}
            >
              <Text className={labelClass({ status, size })}>{children}</Text>
            </MotiView>
          </AnimatePresence>
        </View>
      )}
    </MotiView>
  );
}
