import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { AlertTriangle, Check, Circle, Info, LoaderCircle, X } from '../../lib/icons';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { useThemeColors } from '../../theme/use-theme-color';
import { Text } from '../Text/text';

export type AnimatedBadgeStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'loading';
// biome-ignore lint/style/useExportsLast: these type aliases are used directly by the cva constants below; moving them after inverts the natural dependency order
export type AnimatedBadgeSize = 'sm' | 'md';

// cva drives only the static container/label layout (height, padding, gap,
// radius, border width). Background + border *colour* now animate on the root
// MotiView (see BADGE_BACKGROUND / BADGE_BORDER) — moti interpolates concrete colour
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
// use their `*-foreground` triad partner — tuned for legibility on the soft
// status plate in both themes; neutral/loading use the muted-foreground/
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

// Animated container fill colours — the soft status plates from the token
// triads. moti interpolates concrete colour values (not className swaps), so
// the resolved token strings feed the animation directly and still track
// light/dark because useThemeColors() re-resolves on theme change.
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

// Animated border colours — the `*-border` member of each status triad;
// neutral/loading use the shared hairline `border` token.
function useBadgeBorder(colors: ReturnType<typeof useThemeColors>): Record<AnimatedBadgeStatus, string> {
  return {
    neutral: colors.border,
    info: colors['info-border'],
    success: colors['success-border'],
    warning: colors['warning-border'],
    danger: colors['danger-border'],
    loading: colors.border,
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
  const BADGE_BACKGROUND = useBadgeBackground(colors);
  const BADGE_BORDER = useBadgeBorder(colors);

  const doPulse = (pulse ?? status === 'loading') && !reduce;
  const iconSize = size === 'sm' ? 12 : 14;

  const Icon = ICONS[status];
  const contentKey = typeof children === 'string' || typeof children === 'number' ? String(children) : status;

  return (
    <MotiView
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      className={cn(container({ size }), className)}
      style={style}
      animate={{ backgroundColor: BADGE_BACKGROUND[status], borderColor: BADGE_BORDER[status] }}
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
            { position: 'absolute', inset: 0, borderRadius: 999, backgroundColor: ICON_COLOR[status] },
            { pointerEvents: 'none' },
          ]}
        />
      ) : null}
      {showIcon ? (
        <View style={{ width: iconSize, height: iconSize, alignItems: 'center', justifyContent: 'center' }}>
          <AnimatePresence exitBeforeEnter={true}>
            <MotiView
              key={status}
              from={reduce ? { opacity: 0 } : { opacity: 0.7, translateY: 8, scale: 0.9 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.85 }}
              exitTransition={reduce ? { type: 'timing', duration: 0 } : { type: 'timing', duration: 160 }}
            >
              {status === 'loading' && !reduce && !icon ? (
                <MotiView
                  from={{ rotate: '0deg' }}
                  animate={{ rotate: '360deg' }}
                  transition={{ type: 'timing', duration: 1000, loop: true, repeatReverse: false }}
                >
                  <Icon size={iconSize} color={ICON_COLOR[status]} />
                </MotiView>
              ) : (
                (icon ?? <Icon size={iconSize} color={ICON_COLOR[status]} />)
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
