import type { VariantProps } from 'class-variance-authority';
import { Pressable, StyleSheet } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import {
  clampSurfaceLevel,
  elevatedShadow,
  FLOATING_SHADOW_CLASSNAME,
  type SurfaceElevation,
  type SurfaceLevel,
} from '../../../lib/elevated';
import { MotiView } from '../../../moti/components/view';
import { MOTION_SNAPPY, mergeTransition, TIMING_BASE } from '../../../theme/motion';
import { useThemeColors } from '../../../theme/use-theme-color';
import { type BaseButtonProps, ButtonRipples, buildButtonContent, pressAnimate, usePressRipples } from './button-internals';
import { BUTTON_BOX, type ButtonShape, type ButtonSize } from './button-scale';
import {
  type ButtonVariant,
  buttonContainer as container,
  FILLED_FILL_TOKEN,
  FILLED_RIPPLE_VARIANTS,
  buttonLabel as label,
  variantIconColorToken,
} from './button-variants';

// The family's public types, re-exported beside the imports that resolve them so
// every sibling (and every consumer) keeps importing them from `./button`.
export type { ButtonShape, ButtonSize } from './button-scale';
// biome-ignore lint/style/useExportsLast: the family's public types belong beside the imports that resolve them, not at the file end after the component
export type { ButtonVariant } from './button-variants';

const RGB_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/;

/** Parse an `rgb()`/`rgba()` string to a [r,g,b] triple (0 on failure). */
function parseRgb(color: string): [number, number, number] {
  const match = RGB_RE.exec(color);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

// Dark-neutral drop strength per rung (1–8). The surface ladder's drop is tuned
// for near-white surfaces (5–6% black) and vanishes against a filled variant's
// opaque fill, so the filled variants graduate a stronger drop (16% → 48%) in
// its place — the same `rgba(27,28,29,…)` drop ElevatedButton wears at its top
// strength.
const FILLED_SHADOW_DROP: Record<SurfaceLevel, string> = {
  1: '0 1px 2px 0 rgba(27, 28, 29, 0.16)',
  2: '0 1px 2px 0 rgba(27, 28, 29, 0.22)',
  3: '0 1px 3px 0 rgba(27, 28, 29, 0.28)',
  4: '0 2px 4px 0 rgba(27, 28, 29, 0.34)',
  5: '0 2px 5px 0 rgba(27, 28, 29, 0.4)',
  6: '0 3px 8px 0 rgba(27, 28, 29, 0.44)',
  7: '0 3px 10px 0 rgba(27, 28, 29, 0.46)',
  8: '0 4px 12px 0 rgba(27, 28, 29, 0.48)',
};

/**
 * Elevation shadow for a *filled* variant. The surface ladder (`shadow-elevated-N`)
 * is a dark drop tuned for surfaces resting on the page — too subtle to read as
 * elevation on an opaque button fill — so a filled button casts a fill-aware
 * shadow instead: a 1px ring of the fill itself (the crisp edge that reads on any
 * substrate) plus the graduated dark-neutral drop above — the same recipe
 * {@link ElevatedButton} wears, spread across the ladder here.
 */
function filledButtonShadow(variant: ButtonVariant, level: SurfaceLevel, colors: ReturnType<typeof useThemeColors>): string {
  const fill = colors[FILLED_FILL_TOKEN[variant] ?? 'foreground'];
  const [r, g, b] = parseRgb(fill);
  return `${FILLED_SHADOW_DROP[level]}, 0 0 0 1px rgba(${r}, ${g}, ${b}, 1)`;
}

// Spinner stroke matches the label colour so it reads on every variant.
function buildSpinnerColor(variant: ButtonVariant, colors: ReturnType<typeof useThemeColors>): string {
  return colors[variantIconColorToken(variant)];
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

  // Every opaque fill — `primary` and the vivid status fills — casts the
  // fill-aware shadow; the surface ladder's subtle drop reads as "no elevation"
  // on an opaque button, so a filled variant graduates a stronger drop plus a
  // fill-coloured ring instead. `neutral`'s light surface-3 plate is a *surface*,
  // so it keeps the ladder class along with the transparent variants. Both are
  // box-shadow, so exactly one resolves: `floating` and elevation 0 leave the
  // filled shadow unset and fall through to the class path.
  const filledShadow =
    !floating && FILLED_FILL_TOKEN[v] !== undefined && resolvedElevation > 0
      ? filledButtonShadow(v, clampSurfaceLevel(resolvedElevation), colors)
      : undefined;
  let shadowClass: string | undefined;
  if (!filledShadow) shadowClass = floating ? FLOATING_SHADOW_CLASSNAME : elevatedShadow(resolvedElevation);

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
        style={filledShadow ? { boxShadow: filledShadow } : undefined}
        className={cn(
          container({ variant }),
          // After the variant so tailwind-merge lets the halo win over the
          // resolved `shadow-elevated-N` rung (and the filled variant's shadow
          // rides the style prop above instead).
          shadowClass,
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
