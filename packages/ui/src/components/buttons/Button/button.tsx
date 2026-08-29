import type { VariantProps } from 'class-variance-authority';
import { Pressable, StyleSheet } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { elevatedShadow, FLOATING_SHADOW_CLASSNAME, type SurfaceElevation } from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { MOTION_SNAPPY, mergeTransition, TIMING_BASE } from '../../../theme/motion';
import { useThemeColors } from '../../../theme/use-theme-color';
import { type BaseButtonProps, ButtonRipples, buildButtonContent, pressAnimate, usePressRipples } from './button-internals';
import { BUTTON_BOX, type ButtonShape, type ButtonSize } from './button-scale';
import {
  type ButtonVariant,
  buttonContainer as container,
  FILLED_RIPPLE_VARIANTS,
  buttonLabel as label,
} from './button-variants';

// The family's public types, re-exported beside the imports that resolve them so
// every sibling (and every consumer) keeps importing them from `./button`.
export type { ButtonShape, ButtonSize } from './button-scale';
// biome-ignore lint/style/useExportsLast: the family's public types belong beside the imports that resolve them, not at the file end after the component
export type { ButtonVariant } from './button-variants';

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

  /**
   * Swap the button's ladder shadow for the input field's large, diffuse halo
   * (`shadow-floating`) — the same recipe {@link Input}'s `floating` prop wears.
   * It *replaces* whatever shadow `elevation` resolved rather than adding to it,
   * since both write `box-shadow`: a floating `danger` at `elevation={3}` trades
   * its `shadow-elevated-3` rung for the halo, and a floating `ghost` gains one
   * where it had none. @default false
   */
  floating?: boolean;

  /**
   * Shadow level (0–8) the button casts. Unlike the surface components this
   * drives the shadow *only* — a Button's background comes from its `variant`,
   * not the surface ladder, so raising `elevation` floats the button without
   * recolouring it. `0` is flat (no shadow). @default 0
   */
  elevation?: SurfaceElevation;
}

export function Button({
  variant = 'neutral',
  size = 'md',
  shape = 'pill',
  floating = false,
  elevation,
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
  // The shadow is `elevation`-driven and defaults to flat (`0`); `floating`
  // swaps whichever rung resolves for the halo.
  const resolvedElevation: SurfaceElevation = elevation ?? 0;

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
          // After the variant so tailwind-merge lets the halo win over the
          // resolved `shadow-elevated-N` rung.
          floating ? FLOATING_SHADOW_CLASSNAME : elevatedShadow(resolvedElevation),
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
