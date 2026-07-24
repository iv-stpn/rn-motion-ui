/** biome-ignore-all lint/style/noExcessiveLinesPerFile: self-contained elevated-chip component — colour tables, shadow maths, SVG highlights and the component read best in one file */
import { useCallback, useId, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { MotiView } from '../../moti/components/view';
import { MOTION_SNAPPY, mergeTransition, TIMING_BASE } from '../../theme/motion';
import { type ThemeToken, useThemeColors } from '../../theme/use-theme-color';
import {
  type BaseButtonProps,
  ButtonRipples,
  type ButtonShape,
  type ButtonSize,
  buildButtonContent,
  usePressRipples,
} from './button-internals';

/**
 * Fill colour + surface style for an ElevatedButton. Most values get the glossy
 * treatment (top-down white sheen + a 1px rim highlight + a drop shadow with a
 * crisp coloured ring). Two are flat plates instead: `white` (light surface,
 * muted label, 1px border, darkening and dropping its shadow on hover) and
 * `gray` (a Geist-style secondary plate — a fixed #F2F2F2 fill, #707070 label, a
 * 1px neutral ring plus a hairline white top sheen, no gloss and no hover shift).
 */
// biome-ignore lint/style/useExportsLast: declared up top so the colour tables below can key off it; kept with its doc comment for readability
export type ElevatedVariant = 'neutral' | 'danger' | 'success' | 'warning' | 'info' | 'white' | 'gray';

// A glossy filled chip (or, for `white`/`gray`, a flat plate). Everything colour-
// dependent is resolved from `variant` here so one component covers every hue
// plus the two plate styles.

// Background class per variant. `neutral` reuses the monochrome `primary` token
// (near-black on light, near-white on dark). Spelled as literals so the
// uniwind/Tailwind scanner registers each class.
const ELEVATED_BG: Record<Exclude<ElevatedVariant, 'white' | 'gray'>, string> = {
  neutral: 'bg-primary',
  danger: 'bg-danger',
  success: 'bg-success',
  warning: 'bg-warning',
  info: 'bg-info',
};

// Label colour class per variant. Coloured fills are vivid, so their
// `*-foreground` (white) partner reads on top; neutral uses `primary-foreground`.
const ELEVATED_LABEL: Record<Exclude<ElevatedVariant, 'white' | 'gray'>, string> = {
  neutral: 'text-primary-foreground',
  danger: 'text-danger-foreground',
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
  info: 'text-info-foreground',
};

// Foreground token per variant — drives the loading spinner stroke so it matches
// the label on the filled chip.
const ELEVATED_FOREGROUND_TOKEN: Record<Exclude<ElevatedVariant, 'white' | 'gray'>, ThemeToken> = {
  neutral: 'primary-foreground',
  danger: 'danger-foreground',
  success: 'success-foreground',
  warning: 'warning-foreground',
  info: 'info-foreground',
};

// Fill token per variant — resolved to sRGB for the drop shadow: the 1px ring is
// the fill itself and the shadow tint is the fill darkened toward black.
const ELEVATED_FILL_TOKEN: Record<Exclude<ElevatedVariant, 'white' | 'gray'>, ThemeToken> = {
  neutral: 'primary',
  danger: 'danger',
  success: 'success',
  warning: 'warning',
  info: 'info',
};

// The white stroke plate: light surface + muted label at rest; on hover it
// darkens to the weak surface and the label goes strong (mirrors the web
// `hover:bg-bg-weak-50 hover:text-text-strong-950`).
const WHITE_BG_REST = 'bg-surface-3';
const WHITE_BG_HOVER = 'bg-muted';
const WHITE_LABEL_REST = 'text-muted-foreground';
const WHITE_LABEL_HOVER = 'text-foreground';

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
const GRAY_SHADOW = '0px 0px 0px 1px rgba(61,61,61,0.12), inset 0px 0.75px 0.75px 0px rgba(255,255,255,0.64)';

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

// AlignUI sizing: the 40px chip rounds to 10px and pads 14px (`medium`:
// `h-10 gap-3 rounded-10 px-3.5`), the 32px chip rounds to 8px and pads 10px
// (`xsmall`: `h-8 gap-3 rounded-lg px-2.5`). The repo-only `lg` extrapolates
// that scale to 12px/16px. Every size keeps AlignUI's `gap-3` (12px); icons are
// pulled back in by `-mx-1` inside buildButtonContent. Spelled per shape so no
// two classes ever compete for the same cn group.
const CONTAINER: Record<ButtonShape, Record<ButtonSize, string>> = {
  rounded: {
    sm: 'h-8 gap-3 rounded-lg px-2.5',
    md: 'h-10 gap-3 rounded-[10px] px-3.5',
    lg: 'h-12 gap-3 rounded-xl px-4',
    icon: 'h-8 w-8 rounded-lg',
  },
  pill: {
    sm: 'h-8 gap-3 rounded-full px-2.5',
    md: 'h-10 gap-3 rounded-full px-3.5',
    lg: 'h-12 gap-3 rounded-full px-4',
    icon: 'h-8 w-8 rounded-full',
  },
};

// Pixel radii mirroring CONTAINER's rounded-* classes — the SVG rim and the
// wrapper's shadow ring must follow the same curve as the Pressable.
const SIZE_HEIGHT: Record<ButtonSize, number> = { sm: 32, md: 40, lg: 48, icon: 32 };
const ROUNDED_RADIUS: Record<ButtonSize, number> = { sm: 8, md: 10, lg: 12, icon: 8 };
function cornerRadius(shape: ButtonShape, size: ButtonSize): number {
  return shape === 'pill' ? SIZE_HEIGHT[size] / 2 : ROUNDED_RADIUS[size];
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
 * web: a soft 1px-blur shadow at 48% plus a crisp 1px ring. Neutral and white
 * cast a dark-neutral shadow (`rgba(27,28,29,.48)`); vivid fills tint the shadow
 * with the fill darkened toward black (AlignUI derives e.g. `#253ea7` from
 * primary `#375dfb`). The ring is the fill itself, or the theme border for
 * `white`. `boxShadow` composes both layers in one value (web and native ≥ 0.76
 * New Arch).
 */
function elevatedShadow(variant: ElevatedVariant, fill: string, borderColor: string): string {
  if (variant === 'white') return `0 1px 3px 0 rgba(14,18,27,0.12),0 0 0 1px ${borderColor}`;

  const [red, green, blue] = parseRgb(fill);
  if (variant === 'neutral') return `0px 1px 2px 0px rgba(27,28,29,0.48), 0px 0px 0px 1px rgba(${red},${green},${blue},1)`;

  const darken = (c: number) => Math.round(c * 0.7);
  return `0px 1px 2px 0px rgba(${darken(red)},${darken(green)},${darken(blue)},0.48), 0px 0px 0px 1px rgba(${red},${green},${blue},1)`;
}

type ElevatedAppearance = {
  containerClass: string;
  labelClass: string;
  spinnerColor: string;
  /** Render the gloss + rim SVG highlights (coloured fills only, not disabled). */
  showHighlights: boolean;
  /** Corner radius shared by the wrapper so the shadow ring follows the curve. */
  radius: number;
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
    // Elevated chips carry their own AlignUI paddings/gaps/radii (CONTAINER) and
    // keep the 14px `text-label-sm` label at every size rather than stepping down.
    containerClass: cn(
      'flex-row items-center justify-center',
      CONTAINER[shape][size],
      backgroundClass(variant, hovered, isDisabled),
    ),
    labelClass: cn('text-sm font-medium', labelColorClass(variant, hovered, isDisabled)),
    spinnerColor: spinnerColorFor(variant, isDisabled, colors),
    // gray and white are flat plates — neither gets the SVG gloss/rim overlays.
    showHighlights: variant !== 'white' && variant !== 'gray' && !isDisabled,
    radius: cornerRadius(shape, size),
    boxShadow,
    wrapperBackground,
  };
}

type ElevatedHighlightsProps = { id: string; hovered: boolean; radius: number; width: number; height: number };

// The two white highlights that give a coloured elevated chip its elevated-surface
// quality, both drawn in SVG (RN has no CSS pseudo-elements/gradients).
//   • Gloss — AlignUI's `after:` overlay: a full-height top-to-bottom wash from
//     white to transparent (`bg-gradient-to-b from-static-white to-transparent`)
//     held at opacity .16, rising to .24 on hover over 200 ms ease-out. The
//     parent clips overflow so it rounds to the chip.
//   • Rim — AlignUI's `before:` overlay: a 1px inset ring stroked with the same
//     top-down gradient at .12 → 0 (`from-static-white/[.12] to-transparent`),
//     the lit-top-edge cue. Needs pixel dims for a crisp line, so waits for layout.
function ElevatedHighlights({ id, hovered, radius, width, height }: ElevatedHighlightsProps) {
  const rimInset = Math.max(0, radius - 0.5);
  return (
    <>
      <MotiView
        animate={{ opacity: hovered ? 0.24 : 0.16 }}
        transition={{ type: 'timing', duration: 200 }}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#fff" stopOpacity={1} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-gloss)`} />
        </Svg>
      </MotiView>
      {width > 0 && height > 0 ? (
        <Svg width={width} height={height} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#fff" stopOpacity={0.12} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
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
   *  a fixed Geist-style secondary plate. Defaults to `neutral`. */
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
  ripple = false,
  pressScale = 0.93,
  backdropColor,
  pressTransition,
  fitWidth,
  className,
  labelClassName,
  contentStyle,
  style,
  accessibilityLabel,
  testID,
}: ElevatedButtonProps) {
  const reduce = useReducedMotion();
  const colors = useThemeColors();
  const pressSpring = mergeTransition(MOTION_SNAPPY, pressTransition);
  const [hovered, setHovered] = useState(false);
  const isDisabled = Boolean(disabled || loading);

  // SVG gradient ids must be unique per instance (they land in one shared
  // document on web). useId can emit ':' which is illegal in url(#…), so strip it.
  const gradientId = useId().replace(/:/g, '');

  const appearance = resolveAppearance({ variant, size, shape, hovered, isDisabled, colors });
  const { containerClass, spinnerColor, showHighlights, radius, boxShadow, wrapperBackground } = appearance;

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
    spacious: true,
    children,
    leftAdornment,
    rightAdornment,
    spinnerColor,
    labelClassName,
  });

  return (
    <MotiView
      animate={{ scale: pressed && !reduce && !isDisabled ? pressScale : 1 }}
      transition={pressSpring}
      className={cn(fitWidth && 'w-full', className)}
      // The drop-shadow (and its coloured ring) live here on the wrapper: the
      // Pressable clips its own overflow for the gloss/rim, which would also clip
      // a shadow. borderRadius is shared so the ring follows the chip curve. The
      // gray plate also rides its fill here (with the inset sheen) so the inset
      // shadow paints over it instead of being hidden by the Pressable.
      style={[
        boxShadow ? { borderRadius: radius, boxShadow } : null,
        wrapperBackground ? { backgroundColor: wrapperBackground } : null,
        style,
      ]}
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
        className={containerClass}
        // No disabled dim: AlignUI disabled chips restyle to the flat muted plate
        // (grey label, no gloss/shadow) at full opacity instead of fading.
        style={[{ overflow: 'hidden' }, contentStyle]}
      >
        {/* State backdrop — animates in/out by opacity so the fill shows through
            when idle and the state colour fills it on success/error. */}
        <MotiView
          animate={{ opacity: backdropColor === undefined ? 0 : 1 }}
          transition={TIMING_BASE}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor ?? 'transparent' }]}
        />
        {/* Gloss + rim highlights sit above the fill but below the label so the
            text stays crisp; both are pointer-transparent. */}
        {showHighlights ? (
          <ElevatedHighlights id={gradientId} hovered={hovered} radius={radius} width={dims.w} height={dims.h} />
        ) : null}
        {buttonContent}
        {ripple && !reduce ? <ButtonRipples ripples={ripples} filled={variant !== 'white' && variant !== 'gray'} /> : null}
      </Pressable>
    </MotiView>
  );
}
