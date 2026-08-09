/** biome-ignore-all lint/style/noExcessiveLinesPerFile: self-contained elevated-chip component — colour tables, shadow maths, SVG highlights and the component read best in one file */
import { useCallback, useId, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useResolveClassNames } from 'uniwind';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import { MOTION_SNAPPY, mergeTransition, TIMING_BASE } from '../../../theme/motion';
import { type ThemeToken, useThemeColors } from '../../../theme/use-theme-color';
import { type BaseButtonProps, ButtonRipples, buildButtonContent, pressAnimate, usePressRipples } from './button-internals';
import { BUTTON_BOX, type ButtonShape, type ButtonSize, buttonRadiusClass } from './button-scale';

/**
 * Fill colour + surface style for an ElevatedButton. Most values get the glossy
 * treatment (top-down white sheen + a 1px rim highlight + a drop shadow with a
 * crisp coloured ring). Two are flat plates instead: `white` (light surface,
 * muted label, 1px border, darkening and dropping its shadow on hover) and
 * `gray` (a Geist-style secondary plate — a fixed #F2F2F2 fill, #707070 label, a
 * 1px neutral ring plus a hairline white top sheen, no gloss and no hover shift).
 *
 * `special` is the non-semantic accent — a promotion or an upgrade path, where
 * `info`/`success`/`warning`/`danger` each carry a meaning. `inverse` is the
 * high-contrast flip of the page, the one fill whose contrast a consumer retint
 * can't break. Both mirror the GlossyButton variants of the same name.
 */
// biome-ignore lint/style/useExportsLast: declared up top so the colour tables below can key off it; kept with its doc comment for readability
export type ElevatedVariant = 'neutral' | 'inverse' | 'danger' | 'success' | 'warning' | 'info' | 'special' | 'white' | 'gray';

// A glossy filled chip (or, for `white`/`gray`, a flat plate). Everything colour-
// dependent is resolved from `variant` here so one component covers every hue
// plus the two plate styles.

// Background class per variant. `neutral` reuses the monochrome `primary` token
// (near-black on light, near-white on dark). Spelled as literals so the
// uniwind/Tailwind scanner registers each class.
const ELEVATED_BG: Record<Exclude<ElevatedVariant, 'white' | 'gray'>, string> = {
  neutral: 'bg-primary',
  // `inverse` is deliberately not `primary`: `primary` is the consumer's brand
  // token, designed to be overridden, so a fill built on it can't promise
  // contrast. `foreground` over `surface-1` is the one pair a theme guarantees
  // reads against each other, so the flip survives any retint. Untinted the two
  // land in the same place; they diverge the moment a consumer sets a brand hue.
  inverse: 'bg-foreground',
  danger: 'bg-danger',
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
  special: 'bg-special',
};

// Label colour class per variant. Coloured fills are vivid, so their
// `*-foreground` (white) partner reads on top; neutral uses `primary-foreground`.
const ELEVATED_LABEL: Record<Exclude<ElevatedVariant, 'white' | 'gray'>, string> = {
  neutral: 'text-primary-foreground',
  // The page colour, so the label reads as a hole punched through the slab to the
  // backdrop behind it (the pairing GlossyButton's `inverse` uses).
  inverse: 'text-surface-1',
  danger: 'text-danger-foreground',
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
  info: 'text-info-foreground',
  special: 'text-special-foreground',
};

// Foreground token per variant — drives the loading spinner stroke so it matches
// the label on the filled chip.
const ELEVATED_FOREGROUND_TOKEN: Record<Exclude<ElevatedVariant, 'white' | 'gray'>, ThemeToken> = {
  neutral: 'primary-foreground',
  inverse: 'surface-1',
  danger: 'danger-foreground',
  success: 'success-foreground',
  warning: 'warning-foreground',
  info: 'info-foreground',
  special: 'special-foreground',
};

