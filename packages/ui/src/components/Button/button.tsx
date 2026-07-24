import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable, StyleSheet } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { MotiView } from '../../moti/components/view';
import { MOTION_SNAPPY, mergeTransition, TIMING_BASE } from '../../theme/motion';
import { useThemeColors } from '../../theme/use-theme-color';
import { type BaseButtonProps, ButtonRipples, buildButtonContent, usePressRipples } from './button-internals';

export type { ButtonShape, ButtonSize } from './button-internals';

// biome-ignore lint/style/useExportsLast: ButtonVariant is a public type declared beside the cva tables it enumerates; hoisting it to the file end would separate it from the container/label variants it must stay in sync with
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'outlineDanger'
  | 'ghostDanger'
  | 'ghostPrimary';

// cva drives the STATIC styling layer (per the conversion spec). Animated/tap
// scale stays inline on the MotiView. Class strings are static literals so the
// Tailwind/uniwind scanner picks them up.
const container = cva('flex-row items-center justify-center', {
  variants: {
    variant: {
      primary: 'bg-primary',
      secondary: 'border border-border bg-surface-3',
      ghost: 'bg-transparent',
      outline: 'border border-border bg-transparent',
      danger: 'bg-danger',
      outlineDanger: 'border border-danger bg-transparent',
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
      danger: 'text-white',
      outlineDanger: 'text-danger',
      ghostDanger: 'text-danger',
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
    case 'danger':
      return colors['primary-foreground'];
    case 'outlineDanger':
    case 'ghostDanger':
      return colors.danger;
    default:
      return colors.foreground;
  }
}

export interface ButtonProps extends VariantProps<typeof container>, BaseButtonProps {}

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
  const isDisabled = Boolean(disabled || loading);
  const v = variant ?? 'primary';

  const { pressed, onLayout, ripples, handlePressIn, handlePressOut } = usePressRipples({
    ripple,
    reduce,
    trackDims: false,
  });

  const buttonContent = buildButtonContent({
    loading,
    reduce,
    labelClass: label({ variant: v, size }),
    spacious: false,
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
          style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor ?? 'transparent' }]}
        />
        {buttonContent}
        {ripple && !reduce ? <ButtonRipples ripples={ripples} filled={v === 'primary'} /> : null}
      </Pressable>
    </MotiView>
  );
}
