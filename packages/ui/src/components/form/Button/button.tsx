import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable, StyleSheet } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import { MOTION_SNAPPY, mergeTransition, TIMING_BASE } from '../../../theme/motion';
import { useThemeColors } from '../../../theme/use-theme-color';
import { type BaseButtonProps, ButtonRipples, buildButtonContent, pressAnimate, usePressRipples } from './button-internals';
import { BUTTON_BOX, type ButtonShape, type ButtonSize, LABEL_TEXT_CLASS } from './button-scale';

export type { ButtonShape, ButtonSize } from './button-scale';

// biome-ignore lint/style/useExportsLast: ButtonVariant is a public type declared beside the cva tables it enumerates; hoisting it to the file end would separate it from the container/label variants it must stay in sync with
export type ButtonVariant =
  | 'neutral'
  | 'inverse'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'success'
  | 'warning'
  | 'info'
  | 'special'
  | 'outlineDanger'
  | 'ghostDanger';

// cva drives the STATIC styling layer (per the conversion spec). Animated/tap
// scale stays inline on the MotiView. Class strings are static literals so the
// Tailwind/uniwind scanner picks them up.
//
// Colour is the only axis here: the box (height, padding, radius) is the family's,
// resolved through {@link BUTTON_BOX} so a flat `md` occupies exactly the same
// rectangle as an elevated chip or an ActionSwap at `md`.
const container = cva('flex-row items-center justify-center', {
  variants: {
    variant: {
      neutral: 'bg-surface-3',
      inverse: 'bg-foreground',
      ghost: 'bg-transparent',
      outline: 'border border-border bg-transparent',
      danger: 'bg-danger shadow-elevated-3',
      success: 'bg-success shadow-elevated-3',
      warning: 'bg-warning shadow-elevated-3',
      info: 'bg-info shadow-elevated-3',
      special: 'bg-special shadow-elevated-3',
      outlineDanger: 'border border-danger bg-transparent',
      ghostDanger: 'bg-transparent',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

// biome-ignore lint/style/useComponentExportOnlyModules: label cva is a styling utility consumed by StatefulButton in the same component family; splitting to a separate file would fragment tightly-coupled button styles
export const label = cva('', {
  variants: {
    variant: {
      neutral: 'text-foreground',
      inverse: 'text-background',
      ghost: 'text-foreground',
      outline: 'text-foreground',
      danger: 'text-white',
      success: 'text-success-foreground',
      warning: 'text-warning-foreground',
      info: 'text-info-foreground',
      special: 'text-special-foreground',
      outlineDanger: 'text-danger',
      ghostDanger: 'text-danger',
    },
    // Weight + size come from the family ramp, so only the colour above is
    // Button's own.
    size: LABEL_TEXT_CLASS,
  },
  defaultVariants: { variant: 'neutral', size: 'md' },
});

// Variants whose background is an opaque, dark-or-vivid fill, so a ripple has to
// shimmer white to be visible. Everything else is a light surface plate and takes
// the dark ripple.
const FILLED_RIPPLE_VARIANTS = new Set<ButtonVariant>(['inverse', 'danger', 'success', 'warning', 'info', 'special']);

// Spinner stroke matches the label colour so it reads on every variant.
function buildSpinnerColor(variant: ButtonVariant, colors: ReturnType<typeof useThemeColors>): string {
  switch (variant) {
    case 'inverse':
      return colors['surface-1'];
    case 'danger':
      return colors['primary-foreground'];
    case 'success':
      return colors['success-foreground'];
    case 'warning':
      return colors['warning-foreground'];
    case 'info':
      return colors['info-foreground'];
    case 'special':
      return colors['special-foreground'];
    case 'outlineDanger':
    case 'ghostDanger':
      return colors.danger;
    default:
      return colors.foreground;
  }
}

export interface ButtonProps extends VariantProps<typeof container>, BaseButtonProps {
  size?: ButtonSize;
  shape?: ButtonShape;
}

export function Button({
  variant = 'neutral',
  size = 'md',
  shape = 'pill',
  children,
  leftAdornment,
  rightAdornment,
  onPress,
  disabled,
  loading,
  ripple = false,
  pressScale = 0.93,
  pressMode = 'scale',
  noDisabledOpacity = false,
  backdropColor,
  pressTransition,
  fitWidth,
  className,
  contentClassName,
  labelClassName,
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const reduce = useReducedMotion();
  const colors = useThemeColors();
  const pressSpring = mergeTransition(MOTION_SNAPPY, pressTransition);
  const isDisabled = Boolean(disabled || loading);
  const v = variant ?? 'neutral';

  const { pressed, onLayout, ripples, handlePressIn, handlePressOut } = usePressRipples({
    ripple,
    reduce,
    trackDims: false,
  });

  const buttonContent = buildButtonContent({
    loading,
    reduce,
    labelClass: label({ variant: v, size }),
    children,
    leftAdornment,
    rightAdornment,
    spinnerColor: buildSpinnerColor(v, colors),
    labelClassName,
  });

  return (
    <MotiView
      animate={pressAnimate({ pressed, blocked: reduce || isDisabled, pressMode, pressScale })}
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
        className={cn(
          container({ variant }),
          BUTTON_BOX[shape][size],
          isDisabled && !noDisabledOpacity && 'opacity-50',
          'overflow-hidden',
          contentClassName,
        )}
      >
        {/* State backdrop — animates in/out by opacity so the variant background
            shows through when idle and the state colour fills it on success/error. */}
        <MotiView
          animate={{ opacity: backdropColor === undefined ? 0 : 1 }}
          transition={TIMING_BASE}
          style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor ?? 'transparent', pointerEvents: 'none' }]}
        />
        {buttonContent}
        {ripple && !reduce ? <ButtonRipples ripples={ripples} filled={FILLED_RIPPLE_VARIANTS.has(v)} /> : null}
      </Pressable>
    </MotiView>
  );
}