// Fill token per variant — resolved to sRGB for the drop shadow: the 1px ring is
// the fill itself and the shadow tint is the fill darkened toward black.
const ELEVATED_FILL_TOKEN: Record<Exclude<ElevatedVariant, 'white' | 'gray'>, ThemeToken> = {
  neutral: 'primary',
  inverse: 'foreground',
  danger: 'danger',
  success: 'success',
  warning: 'warning',
  info: 'info',
  special: 'special',
};

// The white stroke plate: light surface + muted label at rest; on hover it
// darkens to the weak surface and the label goes strong (mirrors the web
// `hover:bg-bg-weak-50 hover:text-text-strong-950`).
const WHITE_BG_REST = 'bg-surface-3';
const WHITE_BG_HOVER = 'bg-muted';
const WHITE_LABEL_REST = 'text-muted-foreground';
const WHITE_LABEL_HOVER = 'text-foreground';

/** Stacking layer for press ripples — sits above the gloss/rim SVG highlights. */
const RIPPLE_Z = 1;

// Disabled chip — flat weak plate, disabled-grey label, no gloss/shadow.
const DISABLED_BG = 'bg-muted';
const DISABLED_LABEL = 'text-muted-foreground';

// The gray plate mirrors Geist's secondary button: a fixed light fill, a muted
// mid-grey label, a 1px neutral ring and a hairline white top sheen. No gloss,
// no hover shift. Every value is fixed (theme-exempt, like the ripple overlays):
// the request pins exact colours rather than theme tokens. The fill + shadow
// ride the wrapper together so the *inset* sheen isn't painted over — the
// Pressable stays transparent above them (an inset shadow on the wrapper would
// otherwise be hidden by the Pressable's own background).
const GRAY_FILL = 'rgb(242, 242, 242)'; /* theme-exempt: fixed Geist plate */
const GRAY_LABEL = 'text-[#707070]'; /* theme-exempt: fixed muted label */
const GRAY_SHADOW =
  '0px 0px 0px 1px rgba(61,61,61,0.12), inset 0px 0.75px 0.75px 0px rgba(255,255,255,0.64)'; /* theme-exempt: fixed Geist plate — border ring + inset sheen */

/** Background class for the container given its variant, hover, disabled. */
function backgroundClass(variant: ElevatedVariant, hovered: boolean, disabled: boolean): string {
  if (disabled) return DISABLED_BG;
  if (variant === 'white') return hovered ? WHITE_BG_HOVER : WHITE_BG_REST;
  // gray rides its fill on the wrapper (with the inset sheen) so the Pressable
  // must stay transparent, otherwise it would paint over the inset shadow.
  if (variant === 'gray') return 'bg-transparent';
  return ELEVATED_BG[variant];
}

/** Label colour class given the variant, hover, disabled. */
function labelColorClass(variant: ElevatedVariant, hovered: boolean, disabled: boolean): string {
  if (disabled) return DISABLED_LABEL;
  if (variant === 'white') return hovered ? WHITE_LABEL_HOVER : WHITE_LABEL_REST;
  if (variant === 'gray') return GRAY_LABEL;
  return ELEVATED_LABEL[variant];
}

/** Loading-spinner stroke colour. Disabled (which loading implies) flattens the
 *  chip to the muted plate, so the stroke follows the disabled label colour there
 *  instead of the fill's white foreground. */
function spinnerColorFor(variant: ElevatedVariant, disabled: boolean, colors: ReturnType<typeof useThemeColors>): string {
  if (disabled || variant === 'white' || variant === 'gray') return colors['muted-foreground'];
  return colors[ELEVATED_FOREGROUND_TOKEN[variant]];
}

const RGB_RE = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/;

