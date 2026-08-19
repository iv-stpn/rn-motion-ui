import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable, StyleSheet } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { SURFACE_CLASSNAME } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { MOTION_SNAPPY, mergeTransition, TIMING_BASE } from '../../../theme/motion';
import { useThemeColors } from '../../../theme/use-theme-color';
import { type BaseButtonProps, ButtonRipples, buildButtonContent, pressAnimate, usePressRipples } from './button-internals';
import { BUTTON_BOX, type ButtonShape, type ButtonSize, LABEL_TEXT_CLASS } from './button-scale';

export type { ButtonShape, ButtonSize } from './button-scale';

// biome-ignore lint/style/useExportsLast: ButtonVariant is a public type declared beside the cva tables it enumerates; hoisting it to the file end would separate it from the container/label variants it must stay in sync with
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'outline'
  | 'danger'
  | 'special'
  | 'inverse'
  | 'outlineDanger'
  | 'ghostDanger';

// cva drives the STATIC styling layer (per the conversion spec). Animated/tap
// scale stays inline on the MotiView. Class strings are static literals so the
// Tailwind/uniwind scanner picks them up.
//
// Colour is the only axis here: the box (height, padding, radius) is the family's,
// resolved through {@link BUTTON_BOX} so a flat `md` occupies exactly the same
// rectangle as an elevated chip, a glossy key or an ActionSwap at `md`.
const container = cva('flex-row items-center justify-center', {
  variants: {
    variant: {
      primary: SURFACE_CLASSNAME[3],
      secondary: 'border border-border bg-foreground',
      ghost: 'bg-transparent',
      outline: 'border border-border bg-transparent',
      danger: 'bg-danger shadow-elevated-3',
      special: 'bg-special shadow-elevated-3',
      // `inverse` is deliberately not `primary`: `primary` is the consumer's
      // brand token, designed to be overridden, so a fill built on it can't
      // promise contrast. `foreground` over `surface-1` is the one pair a theme
      // guarantees reads, so the flip stays legible through any retint.
      inverse: 'bg-foreground shadow-elevated-3',
      outlineDanger: 'border border-danger bg-transparent',
      ghostDanger: 'bg-transparent',
    },
  },
  defaultVariants: { variant: 'primary' },
});

// biome-ignore lint/style/useComponentExportOnlyModules: label cva is a styling utility consumed by StatefulButton in the same component family; splitting to a separate file would fragment tightly-coupled button styles
export const label = cva('', {
  variants: {
    variant: {
      primary: 'text-foreground',
      secondary: 'text-surface-1',
      ghost: 'text-foreground',
      outline: 'text-foreground',
      danger: 'text-white',
      special: 'text-special-foreground',
      // The page colour, so the label reads as a hole punched through the slab
      // to the backdrop behind it (same pairing GlossyButton's `inverse` uses).
      inverse: 'text-surface-1',
      outlineDanger: 'text-danger',
      ghostDanger: 'text-danger',
    },
    // Weight + size come from the family ramp, shared with GlossyButton, so only
    // the colour above is Button's own.
    size: LABEL_TEXT_CLASS,
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

// Variants whose background is an opaque, dark-or-vivid fill, so a ripple has to
// shimmer white to be visible. Everything else is a light surface plate and takes
// the dark ripple.
const FILLED_RIPPLE_VARIANTS = new Set<ButtonVariant>(['secondary', 'danger', 'special', 'inverse']);

// Spinner stroke matches the label colour so it reads on every variant.
function buildSpinnerColor(variant: ButtonVariant, colors: ReturnType<typeof useThemeColors>): string {
  switch (variant) {
    case 'secondary':
    case 'inverse':
      return colors['surface-1'];
    case 'danger':
      return colors['primary-foreground'];
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
  variant = 'primary',
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
