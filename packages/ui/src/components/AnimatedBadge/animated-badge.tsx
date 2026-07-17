import { cva, type VariantProps } from 'class-variance-authority';
import { AnimatePresence, MotiView } from 'moti';
import type { ReactNode } from 'react';
import { type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { AlertTriangle, Check, Circle, Info, LoaderCircle, X } from '../../lib/icons';

export type AnimatedBadgeStatus = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'loading';
// biome-ignore lint/style/useExportsLast: these type aliases are used directly by the cva constants below; moving them after inverts the natural dependency order
export type AnimatedBadgeSize = 'sm' | 'md';

// cva drives the static container/label styling; the icon/text roll swaps stay
// on MotiView + AnimatePresence (animated layer).
const container = cva('flex-row shrink-0 items-center overflow-hidden rounded-full border', {
  variants: {
    status: {
      neutral: 'border-border bg-card',
      info: 'border-primary/30 bg-primary/10',
      success: 'border-success/30 bg-success/10',
      warning: 'border-warning/30 bg-warning/10',
      danger: 'border-destructive/30 bg-destructive/10',
      loading: 'border-primary/30 bg-primary/10',
    },
    size: {
      sm: 'h-6 gap-1.5 px-2',
      md: 'h-8 gap-2 px-3',
    },
  },
  defaultVariants: { status: 'neutral', size: 'md' },
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

// Stroke colours resolve the semantic token to a concrete hex for react-native-svg
// (SVG stroke can't read a Tailwind class).
const ICON_COLOR: Record<AnimatedBadgeStatus, string> = {
  neutral: '#71717a',
  info: '#111111',
  success: '#3fa653',
  warning: '#d99a00',
  danger: '#e5484d',
  loading: '#111111',
};

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
  children?: ReactNode;
  /** Override the leading icon. */
  icon?: ReactNode;
  showIcon?: boolean;
  /** Soft pulse behind the badge (defaults on for `loading`). */
  pulse?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: AnimatedBadge renders pulse, icon swap, and label swap with reduce-motion and loading-spin variants — each branch is a distinct visual mode
export function AnimatedBadge({
  status = 'neutral',
  size = 'md',
  children,
  icon,
  showIcon = true,
  pulse,
  style,
  accessibilityLabel,
  testID,
}: AnimatedBadgeProps) {
  const reduce = useReducedMotion();
  const s = status ?? 'neutral';
  const doPulse = (pulse ?? s === 'loading') && !reduce;
  const iconSize = size === 'sm' ? 12 : 14;
  const Icon = ICONS[s];
  const contentKey = typeof children === 'string' || typeof children === 'number' ? String(children) : s;

  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="text"
      className={container({ status, size })}
      style={style}
    >
      {doPulse ? (
        <MotiView
          pointerEvents="none"
          from={{ opacity: 0.08, scale: 0.94 }}
          animate={{ opacity: 0.16, scale: 1.08 }}
          transition={{ type: 'timing', duration: 800, loop: true, repeatReverse: true }}
          style={{ position: 'absolute', inset: 0, borderRadius: 999, backgroundColor: ICON_COLOR[s] }}
        />
      ) : null}
      {showIcon ? (
        <View style={{ width: iconSize, height: iconSize, alignItems: 'center', justifyContent: 'center' }}>
          <AnimatePresence exitBeforeEnter={true}>
            <MotiView
              key={s}
              from={reduce ? { opacity: 0 } : { opacity: 0.7, translateY: 8, scale: 0.9 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0.5, translateY: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.85 }}
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
              exit={reduce ? { opacity: 0 } : { opacity: 0.5, translateY: -10 }}
              transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.85 }}
            >
              <Text className={labelClass({ status, size })}>{children}</Text>
            </MotiView>
          </AnimatePresence>
        </View>
      )}
    </View>
  );
}
