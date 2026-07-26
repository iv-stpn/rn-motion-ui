/** biome-ignore-all lint/style/noExcessiveLinesPerFile: self-contained glossy-key component — the OKLCH lighting derivation, the variant face table, the SVG dome and the component read best in one file */
import { useCallback, useId, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useHoverCapable } from '../../hooks/use-hover-capable';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { compositeOver, cssColorToOklch, oklchToSrgb } from '../../lib/color';
import { MotiView } from '../../moti/components/view';
import { MOTION_SNAPPY, mergeTransition, TIMING_BASE, TIMING_FAST, TIMING_INSTANT } from '../../theme/motion';
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
 * Physically-lit key: a face stacked with absolutely-positioned effect layers
 * that together read as a domed, back-lit key.
 *
 * ## One colour in, every layer out
 *
 * Nothing in the stack is hand-tuned per variant. A key is defined by a single
 * opaque *base* colour, and every layer — cast shadow, hover tint, bevel
 * spotlights, dome gradient, rim — is derived from it in OKLCH by
 * {@link glossyLighting}: the shadow is the face at 20% lightness with chroma
 * pushed 20% (so a violet key casts a violet shadow), the rim is the face 0.2
 * lightness down, the hover tint 0.1 down, the spotlights a near-white at the
 * face's own hue.
 *
 * This is the React Native equivalent of the web source's relative colour
 * syntax — `oklch(from var(--bg-button) calc(l - 0.1) c h)` — which RN has no
 * parser for, so lib/color.ts does the arithmetic instead. The upshot is that
 * pointing a key at a new colour is a one-liner: `<GlossyButton color="#7c3aed">`
 * gets a violet shadow, rim, sheen and press tint in the right proportions,
 * with no table to extend and no variant to add.
 *
 * ## The page lights the key; extreme faces opt out
 *
 * Which treatment a key takes — light (dark tint, black dome, a solid derived
 * rim) or dark (light tint, white dome, a translucent sheen rim) — follows the
 * page, the same signal the web source's `light-dark()` reads. A vivid key is
 * no exception: on a dark page `info` gets the near-white sheen rim, not a navy
 * ring around a blue fill.
 *
 * The one exception is a face pinned against its page, which the built-in
 * plates and a fixed `color` both produce. There the page's branch paints a rim
 * the face swallows: a 32%-white sheen disappears into a white plate, and
 * `calc(l - 0.2)` on a near-black face clamps to rgb(0,0,0). Faces past
 * {@link SHEEN_LOST_ABOVE} or {@link SHADE_LOST_BELOW} therefore take the other
 * branch, which is what lets `white` stay white-with-ink on a dark page and
 * `dark` stay dark-with-sheen on a light one. Everything between the cutoffs
 * simply follows the page.
 *
 * ## The layer stack
 *
 *   1. interaction — hover/press tint, ramps *up* on hover and press. Hover-
 *      capable pointers only; touch devices dim the whole key on press instead
 *      (the web `[@media(hover:none)]:active:opacity-80` fallback).
 *   2. lifted — cast shadow + bevel spotlights, snap to 0 while pressed (the
 *      key sinks into the page). Split across the Pressable boundary: the
 *      inset bevel paints inside it, while the outer cast shadow rides a
 *      sibling behind it so the Pressable's overflow clip (needed to round the
 *      tint/gradient/ripples) can't eat the blur. Both fade in lockstep.
 *   3. dome + rim — constant. An SVG gradient curves the face (RN has no CSS
 *      gradients) and an inset hairline shadow paints the rim over it, keeping
 *      the edge crisp. Persists while pressed and disabled.
 *
 * The layers stack at explicit ascending zIndex (FX_Z) with the label above
 * them all — the web source's DOM-order painting plus its `z-10` label.
 */

/**
 * Face colour for a GlossyButton. Every value keeps the full glossy treatment;
 * the variant only chooses the base colour the treatment is derived from.
 *
 * `neutral` is the signature translucent face (the page, seen through glass);
 * the four status values fill with their vivid theme tokens; `white`, `gray`
 * and `dark` are fixed plates pinned in both schemes. Pass `color` instead for
 * any colour outside this set.
 */
