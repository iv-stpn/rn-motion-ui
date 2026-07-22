import { cva, type VariantProps } from 'class-variance-authority';
import { Children, isValidElement, type ReactNode, useCallback, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { MotiView } from '../../moti/components/view';
import { MOTION_SNAPPY, type MotiTransitionProp, mergeTransition, TIMING_BASE } from '../../theme/motion';
import { useThemeColors } from '../../theme/use-theme-color';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'destructive'
  | 'outlineDanger'
  | 'ghostDanger'
  | 'ghostPrimary';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
// biome-ignore lint/style/useExportsLast: types collocated with sibling ButtonVariant / ButtonSize exports for readability
export type ButtonShape = 'rounded' | 'pill';

// cva drives the STATIC styling layer (per the conversion spec). Animated/tap
// scale stays inline on the MotiView. Class strings are static literals so the
// Tailwind/uniwind scanner picks them up.
const container = cva('flex-row items-center justify-center', {
  variants: {
    variant: {
      primary: 'bg-primary',
      secondary: 'border border-border bg-card',
      ghost: 'bg-transparent',
      outline: 'border border-border bg-transparent',
      destructive: 'bg-destructive',
      outlineDanger: 'border border-destructive bg-transparent',
      ghostDanger: 'bg-transparent',
      ghostPrimary: 'bg-transparent',
    },
    size: {
      sm: 'h-8 px-3 gap-1.5',
      md: 'h-10 px-5 gap-2',
      lg: 'h-12 px-6 gap-2',
      icon: 'h-8 w-8',
    },
    shape: {
      rounded: 'rounded-xl',
      pill: 'rounded-full',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md', shape: 'rounded' },
});

// biome-ignore lint/style/useComponentExportOnlyModules: label cva is a styling utility consumed by StatefulButton in the same component family; splitting to a separate file would fragment tightly-coupled button styles
export const label = cva('font-medium', {
  variants: {
    variant: {
      primary: 'text-primary-foreground',
      secondary: 'text-foreground',
      ghost: 'text-muted-foreground',
      outline: 'text-foreground',
      destructive: 'text-white',
      outlineDanger: 'text-destructive',
      ghostDanger: 'text-destructive',
      ghostPrimary: 'text-primary',
    },
    size: { sm: 'text-xs', md: 'text-sm', lg: 'text-base', icon: 'text-sm' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

// Spinner stroke matches the label colour so it reads on every variant.
function buildSpinnerColor(variant: ButtonVariant, colors: ReturnType<typeof useThemeColors>): string {
  switch (variant) {
    case 'primary':
    case 'destructive':
      return colors['primary-foreground'];
    case 'outlineDanger':
    case 'ghostDanger':
      return colors.destructive;
    default:
      return colors.foreground;
  }
}

export interface ButtonProps extends VariantProps<typeof container> {
  children?: ReactNode;
  /** Node rendered to the left of the button label. */
  leftAdornment?: ReactNode;
  /** Node rendered to the right of the button label. */
  rightAdornment?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Spawn a Material-style ripple from the press point. Off by default. */
  ripple?: boolean;
  /** Scale the button settles to while pressed. */
  pressScale?: number;
  /** When true, skip the 0.5 opacity applied to disabled buttons. */
  noDisabledOpacity?: boolean;
  /** Colour shown as an absolutely-positioned overlay behind the button content. */
  backdropColor?: string;
  /**
   * Override the press-scale spring. Partial — only the fields you pass are changed.
   * Default: `MOTION_SNAPPY` (stiffness 500, damping 30, mass 0.6).
   */
  pressTransition?: Partial<MotiTransitionProp>;
  /** Stretch the button to fill its container width. */
  fitWidth?: boolean;
  /** Additional NativeWind class names merged onto the outer wrapper. */
  className?: string;
  /** Additional class names merged onto the label Text. */
  labelClassName?: string;
  /** Extra inline style applied directly to the Pressable container. */
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

type Ripple = { id: number; x: number; y: number; size: number };

function renderChild(child: ReactNode, className: string, labelClassName?: string): ReactNode {
  if (typeof child === 'string' || typeof child === 'number')
    return <Text className={cn(className, labelClassName)}>{child}</Text>;
  return isValidElement(child) ? child : null;
}

type BuildContentArgs = {
  loading: boolean | undefined;
  reduce: boolean;
  variant: ButtonVariant;
  size: ButtonSize | null | undefined;
  children: ReactNode;
  leftAdornment: ReactNode;
  rightAdornment: ReactNode;
  spinnerColor: string;
  labelClassName: string | undefined;
};

function buildButtonContent({
  loading,
  reduce,
  variant,
  size,
  children,
  leftAdornment,
  rightAdornment,
  spinnerColor,
  labelClassName,
}: BuildContentArgs): ReactNode {
  if (loading)
    return (
      <MotiView
        from={{ rotate: '0deg' }}
        animate={{ rotate: reduce ? '0deg' : '360deg' }}
        transition={{ type: 'timing', duration: 800, loop: !reduce, repeatReverse: false }}
      >
        <Svg width={16} height={16} viewBox="0 0 16 16">
          <Circle cx={8} cy={8} r={6} stroke={spinnerColor} strokeOpacity={0.25} strokeWidth={2} fill="none" />
          <Circle
            cx={8}
            cy={8}
            r={6}
            stroke={spinnerColor}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${Math.PI * 6} ${Math.PI * 12}`}
          />
        </Svg>
      </MotiView>
    );

  const labelClass = label({ variant, size });
  const hasAdornments = leftAdornment !== undefined || rightAdornment !== undefined;
  const isLeaf = typeof children === 'string' || typeof children === 'number';
  const mergedLabelClass = cn(labelClass, labelClassName);

  if (isLeaf && !hasAdornments) return <Text className={mergedLabelClass}>{children}</Text>;

  return (
    <View className="flex-row items-center justify-center" style={{ gap: 8 }}>
      {leftAdornment}
      {isLeaf ? (
        <Text className={mergedLabelClass}>{children}</Text>
      ) : (
        Children.map(children, (child) => renderChild(child, labelClass, labelClassName))
      )}
      {rightAdornment}
    </View>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  children,
  leftAdornment,
  rightAdornment,
  onPress,
  disabled,
  loading,
  ripple = false,
  pressScale = 0.93,
  noDisabledOpacity = false,
  backdropColor,
  pressTransition,
  fitWidth,
  className,
  labelClassName,
  contentStyle,
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const reduce = useReducedMotion();
  const colors = useThemeColors();
  const pressSpring = mergeTransition(MOTION_SNAPPY, pressTransition);
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);
  const size_ = useRef({ w: 0, h: 0 });
  const isDisabled = disabled || loading;
  const v = variant ?? 'primary';

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    size_.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
  }, []);

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(true);
      if (!ripple || reduce) return;
      const { locationX: x, locationY: y } = e.nativeEvent;
      const r = Math.max(size_.current.w, size_.current.h) * 2;
      const id = nextId.current;
      nextId.current += 1;
      setRipples((prev) => [...prev, { id, x, y, size: r }]);
      setTimeout(() => setRipples((prev) => prev.filter((rp) => rp.id !== id)), 650);
    },
    [ripple, reduce],
  );
  const handlePressOut = useCallback(() => setPressed(false), []);

  const buttonContent = buildButtonContent({
    loading,
    reduce,
    variant: v,
    size,
    children,
    leftAdornment,
    rightAdornment,
    spinnerColor: buildSpinnerColor(v, colors),
    labelClassName,
  });

  return (
    <MotiView
      animate={{ scale: pressed && !reduce && !isDisabled ? pressScale : 1 }}
      transition={pressSpring}
      className={cn(fitWidth && 'w-full', className)}
      style={style}
    >
      <Pressable
        accessibilityRole="button"
        aria-disabled={Boolean(isDisabled)}
        aria-busy={Boolean(loading)}
        accessibilityLabel={accessibilityLabel}
        testID={testID ?? 'button'}
        disabled={isDisabled}
        onLayout={onLayout}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        className={container({ variant, size, shape })}
        style={[{ opacity: isDisabled && !noDisabledOpacity ? 0.5 : 1, overflow: 'hidden' }, contentStyle]}
      >
        {/* State backdrop — animates in/out by opacity so the variant background
            shows through when idle and the state colour fills it on success/error. */}
        <MotiView
          animate={{ opacity: backdropColor === undefined ? 0 : 1 }}
          transition={TIMING_BASE}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: backdropColor ?? 'transparent',
          }}
        />
        {buttonContent}
        {ripple && !reduce
          ? ripples.map((rp) => (
              <MotiView
                key={rp.id}
                from={{ scale: 0, opacity: 0.3 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{ type: 'timing', duration: 600 }}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: rp.x - rp.size / 2,
                  top: rp.y - rp.size / 2,
                  width: rp.size,
                  height: rp.size,
                  borderRadius: rp.size / 2,
                  backgroundColor:
                    v === 'primary'
                      ? 'rgba(255,255,255,0.35)' /* theme-exempt: white shimmer on filled bg */
                      : 'rgba(0,0,0,0.12)' /* theme-exempt: dark shimmer on light bg */,
                }}
              />
            ))
          : null}
      </Pressable>
    </MotiView>
  );
}