/** Parse an `rgb()`/`rgba()` string to a [r,g,b] triple (0 on failure). */
function parseRgb(color: string): [number, number, number] {
  const match = RGB_RE.exec(color);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Drop-shadow + ring for an elevated chip. Matches `shadow-fancy-buttons-*` on
 * web: a soft 1px-blur shadow at 48% plus a crisp 1px ring. The monochrome fills
 * (`neutral`, `inverse`) and `white` cast a dark-neutral shadow
 * (`rgba(27,28,29,.48)`); vivid fills tint the shadow
 * with the fill darkened toward black. The ring is the fill itself, or the theme border
 * for `white`. `boxShadow` composes both layers in one value (web and native ≥ 0.76
 * New Arch).
 */
function elevatedShadow(variant: ElevatedVariant, fill: string, borderColor: string): string {
  if (variant === 'white')
    return `0 1px 3px 0 rgba(14,18,27,0.12),0 0 0 1px ${borderColor}`; /* theme-exempt: fixed neutral drop for white plate */

  const [red, green, blue] = parseRgb(fill);
  // The two monochrome fills cast the fixed dark-neutral drop rather than a tint
  // of themselves: both flip with the page, and darkening their near-white dark-
  // mode fill would put a pale grey haze under the chip instead of a shadow.
  if (variant === 'neutral' || variant === 'inverse')
    return `0px 1px 2px 0px rgba(27,28,29,0.48), 0px 0px 0px 1px rgba(${red},${green},${blue},1)`; /* theme-exempt: fixed dark-neutral shadow for monochrome fills */

  const darken = (c: number) => Math.round(c * 0.7);
  return `0px 1px 2px 0px rgba(${darken(red)},${darken(green)},${darken(blue)},0.48), 0px 0px 0px 1px rgba(${red},${green},${blue},1)`; /* theme-exempt: tinted shadow derived from fill RGB */
}

type ElevatedAppearance = {
  containerClass: string;
  labelClass: string;
  spinnerColor: string;
  /** Render the gloss + rim SVG highlights (coloured fills only, not disabled). */
  showHighlights: boolean;
  /** CSS class for the wrapper border-radius so the shadow ring follows the curve.
   *  Also resolved via {@link useResolveClassNames} to derive the SVG rim inset. */
  radiusClass: string;
  /** Multi-layer drop shadow string, or undefined when the chip is flat. */
  boxShadow: string | undefined;
  /** Fill painted on the wrapper (gray plate only) so its inset sheen isn't
   *  painted over by the Pressable. Undefined for every other appearance. */
  wrapperBackground: string | undefined;
};

type AppearanceArgs = {
  variant: ElevatedVariant;
  size: ButtonSize;
  shape: ButtonShape;
  hovered: boolean;
  isDisabled: boolean;
  colors: ReturnType<typeof useThemeColors>;
};

/**
 * Resolve every colour-dependent piece of an elevated chip's appearance: it folds
 * the `variant` colour + hover + disabled state into the background, label, spinner
 * and shadow. Coloured fills get the glossy treatment; `white`/`gray` are flat plates.
 */
function resolveAppearance({ variant, size, shape, hovered, isDisabled, colors }: AppearanceArgs): ElevatedAppearance {
  // gray is a flat plate whose 1px ring + inset white sheen ride the wrapper
  // (shadows are clipped by the Pressable's overflow); its fill rides there too
  // so the inset sheen paints over it rather than being hidden by the Pressable.
  let boxShadow: string | undefined;
  let wrapperBackground: string | undefined;
  if (!isDisabled) {
    if (variant === 'gray') {
      boxShadow = GRAY_SHADOW;
      wrapperBackground = GRAY_FILL;
    } else if (variant === 'white') {
      if (!hovered) boxShadow = elevatedShadow('white', '', colors.border);
    } else boxShadow = elevatedShadow(variant, colors[ELEVATED_FILL_TOKEN[variant]], colors.border);
  }

  return {
    // The box is the family's ({@link BUTTON_BOX}) so an elevated chip and a flat
    // button at the same size occupy the same rectangle.
    containerClass: cn(
      'flex-row items-center justify-center overflow-hidden',
      BUTTON_BOX[shape][size],
      backgroundClass(variant, hovered, isDisabled),
    ),
    labelClass: cn('text-sm font-medium', labelColorClass(variant, hovered, isDisabled)),
    spinnerColor: spinnerColorFor(variant, isDisabled, colors),
    // gray and white are flat plates — neither gets the SVG gloss/rim overlays.
    showHighlights: variant !== 'white' && variant !== 'gray' && !isDisabled,
    radiusClass: buttonRadiusClass(shape),
    boxShadow,
    wrapperBackground,
  };
}

type ElevatedHighlightsProps = { id: string; hovered: boolean; radiusClass: string; width: number; height: number };

function ElevatedHighlights({ id, hovered, radiusClass, width, height }: ElevatedHighlightsProps) {
  // Resolve the radius class (rounded-interactive or rounded-full) through
  // UniWind so the SVG rim follows the same curve driven by --radius-interactive
  // rather than a hardcoded JS constant. For pills (rounded-full → borderRadius
  // 9999) the effective radius is capped at half the measured height.
  const resolvedStyle = useResolveClassNames(radiusClass);
  const numericRadius: number = (() => {
    const v = resolvedStyle.borderRadius ?? resolvedStyle.borderTopLeftRadius;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const parsed = Number.parseFloat(v);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  })();
  const effectiveRadius = numericRadius > height / 2 ? height / 2 : numericRadius;
  const rimInset = Math.max(0, effectiveRadius - 0.5);
  return (
    <>
      <MotiView
        animate={{ opacity: hovered ? 0.24 : 0.16 }}
        transition={{ type: 'timing', duration: 200 }}
        className={cn(radiusClass, 'pointer-events-none overflow-hidden')}
        style={StyleSheet.absoluteFill}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
              <Stop /* theme-exempt: pure-white gloss gradient top */ offset="0" stopColor="#fff" stopOpacity={1} />
              <Stop /* theme-exempt: pure-white gloss gradient bottom */ offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-gloss)`} />
        </Svg>
      </MotiView>
      {width > 0 && height > 0 ? (
        <Svg width={width} height={height} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
              <Stop /* theme-exempt: pure-white rim highlight top */ offset="0" stopColor="#fff" stopOpacity={0.12} />
              <Stop /* theme-exempt: pure-white rim highlight bottom */ offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect
            x={0.5}
            y={0.5}
            width={width - 1}
            height={height - 1}
            rx={rimInset}
            ry={rimInset}
            fill="none"
            stroke={`url(#${id}-rim)`}
            strokeWidth={1}
          />
        </Svg>
      ) : null}
    </>
  );
}