// biome-ignore lint/style/useExportsLast: declared up top so the face table below can key off it; kept with its doc comment for readability
export type GlossyVariant = 'neutral' | 'danger' | 'success' | 'warning' | 'info' | 'white' | 'gray' | 'dark';

type StatusVariant = Exclude<GlossyVariant, 'neutral' | 'white' | 'gray' | 'dark'>;

type ThemeColors = ReturnType<typeof useThemeColors>;

// Foreground token per status variant — the designed partner for the vivid
// fill, used for the label, adornment icons and the loading spinner. Status
// keys keep their token pair rather than a derived contrast colour: the pairing
// is a design decision, not a luminance calculation.
const GLOSSY_FOREGROUND_TOKEN: Record<StatusVariant, ThemeToken> = {
  danger: 'danger-foreground',
  success: 'success-foreground',
  warning: 'warning-foreground',
  info: 'info-foreground',
};

// ── fixed plates (theme-exempt: pinned colours, not tokens) ──────────────────

// `white` is pinned in both schemes: a white key is white, on a light page and
// a dark one. It used to ride `bg-surface-3` + `text-muted-foreground`, both of
// which flip with the theme — so on a dark page the "white" key rendered as a
// charcoal plate with a pale grey label. Pinning the plate makes it white, and
// being past SHEEN_LOST_ABOVE it opts out of the page's dark branch, so it
// keeps the light treatment (ink label, dark rim) on a dark page.
const WHITE_FILL = 'rgb(255, 255, 255)'; /* theme-exempt: pinned white plate */
// Light-theme `muted-foreground` — oklch(0.5 0.004 270), pinned like the plate.
const WHITE_CONTENT = 'rgb(98, 99, 102)'; /* theme-exempt: pinned muted label */

// The gray plate mirrors ElevatedButton's Geist-style secondary: a fixed light
// fill + mid-grey label, pinned in both schemes by design.
const GRAY_FILL = 'rgb(242, 242, 242)'; /* theme-exempt: fixed Geist plate */
const GRAY_CONTENT = 'rgb(112, 112, 112)'; /* theme-exempt: fixed muted label */

// `neutral`'s glass: a white lift over whatever the page is. The only face that
// stays translucent, and so the only one that reads the page scheme.
const NEUTRAL_GLASS_LIGHT = 'rgba(255, 255, 255, 0.72)'; /* theme-exempt: light glass */
const NEUTRAL_GLASS_DARK = 'rgba(255, 255, 255, 0.06)'; /* theme-exempt: dark glass */

// `dark` is the dark-scheme key pinned in both themes. Its plate is literally
// what `neutral` composites to on a dark page — the same glass over dark
// `surface-1` — so the two are indistinguishable in the dark theme while `dark`
// stays a dark key on a light one. Computed rather than hand-baked so it can't
// drift from the glass above.
const DARK_PAGE = 'rgb(22, 23, 25)'; /* theme-exempt: dark surface-1, oklch(0.205 0.004 270) */
const DARK_FILL = compositeOver(NEUTRAL_GLASS_DARK, DARK_PAGE);
// Dark-theme `foreground` — oklch(0.94 0.004 270), pinned like the plate.
const DARK_CONTENT = 'rgb(234, 235, 238)'; /* theme-exempt: pinned dark label */

// ── lighting derivation (theme-exempt: physical lighting, not tokens) ────────

/** Every colour the effect stack paints, all derived from one base face. */
type GlossyLighting = {
  /** Whether the face took the dark treatment — also picks the ripple shimmer. */
  dark: boolean;
  /** Interaction tint colour and its hover/press layer opacities. */
  tint: string;
  tintHover: number;
  tintPress: number;
  /** Inset bevel shadows — one list, all fading together as the key sinks. */
  bevelShadow: string;
  /** Outer cast shadows — the drop that vanishes while the key is pressed. */
  castShadow: string;
  /** Dome gradient colour and its top/bottom stop opacities. */
  domeColor: string;
  domeTopOpacity: number;
  domeBottomOpacity: number;
  /** Rim hairline drawn inside the radius on top of the dome. */
  rimShadow: string;
};

// A key is lit by its page — a light page casts dark rims and shadows, a dark
// page catches light sheens — which is what the web source's `light-dark()`
// selects on. A vivid key follows the page like everything else: `info` gets
// the near-white sheen rim on a dark page, not a navy ring around a blue fill.
//
// The exception is a face pinned *against* its page: a white plate on a dark
// page, an ink one on a light page. There the page's own branch paints a rim
// the face swallows whole — a 32%-white sheen on white, or `calc(l - 0.2)` on
// something already near-black (which clamps to rgb(0,0,0)) — leaving the key
// flat with no visible edge and no hover shift. Only those faces take the
// opposite branch, and that is what lets `white` stay white in both themes.
// Everything between the two cutoffs simply follows the page.
const MID_LIGHTNESS = 0.5;
const SHEEN_LOST_ABOVE = 0.85;
const SHADE_LOST_BELOW = 0.3;

/** Whether a face takes the dark (sheen) treatment rather than the light one. */
function usesDarkLighting(faceLightness: number, pageDark: boolean): boolean {
  if (pageDark) return faceLightness <= SHEEN_LOST_ABOVE;
  return faceLightness < SHADE_LOST_BELOW;
}

// Relative-colour offsets, lifted verbatim from the web source's `oklch(from …)`
// expressions so the two implementations stay in step.
const TINT_LIGHTNESS_DROP = 0.1; // light: calc(l - 0.1)
const TINT_LIGHTNESS_LIFT = 0.15; // dark:  calc(l + 0.15)
const TINT_DARK_ALPHA = 0.7;
const RIM_LIGHTNESS_DROP = 0.2; // light: calc(l - 0.2)
const RIM_CHROMA_SCALE = 0.75; // light: calc(c * 0.75)
const RIM_DARK_ALPHA = 0.32;
// The one deliberate divergence from the web source, which spends a full
// `var(--border-default)` here. A half-pixel rim is a crisp hairline on the
// retina displays these keys are designed for, and a full pixel reads as a
// drawn border rather than a lit edge. Keep it at 0.5px.
const RIM_WIDTH = '0.5px';
const SHADOW_LIGHTNESS = 0.2;
const SHADOW_CHROMA_BOOST = 1.2; // calc(c * 1.2) — the drop keeps the face's hue
const SHADOW_LIGHT_ALPHA = 0.12;
const SHADOW_DARK_ALPHA = 0.24;
// The spotlights are a near-white carrying the face's hue, so a coloured key
// gets a coloured sheen instead of a grey one.
const SPOTLIGHT_LIGHTNESS = 0.98;
const SPOTLIGHT_CHROMA = 0.01;

// Pure white / black — physical lighting, unrelated to the face's hue.
const SHEEN = '#ffffff';
const SHADE = '#000000';
const DOME_OPACITY = 0.08;
const EDGE_SHEEN = 'rgba(255, 255, 255, 0.08)';
const EDGE_SHADE = 'rgba(0, 0, 0, 0.16)';

// Stand-in for a face this library can't parse (a named CSS colour, say). White
// is the safest guess: it yields the light treatment, which is legible over the
// widest range of real faces.
const FALLBACK_FACE = { lightness: 1, chroma: 0, hue: 0 };

/** The light treatment: a dark tint, a solid derived rim, the dome darkening downward. */
function lightLighting(lightness: number, chroma: number, hue: number): GlossyLighting {
  const spotlight = (alpha: number) => oklchToSrgb(SPOTLIGHT_LIGHTNESS, SPOTLIGHT_CHROMA, hue, alpha);
  const drop = oklchToSrgb(SHADOW_LIGHTNESS, chroma * SHADOW_CHROMA_BOOST, hue, SHADOW_LIGHT_ALPHA);
  return {
    dark: false,
    tint: oklchToSrgb(lightness - TINT_LIGHTNESS_DROP, chroma, hue),
    tintHover: 0.4,
    tintPress: 0.64,
    // Ordered front-to-back — the first shadow in a list paints on top — so the
    // half-pixel edge accents sit over the 1px spotlights, mirroring the web
    // source's secondary-spotlight layer stacking above the primary one.
    bevelShadow: [
      `inset 0 0.5px 0 0 ${EDGE_SHEEN}`,
      `inset 0 -0.5px 0 0 ${EDGE_SHADE}`,
      `inset 0 1px 0 0 ${spotlight(0.16)}`,
      `inset 0 -1px 0 0 ${spotlight(0.08)}`,
    ].join(', '),
    castShadow: `0 2px 2px -1px ${drop}, 0 4px 4px -2px ${drop}`,
    domeColor: SHADE,
    domeTopOpacity: 0,
    domeBottomOpacity: DOME_OPACITY,
    rimShadow: `inset 0 0 0 ${RIM_WIDTH} ${oklchToSrgb(lightness - RIM_LIGHTNESS_DROP, chroma * RIM_CHROMA_SCALE, hue)}`,
  };
}