export interface ElevatedButtonProps extends BaseButtonProps {
  /** Fill colour. Most colours get the glossy treatment (top-down sheen + 1px rim
   *  highlight + coloured drop-shadow ring); `white` is a stroke plate and `gray`
   *  a fixed Geist-style secondary plate. `special` is the non-semantic accent and
   *  `inverse` the high-contrast flip of the page. Defaults to `neutral`. */
  variant?: ElevatedVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
}

export function ElevatedButton({
  variant = 'neutral',
  size = 'md',
  shape = 'rounded',
  children,
  leftAdornment,
  rightAdornment,
  onPress,
  disabled,
  loading,
  noDisabledOpacity = false,
  ripple = false,
  pressScale = 0.93,
  pressMode = 'scale',
  backdropColor,
  pressTransition,
  fitWidth,
  className,
  labelClassName,
  contentClassName,
  style,
  accessibilityLabel,
  testID,
}: ElevatedButtonProps) {
  const reduce = useReducedMotion();
  const colors = useThemeColors();
  const pressSpring = mergeTransition(MOTION_SNAPPY, pressTransition);
  const [hovered, setHovered] = useState(false);
  const isDisabled = Boolean(disabled || loading);
  // Two axes: `isDisabled` blocks interaction (Pressable + press-scale), while
  // `flatten` collapses the chip to the muted plate. `noDisabledOpacity` splits
  // them so a non-interactive chip (e.g. StatefulButton mid-machine) keeps its
  // gloss/fill/shadow instead of greying out.
  const flatten = isDisabled && !noDisabledOpacity;

  // SVG gradient ids must be unique per instance (they land in one shared
  // document on web). useId can emit ':' which is illegal in url(#…), so strip it.
  const gradientId = useId().replace(/:/g, '');

  const appearance = resolveAppearance({ variant, size, shape, hovered, isDisabled: flatten, colors });
  const { containerClass, spinnerColor, showHighlights, radiusClass, boxShadow, wrapperBackground } = appearance;

  const { pressed, ripples, dims, onLayout, handlePressIn, handlePressOut } = usePressRipples({
    ripple,
    reduce,
    trackDims: showHighlights,
  });
  // Hover drives the gloss opacity + the white plate swap. Stable setters keep the
  // handlers stable, dodging RNW's stale pointerleave capture.
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);

  const buttonContent = buildButtonContent({
    loading,
    reduce,
    labelClass: appearance.labelClass,
    children,
    leftAdornment,
    rightAdornment,
    spinnerColor,
    labelClassName,
  });

  return (
    <MotiView
      animate={pressAnimate({ pressed, blocked: reduce || isDisabled, pressMode, pressScale })}
      transition={pressSpring}
      className={cn(boxShadow && radiusClass, fitWidth && 'w-full', className)}
      // The drop-shadow (and its coloured ring) live here on the wrapper: the
      // Pressable clips its own overflow for the gloss/rim, which would also clip
      // a shadow. The radiusClass keeps the ring aligned with the chip curve. The
      // gray plate also rides its fill here (with the inset sheen) so the inset
      // shadow paints over it instead of being hidden by the Pressable.
      style={[boxShadow ? { boxShadow } : null, wrapperBackground ? { backgroundColor: wrapperBackground } : null, style]}
    >
      <Pressable
        accessibilityRole="button"
        aria-disabled={Boolean(isDisabled)}
        aria-busy={Boolean(loading)}
        accessibilityLabel={accessibilityLabel}
        testID={testID ?? 'elevated-button'}
        disabled={isDisabled}
        onLayout={onLayout}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        className={cn(containerClass, contentClassName)}
      >
        {/* State backdrop — animates in/out by opacity so the fill shows through
            when idle and the state colour fills it on success/error. */}
        <MotiView
          animate={{ opacity: backdropColor === undefined ? 0 : 1 }}
          transition={TIMING_BASE}
          style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor ?? 'transparent', pointerEvents: 'none' }]}
        />
        {/* Gloss + rim highlights sit above the fill but below the label so the
            text stays crisp; both are pointer-transparent. */}
        {showHighlights ? (
          <ElevatedHighlights id={gradientId} hovered={hovered} radiusClass={radiusClass} width={dims.w} height={dims.h} />
        ) : null}
        {buttonContent}
        {ripple && !reduce ? (
          <ButtonRipples ripples={ripples} filled={variant !== 'white' && variant !== 'gray'} zIndex={RIPPLE_Z} />
        ) : null}
      </Pressable>
    </MotiView>
  );
}

/**
 * Rest-state label/icon colour for an elevated variant, resolved from the same
 * table the loading spinner uses so a consumer that renders its own content
 * (e.g. StatefulButton's animated label + icons) matches the chip exactly. Pass
 * `disabled` to get the muted-plate colour a flattened chip would show.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: colour helper shares the elevated variant tables with the component; splitting it out would fragment tightly-coupled styling
export function elevatedContentColor(
  variant: ElevatedVariant,
  disabled: boolean,
  colors: ReturnType<typeof useThemeColors>,
): string {
  return spinnerColorFor(variant, disabled, colors);
}