/** The dark treatment: a light tint, a translucent sheen rim, the dome lightening upward. */
function darkLighting(lightness: number, chroma: number, hue: number): GlossyLighting {
  const spotlight = (alpha: number) => oklchToSrgb(SPOTLIGHT_LIGHTNESS, SPOTLIGHT_CHROMA, hue, alpha);
  const drop = oklchToSrgb(SHADOW_LIGHTNESS, chroma * SHADOW_CHROMA_BOOST, hue, SHADOW_DARK_ALPHA);
  return {
    dark: true,
    tint: oklchToSrgb(lightness + TINT_LIGHTNESS_LIFT, chroma, hue, TINT_DARK_ALPHA),
    tintHover: 0.4,
    tintPress: 0.8,
    // No 1px spotlights on a dark key: the dome gradient and rim carry the
    // highlight, so only the half-pixel accents remain.
    bevelShadow: `inset 0 0.5px 0 0 ${spotlight(0.16)}, inset 0 -0.5px 0 0 ${spotlight(0.08)}`,
    castShadow: `0 2px 2px -1px ${drop}, 0 4px 4px -2px ${drop}`,
    domeColor: SHEEN,
    domeTopOpacity: DOME_OPACITY,
    domeBottomOpacity: 0,
    rimShadow: `inset 0 0 0 ${RIM_WIDTH} ${spotlight(RIM_DARK_ALPHA)}`,
  };
}

/** Derive the whole effect stack from one opaque face colour, lit by its page. */
function glossyLighting(base: string, pageDark: boolean): GlossyLighting {
  const { lightness, chroma, hue } = cssColorToOklch(base) ?? FALLBACK_FACE;
  return usesDarkLighting(lightness, pageDark) ? darkLighting(lightness, chroma, hue) : lightLighting(lightness, chroma, hue);
}

// ── face resolution ─────────────────────────────────────────────────────────

/** The colour a key paints, and the opaque colour its lighting derives from. */
type GlossyFace = {
  /** Painted on the Pressable — translucent for `neutral`'s glass. */
  paint: string;
  /** What every layer derives from: `paint` flattened over the page, so a
   *  translucent face derives from the colour actually seen, not from white. */
  base: string;
  /** Label, adornment-icon and spinner colour. */
  content: string;
};

// Label contrast for a face with no designed foreground partner. OKLCH
// lightness tracks perceived brightness closely enough that one threshold picks
// the legible side; 0.65 keeps white on mid-tone fills and flips to ink only
// once the face is genuinely light.
const CONTENT_LIGHTNESS_SWITCH = 0.65;
const CONTENT_ON_DARK: string = 'rgb(255, 255, 255)'; /* theme-exempt: contrast pick */
const CONTENT_ON_LIGHT: string = 'rgb(23, 23, 23)'; /* theme-exempt: contrast pick */

/** Legible label colour for a face, by its lightness. */
function contentOn(base: string): string {
  const { lightness } = cssColorToOklch(base) ?? FALLBACK_FACE;
  return lightness < CONTENT_LIGHTNESS_SWITCH ? CONTENT_ON_DARK : CONTENT_ON_LIGHT;
}

/**
 * Whether the page is dark, read from the resolved `surface-1` token — the
 * colour the page actually paints, which is what the lighting is reacting to.
 *
 * Reading a token rather than `useColorScheme()` is deliberate: the latter only
 * tracks the OS media query and would miss class-based theming on web (a manual
 * `.dark` on `<html>`, which is how the Storybook toolbar and most app toggles
 * switch themes), while `useThemeColors()` tracks both.
 */
function isPageDark(colors: ThemeColors): boolean {
  const page = cssColorToOklch(colors['surface-1']);
  return page !== null && page.lightness < MID_LIGHTNESS;
}

/** Resolve the `color` / `variant` axis down to a face. `color` wins. */
function resolveFace(variant: GlossyVariant, color: string | undefined, colors: ThemeColors, pageDark: boolean): GlossyFace {
  const page = colors['surface-1'];
  if (color !== undefined) {
    // A translucent custom colour is honoured as glass, exactly like `neutral`.
    const base = compositeOver(color, page);
    return { paint: color, base, content: contentOn(base) };
  }
  if (variant === 'white') return { paint: WHITE_FILL, base: WHITE_FILL, content: WHITE_CONTENT };
  if (variant === 'gray') return { paint: GRAY_FILL, base: GRAY_FILL, content: GRAY_CONTENT };
  if (variant === 'dark') return { paint: DARK_FILL, base: DARK_FILL, content: DARK_CONTENT };
  if (variant === 'neutral') {
    const glass = pageDark ? NEUTRAL_GLASS_DARK : NEUTRAL_GLASS_LIGHT;
    return { paint: glass, base: compositeOver(glass, page), content: colors.foreground };
  }
  const fill = colors[variant];
  return { paint: fill, base: fill, content: colors[GLOSSY_FOREGROUND_TOKEN[variant]] };
}

// ── layout ──────────────────────────────────────────────────────────────────

// Web sizing: `sm` is `h-8 px-2.5 text-sm`, `md` `h-9 px-5 text-[17px]`, `lg`
// `h-11 px-6 text-[17px]`, all on a fixed `rounded-xl`. The family-only `icon`
// squares the md height. Spelled per shape so no two classes ever compete for
// the same cn group.
const CONTAINER: Record<ButtonShape, Record<ButtonSize, string>> = {
  rounded: {
    sm: 'h-8 rounded-xl px-2.5',
    md: 'h-9 rounded-xl px-5',
    lg: 'h-11 rounded-xl px-6',
    icon: 'h-9 w-9 rounded-xl',
  },
  pill: {
    sm: 'h-8 rounded-full px-2.5',
    md: 'h-9 rounded-full px-5',
    lg: 'h-11 rounded-full px-6',
    icon: 'h-9 w-9 rounded-full',
  },
};

// Pixel radii mirroring CONTAINER's rounded-* classes — every effect layer must
// follow the same curve as the Pressable.
const SIZE_HEIGHT: Record<ButtonSize, number> = { sm: 32, md: 36, lg: 44, icon: 36 };
const ROUNDED_XL_RADIUS = 12;
function cornerRadius(shape: ButtonShape, size: ButtonSize): number {
  return shape === 'pill' ? SIZE_HEIGHT[size] / 2 : ROUNDED_XL_RADIUS;
}

// Web keeps the 17px label at md/lg; only sm steps down to text-sm. The colour
// no longer comes from a class — it's derived per face, so it arrives as an
// inline style on the label instead.
function labelClass(size: ButtonSize): string {
  return cn('font-normal', size === 'sm' ? 'text-sm' : 'text-[17px]');
}

type InteractionState = { flatten: boolean; hoverCapable: boolean; pressed: boolean; hovered: boolean };

/** Interaction-tint opacity: hover-capable pointers only (touch devices get the
 *  whole-key dim instead), hidden while flattened, press beating hover. */
function tintOpacity(lighting: GlossyLighting, { flatten, hoverCapable, pressed, hovered }: InteractionState): number {
  if (flatten || !hoverCapable) return 0;
  if (pressed) return lighting.tintPress;
  if (hovered) return lighting.tintHover;
  return 0;
}

/** Whole-key opacity: the web disabled dim, or the touch-press dim on devices
 *  that can't hover (where the tint layer never shows). */
function keyOpacity({ flatten, hoverCapable, pressed }: InteractionState): 0.5 | 0.8 | 1 {
  if (flatten) return 0.5;
  if (pressed && !hoverCapable) return 0.8;
  return 1;
}

// Explicit stacking ladder mirroring the web source: fx layers at ascending
// zIndex in their DOM order (interaction < lifted < dome+rim), the label above
// them all (the web `z-10`), family ripples topmost. Child order alone would
// paint the same way; the explicit indices pin the stack so no layer can drift.
const FX_Z = { interaction: 1, lifted: 2, domeRim: 3, label: 10, ripples: 20 } as const;

type GlossyDomeRimProps = { id: string; radius: number; lighting: GlossyLighting };

// The constant third layer: the dome gradient (SVG — RN has no CSS gradients)
// clipped to the face, with the rim hairline painted over it as an inset spread
// shadow so the edge stays crisp at any radius. The web fuses both into one
// span (an inset shadow paints above its own background); RN children paint
// above a parent's inset shadow, so the SVG can't live inside the shadow view —
// two siblings at the same zIndex reproduce the compositing.
function GlossyDomeRim({ id, radius, lighting }: GlossyDomeRimProps) {
  return (
    <>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', zIndex: FX_Z.domeRim }]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={`${id}-dome`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lighting.domeColor} stopOpacity={lighting.domeTopOpacity} />
              <Stop offset="1" stopColor={lighting.domeColor} stopOpacity={lighting.domeBottomOpacity} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-dome)`} />
        </Svg>
      </View>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: lighting.rimShadow, zIndex: FX_Z.domeRim }]}
      />
    </>
  );
}

export interface GlossyButtonProps extends BaseButtonProps {
  /** Face colour from the built-in set: `neutral` (default) is the translucent
   *  key, the status values fill with their theme tokens, and `white` / `gray` /
   *  `dark` are fixed plates pinned in both schemes. Ignored when `color` is set. */
  variant?: GlossyVariant;
  /**
   * Paint the key any colour. The whole effect stack — shadow, rim, sheen,
   * hover tint — is re-derived from it in OKLCH, and the label picks the
   * legible side automatically, so no variant needs to exist for it.
   *
   * Takes hex, `rgb()`/`rgba()` and `oklch()`; a translucent value is treated
   * as glass and derives from what it composites to over the page. Named CSS
   * colours (`'rebeccapurple'`) can't be parsed and fall back to the light
   * treatment — pass those as hex.
   *
   * @example
   * <GlossyButton color="#7c3aed">Upgrade</GlossyButton>
   * <GlossyButton color={colors.primary}>Save</GlossyButton>
   */
  color?: string;
  /** Override the derived label/icon/spinner colour. */
  contentColor?: string;
  size?: ButtonSize;
  shape?: ButtonShape;
}

export function GlossyButton({
  variant = 'neutral',
  color,
  contentColor,
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
  // The press feedback IS the sink (shadow drop + tint / touch dim), so the
  // key doesn't also shrink by default — pass a pressScale to opt in.
  pressScale = 1,
  backdropColor,
  pressTransition,
  fitWidth,
  className,
  labelClassName,
  contentStyle,
  style,
  accessibilityLabel,
  testID,
}: GlossyButtonProps) {
  const reduce = useReducedMotion();
  const colors = useThemeColors();
  const hoverCapable = useHoverCapable();
  const pageDark = isPageDark(colors);
  const face = resolveFace(variant, color, colors, pageDark);
  // Deriving the stack runs a dozen gamut-mapped OKLCH conversions, and hover
  // and press both re-render — so it's keyed on the inputs, not the render.
  const lighting = useMemo(() => glossyLighting(face.base, pageDark), [face.base, pageDark]);
  const content = contentColor ?? face.content;
  const pressSpring = mergeTransition(MOTION_SNAPPY, pressTransition);
  const fade = reduce ? TIMING_INSTANT : TIMING_FAST;
  const [hovered, setHovered] = useState(false);
  const isDisabled = Boolean(disabled || loading);
  // Two axes, mirroring ElevatedButton: `isDisabled` blocks interaction, while
  // `flatten` sinks the key (lifted layers to 0, tint hidden, whole key at half
  // opacity — the web disabled treatment). `noDisabledOpacity` splits them so a
  // non-interactive key (e.g. StatefulButton mid-machine) keeps its lifted look.
  const flatten = isDisabled && !noDisabledOpacity;

  // SVG gradient ids must be unique per instance (they land in one shared
  // document on web). useId can emit ':' which is illegal in url(#…), so strip it.
  const gradientId = useId().replace(/:/g, '');
  const radius = cornerRadius(shape, size);

  const { pressed, ripples, onLayout, handlePressIn, handlePressOut } = usePressRipples({
    ripple,
    reduce,
    trackDims: false,
  });
  // Stable setters keep the handlers stable, dodging RNW's stale pointerleave capture.
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);

  // The key sinks: both lifted layers snap to 0 while pressed or flattened.
  const lifted = pressed || flatten ? 0 : 1;
  const interaction: InteractionState = { flatten, hoverCapable, pressed, hovered };

  const buttonContent = buildButtonContent({
    loading,
    reduce,
    labelClass: labelClass(size),
    labelColor: content,
    spacious: false,
    children,
    leftAdornment,
    rightAdornment,
    spinnerColor: content,
    labelClassName,
  });

  return (
    <MotiView
      animate={{ scale: pressed && !reduce && !isDisabled ? pressScale : 1, opacity: keyOpacity(interaction) }}
      // Scale keeps the family press spring; opacity cross-fades on the same
      // clock as the effect layers so the touch dim and the sink move together.
      transition={{ ...pressSpring, opacity: fade }}
      className={cn(fitWidth && 'w-full', className)}
      style={style}
    >
      {/* Cast shadow — behind the Pressable so its overflow clip (which rounds
          the tint/gradient/ripples) can't eat the blur; outer shadows paint
          outside the layer's bounds, and the unclipped wrapper lets them. */}
      <MotiView
        animate={{ opacity: lifted }}
        transition={fade}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: lighting.castShadow }]}
      />
      <Pressable
        accessibilityRole="button"
        aria-disabled={isDisabled}
        aria-busy={Boolean(loading)}
        accessibilityLabel={accessibilityLabel}
        testID={testID ?? 'glossy-button'}
        disabled={isDisabled}
        onLayout={onLayout}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        className={cn('flex-row items-center justify-center', CONTAINER[shape][size])}
        style={[{ overflow: 'hidden', backgroundColor: face.paint }, contentStyle]}
      >
        {/* State backdrop — animates in/out by opacity so the face shows through
            when idle and the state colour fills it on success/error. */}
        <MotiView
          animate={{ opacity: backdropColor === undefined ? 0 : 1 }}
          transition={TIMING_BASE}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor ?? 'transparent' }]}
        />
        {/* Hover/press tint — the face itself, darkened on a light key and
            lightened on a dark one, so the shift keeps the key's own hue. */}
        <MotiView
          animate={{ opacity: tintOpacity(lighting, interaction) }}
          transition={fade}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: lighting.tint, zIndex: FX_Z.interaction }]}
        />
        {/* Bevel — the inset half of the lifted read; inset shadows paint within
            the layer, so the Pressable's clip never touches them. */}
        <MotiView
          animate={{ opacity: lifted }}
          transition={fade}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: lighting.bevelShadow, zIndex: FX_Z.lifted }]}
        />
        <GlossyDomeRim id={gradientId} radius={radius} lighting={lighting} />
        {/* Label above every fx layer (the web `z-10` span, with its px-0.5). */}
        <View style={{ zIndex: FX_Z.label, paddingHorizontal: 2 }}>{buttonContent}</View>
        {ripple && !reduce ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: FX_Z.ripples }]}>
            {/* White shimmer over a dark face, dark shimmer over a light one —
                the same split the lighting already made. */}
            <ButtonRipples ripples={ripples} filled={lighting.dark} />
          </View>
        ) : null}
      </Pressable>
    </MotiView>
  );
}

/**
 * Rest-state label/icon colour for a glossy key, resolved exactly the way the
 * component resolves it, so a consumer rendering its own content (adornment
 * icons, say) matches the key. Pass the same `color` you passed the button to
 * get the derived contrast colour for a custom face.
 *
 * There is no disabled axis: a disabled glossy key dims whole rather than
 * recolouring its label.
 *
 * @example
 * <GlossyButton color="#7c3aed" leftAdornment={<Download color={glossyContentColor('neutral', colors, '#7c3aed')} />}>
 */
// biome-ignore lint/style/useComponentExportOnlyModules: colour helper shares the face-resolution table with the component; splitting it out would fragment tightly-coupled styling
export function glossyContentColor(variant: GlossyVariant, colors: ThemeColors, color?: string): string {
  return resolveFace(variant, color, colors, isPageDark(colors)).content;
}
