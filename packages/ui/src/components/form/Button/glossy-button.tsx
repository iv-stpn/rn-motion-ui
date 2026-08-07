/** biome-ignore-all lint/style/noExcessiveLinesPerFile: self-contained glossy-key component — the primitive table, the per-variant recipes, the SVG dome and the component read best in one file */
import { useCallback, useId, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useHoverCapable } from '../../../hooks/use-hover-capable';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { compositeOver, cssColorToOklch, oklchToSrgb } from '../../../lib/color';
import { MotiView } from '../../../moti/components/view';
import { MOTION_SNAPPY, mergeTransition, TIMING_BASE, TIMING_FAST, TIMING_INSTANT } from '../../../theme/motion';
import { type ThemeToken, useThemeColors } from '../../../theme/use-theme-color';
import { type BaseButtonProps, ButtonRipples, buildButtonContent, usePressRipples } from './button-internals';
import { BUTTON_BOX, type ButtonShape, type ButtonSize, buttonRadius, LABEL_TEXT_CLASS } from './button-scale';

/**
 * Physically-lit key: a face stacked with absolutely-positioned effect layers
 * that together read as a domed, back-lit key.
 *
 * ## Seven slots
 *
 * The web source builds the whole key from one `box-shadow` list of seven fixed
 * slots, and swaps that list wholesale on press for a pressed variant with the
 * same slots in the same order at the same geometry (so the swap interpolates):
 *
 *   [1][2] edge accents — hairline top/bottom, painted *over* the spotlights
 *   [3]    rim          — hairline inside the radius; the only slot that
 *                         survives the press
 *   [4][5] spotlights   — the bright bevel, 1px top/bottom
 *   [6][7] casts        — contact + ambient drop, outside the box
 *
 * plus a dome gradient over the face and an interaction tint over that. Only
 * the *colours* of those slots vary — by theme and by variant — which is what
 * lets one recipe serve every variant in both schemes.
 *
 * {@link GlossyPrimitives} is that slot table, one entry per `--btn-*` custom
 * property in the web source. Reanimated can't interpolate `boxShadow`, so
 * rather than swapping two lists this port splits the slots across layers and
 * animates their *opacity* instead — same destination, different vehicle.
 *
 * ## Three recipe families
 *
 * - `neutral` and `inverse` are hand-authored light/dark pairs, transcribed
 *   from the web source. Both faces flip with the page on their own (glass, and
 *   `foreground`), so they branch on the page and nothing else.
 * - every other face — the status tokens, the `gray` plate, and any `color` a
 *   consumer passes — runs the *derived* recipe: the rim is the face taken 0.17
 *   darker at 65% chroma, the cast the face at absolute lightness 0.25 and 40%
 *   chroma. Those ratios are reverse-engineered from the web source's
 *   hand-authored per-hue table (`--rim-*` / `--cast-*`), so a token retint or
 *   an arbitrary `color` lands where a designer would have put it, with no
 *   table to extend.
 *
 * ## The page lights the key; extreme faces opt out
 *
 * Which branch a face takes follows the page, the same signal the web source's
 * `.dark` selectors read: a light page casts dark rims and drops, a dark page
 * catches white sheens. A vivid key is no exception — on a dark page `info`
 * takes the white sheen rim, not a navy ring around a blue fill.
 *
 * The exception is a face pinned *against* its page, which the `gray` plate and
 * a fixed `color` both produce. There the page's branch paints a rim the face
 * swallows: a 32%-white sheen vanishes into a near-white plate, and darkening a
 * near-black face clamps to black. Faces past {@link SHEEN_LOST_ABOVE} or
 * {@link SHADE_LOST_BELOW} therefore take the other branch, which is what keeps
 * the `gray` plate edged on a dark page and an ink `color` sheened on a light
 * one. Everything between the cutoffs simply follows the page.
 *
 * ## The layer stack
 *
 * RN has no pseudo-elements and no CSS gradients, and a child paints *above* its
 * parent's inset shadow — so the slots can't share one element the way they do
 * on the web. They become siblings at explicit ascending zIndex, ordered to
 * reproduce the web's painting exactly (see {@link FX_Z}):
 *
 *   cast (outside the Pressable) → face → spotlights → rim → edges → dome →
 *   tint → label → ripples
 *
 * The cast rides a sibling *behind* the Pressable because the Pressable clips
 * (`overflow: hidden`, needed to round the tint, dome and ripples) and an outer
 * shadow paints outside the bounds a clip allows.
 */

/**
 * Face colour for a GlossyButton. Every value keeps the full glossy treatment;
 * the variant only chooses the base colour the treatment derives from.
 *
 * `neutral` is the signature translucent face (the page, seen through glass);
 * the five status values fill with their vivid theme tokens; `inverse` is the
 * high-contrast slab; `gray` is a fixed plate pinned in both schemes. Pass
 * `color` instead for any colour outside this set.
 */
// biome-ignore lint/style/useExportsLast: declared up top so the recipe tables below can key off it; kept with its doc comment for readability
export type GlossyVariant = 'neutral' | 'inverse' | 'danger' | 'success' | 'warning' | 'info' | 'special' | 'gray';

/** The variants whose face is a vivid status token. */
type StatusVariant = Extract<GlossyVariant, 'danger' | 'success' | 'warning' | 'info' | 'special'>;

type ThemeColors = ReturnType<typeof useThemeColors>;

// Foreground token per status variant — the designed partner for the vivid
// fill, used for the label, adornment icons and the loading spinner. Status
// keys keep their token pair rather than a derived contrast colour: the pairing
// is a design decision, not a luminance calculation. (All five resolve to white
// today, which is what the web source hardcodes as `--fg-on-solid`; going
// through the tokens means a consumer retint carries the label with it.)
const GLOSSY_FOREGROUND_TOKEN: Record<StatusVariant, ThemeToken> = {
  danger: 'danger-foreground',
  success: 'success-foreground',
  warning: 'warning-foreground',
  info: 'info-foreground',
  special: 'special-foreground',
};

// ── pinned plate & glass ────────────────────────────────────────────────────

// The gray plate mirrors ElevatedButton's Geist-style secondary: a fixed light
// fill + mid-grey label, pinned in both schemes by design. No token says these,
// so they're the only genuinely literal colours in the file. Being past
// SHEEN_LOST_ABOVE the plate opts out of the page's dark branch, keeping the
// light treatment (dark rim, bright bevel) on a dark page too.
const GRAY_FILL = 'rgb(242, 242, 242)'; /* theme-exempt: fixed Geist plate */
const GRAY_CONTENT = 'rgb(112, 112, 112)'; /* theme-exempt: fixed muted label */

// `neutral`'s glass — the only face that stays translucent, and so the only one
// that has to read the page scheme. Both are the web source's `--bg-translucent`:
// near-opaque white on a light page, and a *warm* gray at 16% on a dark one, so
// the key picks up the backdrop without pulling it blue. Spelled as OKLCH
// conversions rather than baked hex so they can't drift from the token
// definitions they mirror — and so the colour guard has nothing to flag.
const NEUTRAL_GLASS_LIGHT = oklchToSrgb(1, 0, 0, 0.8);
const NEUTRAL_GLASS_DARK = oklchToSrgb(0.5674, 0.009, 106.68, 0.16);

// Pure black and pure white at an alpha. These are the light hitting the key
// and the shadow it drops — physical lighting, identical in every theme, which
// is exactly why they aren't tokens.
const black = (alpha: number) => `rgba(0, 0, 0, ${alpha})`; /* theme-exempt: physical lighting, not a themed colour */
const white = (alpha: number) => `rgba(255, 255, 255, ${alpha})`; /* theme-exempt: physical lighting, not a themed colour */

// ── the primitive table ─────────────────────────────────────────────────────

/**
 * Every colour a key paints, one field per `--btn-*` custom property in the web
 * source. A recipe fills this in; the component only reads it.
 */
type GlossyPrimitives = {
  /** Painted on the Pressable. Translucent for `neutral`, opaque elsewhere. */
  face: string;
  /** `face` flattened over the page — what the derived recipe measures. */
  base: string;
  /** Label, adornment-icon and spinner colour (`--btn-fg`). */
  content: string;
  /** Hairline accents over the spotlights, top and bottom. */
  edgeTop: string;
  edgeBottom: string;
  /** The hairline inside the radius — the one slot that survives the press. */
  rim: string;
  /** The bright bevel, 1px top and bottom. */
  spotTop: string;
  spotBottom: string;
  /** Contact and ambient drop shadow. Same colour per variant, different blur. */
  castNear: string;
  castFar: string;
  /** Dome gradient stops, top to bottom. */
  domeTop: string;
  domeBottom: string;
  /** Interaction tint. The colour snaps hover→active; only opacity animates. */
  tintHover: string;
  tintActive: string;
  /** White press shimmer rather than a dark one — set for a dark face. */
  faceIsDark: boolean;
};

/** A recipe's output: everything except the three face-derived fields. */
type GlossySlots = Omit<GlossyPrimitives, 'face' | 'base' | 'content'>;

// ── geometry (fixed; only the colours above vary) ───────────────────────────

// The web spends a full `--border-default` (0.5px) on the edges and the rim.
// A half-pixel is a crisp hairline on the retina displays these keys are
// designed for; a full pixel reads as a drawn border rather than a lit edge.
const HAIRLINE = 0.5;
const SPOT_WIDTH = 1;

/** The web's `--shadow-button` inset slots, minus the rim. */
function edgeShadow({ edgeTop, edgeBottom }: GlossySlots): string {
  return `inset 0 ${HAIRLINE}px 0 0 ${edgeTop}, inset 0 -${HAIRLINE}px 0 0 ${edgeBottom}`;
}

function spotShadow({ spotTop, spotBottom }: GlossySlots): string {
  return `inset 0 ${SPOT_WIDTH}px 0 0 ${spotTop}, inset 0 -${SPOT_WIDTH}px 0 0 ${spotBottom}`;
}

function rimShadow({ rim }: GlossySlots): string {
  return `inset 0 0 0 ${HAIRLINE}px ${rim}`;
}

/** The two outer drops: a tight contact shadow and a wider ambient one. */
function castShadow({ castNear, castFar }: GlossySlots): string {
  return `0 2px 2px -1px ${castNear}, 0 4px 4px -2px ${castFar}`;
}

// ── hand-authored recipes: neutral ──────────────────────────────────────────
//
// The web source's root `--btn-*` block and its `.dark` counterpart, transcribed
// slot for slot. `neutral` is the only face that stays translucent, so it's the
// only one whose lighting can't be derived from a colour: the key is lit by the
// page showing *through* it, which is a fact about the theme, not about a hue.

const NEUTRAL_LIGHT: GlossySlots = {
  edgeTop: black(0.08),
  edgeBottom: black(0.16),
  rim: black(0.16),
  // Opaque white, and the brightest spotlight in the set — a glass key catches
  // the most light along its top bevel because there's no fill damping it.
  spotTop: white(1),
  spotBottom: white(0.8),
  castNear: black(0.04),
  castFar: black(0.02),
  domeTop: 'transparent',
  domeBottom: black(0.04),
  tintHover: black(0.04),
  tintActive: black(0.06),
  faceIsDark: false,
};

const NEUTRAL_DARK: GlossySlots = {
  // Back-lit rather than white-painted: the edges go translucent white, and the
  // top edge is the bright one (the light is above the key, not below it).
  edgeTop: white(0.16),
  edgeBottom: white(0.04),
  rim: white(0.16),
  // Nothing for a spotlight to add over a dark face. The slots stay so the
  // layer still exists and still fades on press — only the colour is gone.
  spotTop: 'transparent',
  spotBottom: 'transparent',
  // A shadow has to work harder against a dark backdrop, so both casts take the
  // heavier alpha and the ambient one stops being lighter than the contact one.
  castNear: black(0.12),
  castFar: black(0.12),
  domeTop: white(0.04),
  domeBottom: 'transparent',
  tintHover: white(0.08),
  tintActive: white(0.12),
  faceIsDark: true,
};

// ── hand-authored recipes: inverse ──────────────────────────────────────────
//
// The "other scheme" key: on a light page it renders as a dark-theme key (light
// slab, white rim, dark label), and on a dark page it renders as a light-theme
// key (dark slab, black rim, light label). The two tables below define what an
// inverse key looks like in each scheme; `resolveFace` and `glossyRecipe` select
// the *opposite* one so the key always looks like it belongs to the other theme.
//
// The face is `surface-1` (the page colour) and the label is `foreground` — the
// slab is the page punched through to the opposite theme's foreground, which is
// what makes it the loudest key in the set no matter what a consumer retints.
//
// Both edges are inherited from the neutral root in the web source rather than
// re-declared, so they're spread in here for the same reason.

const INVERSE_LIGHT: GlossySlots = {
  ...NEUTRAL_LIGHT,
  // Fully opaque, top and bottom: the slab reads as a machined edge, not a lit
  // one. This is the only rim in the set that isn't translucent.
  rim: black(1),
  spotTop: white(0.24),
  spotBottom: white(0.16),
  castNear: black(0.12),
  castFar: black(0.12),
  // A near-black face has room for a real gradient, and this is the steepest
  // dome in the set — 88% black at the bottom, so the key curves hard.
  domeTop: 'transparent',
  domeBottom: black(0.88),
  tintHover: white(0.12),
  tintActive: white(0.2),
  faceIsDark: true,
};

const INVERSE_DARK: GlossySlots = {
  ...NEUTRAL_DARK,
  rim: white(1),
  // The face is near-white, so the tint has to darken rather than lighten, and
  // the dome only needs a hint of weight instead of the light branch's 88%.
  domeTop: 'transparent',
  domeBottom: black(0.08),
  tintHover: black(0.08),
  tintActive: black(0.14),
  faceIsDark: false,
};

// ── the derived recipe ──────────────────────────────────────────────────────
//
// Everything that isn't `neutral` or `inverse` is an opaque face, and every
// opaque face is lit the same way — so the web source's six hand-authored solid
// variants collapse into one function of the face colour.
//
// The two derived slots are the rim and the cast, and both ratios come from
// measuring that hand-authored table (six hues × light/dark) rather than from
// taste: the rim runs 0.167–0.174 lightness below its face at 53–72% of its
// chroma, and the cast sits at an *absolute* 0.238–0.264 lightness at 37–43%
// chroma. Taking the middle of each band reproduces all six of the designer's
// entries within a few sRGB units, which is what makes the generalisation safe:
// a token retint or an arbitrary `color` lands where a seventh hand-authored
// entry would have.
//
// Note the cast's absolute lightness. A drop shadow is the *page* in shadow, not
// the face darkened, so it converges toward one near-black regardless of how
// light the face is — only the hue and a trace of chroma survive to keep a
// violet key's shadow violet.
const RIM_LIGHTNESS_DROP = 0.17;
const RIM_CHROMA_SCALE = 0.65;
const CAST_LIGHTNESS = 0.25;
const CAST_CHROMA_SCALE = 0.4;
// A shadow has to work harder against a dark backdrop (`--btn-cast-alpha`).
const CAST_ALPHA_LIGHT = 0.12;
const CAST_ALPHA_DARK = 0.24;

// A key is lit by its page — a light page casts dark rims and drops, a dark page
// catches white sheens — which is the signal the web source's `.dark` selectors
// read.
//
// The exception is a face pinned *against* its page: the `gray` plate on a dark
// page, an ink `color` on a light one. There the page's own branch paints a rim
// the face swallows whole — a 32%-white sheen on near-white, or a 0.17 darkening
// of something already near-black — leaving the key flat with no visible edge
// and no hover shift. Only those faces take the opposite branch, which is what
// keeps the gray plate edged in the dark theme. Everything between the two
// cutoffs simply follows the page.
const MID_LIGHTNESS = 0.5;
const SHEEN_LOST_ABOVE = 0.85;
const SHADE_LOST_BELOW = 0.3;

/** Whether an opaque face takes the dark (sheen) branch rather than the light one. */
function usesDarkLighting(faceLightness: number, pageDark: boolean): boolean {
  return pageDark ? faceLightness <= SHEEN_LOST_ABOVE : faceLightness < SHADE_LOST_BELOW;
}

// Label contrast for a face with no designed foreground partner — any `color` a
// consumer passes. OKLCH lightness tracks perceived brightness closely enough
// that one threshold picks the legible side; 0.65 keeps white on mid-tone fills
// and flips to ink only once the face is genuinely light. Also picks the ripple
// shimmer, which needs the same answer.
const CONTENT_LIGHTNESS_SWITCH = 0.65;

// Stand-in for a face this library can't parse (a named CSS colour, say). White
// is the safest guess: it yields the light branch, which is legible over the
// widest range of real faces.
const FALLBACK_FACE = { lightness: 1, chroma: 0, hue: 0 };

/** Light branch for an opaque face: dark rim, dark drop, bright bevel, dark tint. */
function derivedLight(lightness: number, chroma: number, hue: number): GlossySlots {
  const cast = oklchToSrgb(CAST_LIGHTNESS, chroma * CAST_CHROMA_SCALE, hue, CAST_ALPHA_LIGHT);
  return {
    ...NEUTRAL_LIGHT,
    // The face's own colour taken very dark, so the edge reads as the face in
    // shadow rather than as a black line drawn around it.
    rim: oklchToSrgb(lightness - RIM_LIGHTNESS_DROP, chroma * RIM_CHROMA_SCALE, hue),
    // Far dimmer than the glass key's opaque spotlights: a solid fill damps the
    // bevel, so the sheen is a suggestion rather than a highlight.
    spotTop: white(0.16),
    spotBottom: white(0.08),
    castNear: cast,
    castFar: cast,
    faceIsDark: lightness < CONTENT_LIGHTNESS_SWITCH,
  };
}

/** Dark branch for an opaque face: one white sheen rim, heavier drop, light tint. */
function derivedDark(lightness: number, chroma: number, hue: number): GlossySlots {
  const cast = oklchToSrgb(CAST_LIGHTNESS, chroma * CAST_CHROMA_SCALE, hue, CAST_ALPHA_DARK);
  return {
    ...NEUTRAL_DARK,
    // One translucent white for every hue, replacing the six per-hue rims. A
    // dark page lights the key from outside, and that sheen doesn't care what
    // colour it lands on.
    edgeBottom: white(0.08),
    rim: white(0.32),
    castNear: cast,
    castFar: cast,
    faceIsDark: lightness < CONTENT_LIGHTNESS_SWITCH,
  };
}

/** Derive the whole slot table from one opaque face colour, lit by its page. */
function derivedRecipe(base: string, pageDark: boolean): GlossySlots {
  const { lightness, chroma, hue } = cssColorToOklch(base) ?? FALLBACK_FACE;
  return usesDarkLighting(lightness, pageDark) ? derivedDark(lightness, chroma, hue) : derivedLight(lightness, chroma, hue);
}

// ── face resolution ────────────────────────────────────────────────────────

/** Which recipe family a face belongs to. */
type FaceKind = 'neutral' | 'inverse' | 'derived';

/** The face colours, plus the family whose recipe lights them. */
type GlossyFace = {
  /** Painted on the Pressable — translucent for `neutral`'s glass. */
  paint: string;
  /** What the derived recipe measures: `paint` flattened over the page, so a
   *  translucent face derives from the colour actually seen, not from white. */
  base: string;
  /** Label, adornment-icon and spinner colour. */
  content: string;
  kind: FaceKind;
};

const CONTENT_ON_DARK = oklchToSrgb(1, 0, 0);
// Light-theme `foreground` — oklch(14.5% 0 0), the ink a light face would use.
const CONTENT_ON_LIGHT = oklchToSrgb(0.145, 0, 0);

/** Legible label colour for a face with no designed foreground partner. */
function contentOn(base: string): string {
  const { lightness } = cssColorToOklch(base) ?? FALLBACK_FACE;
  return lightness < CONTENT_LIGHTNESS_SWITCH ? CONTENT_ON_DARK : CONTENT_ON_LIGHT;
}

/**
 * Whether the page is dark, read from the resolved `surface-1` token — the
 * colour the page actually paints, which is what the lighting reacts to.
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
    // A translucent custom colour is honoured as glass, exactly like `neutral` —
    // but it's still lit as a solid, because its flattened colour is knowable.
    const base = compositeOver(color, page);
    return { paint: color, base, content: contentOn(base), kind: 'derived' };
  }
  switch (variant) {
    case 'neutral': {
      const glass = pageDark ? NEUTRAL_GLASS_DARK : NEUTRAL_GLASS_LIGHT;
      return { paint: glass, base: compositeOver(glass, page), content: colors.foreground, kind: 'neutral' };
    }
    case 'inverse': {
      // Inverse renders the key as it would appear in the *opposite* scheme: on a
      // light page it shows the dark-theme key (near-white slab, dark label,
      // white-rim lighting), and on a dark page it shows the light-theme key
      // (near-black slab, light label, black-rim lighting).
      //
      // `surface-1` on the current page approximates `foreground` of the opposite
      // scheme — near-white on a light page (≈ dark foreground), the dark surface
      // on a dark page (≈ light foreground). Similarly `foreground` of the current
      // page approximates `surface-1` of the opposite scheme.
      const paint = page;
      return { paint, base: paint, content: colors.foreground, kind: 'inverse' };
    }
    case 'gray':
      return { paint: GRAY_FILL, base: GRAY_FILL, content: GRAY_CONTENT, kind: 'derived' };
    default: {
      const fill = colors[variant];
      return { paint: fill, base: fill, content: colors[GLOSSY_FOREGROUND_TOKEN[variant]], kind: 'derived' };
    }
  }
}

/** The whole slot table for a face: hand-authored pair, or derived from the colour. */
function glossyRecipe(kind: FaceKind, base: string, pageDark: boolean): GlossySlots {
  if (kind === 'neutral') return pageDark ? NEUTRAL_DARK : NEUTRAL_LIGHT;
  // `inverse` uses the *opposite* page's lighting — on a light page it shows the
  // dark-theme key, on a dark page it shows the light-theme key. The derived
  // cutoffs would misread the face and flip it straight back, so it's handled
  // here directly with the page branch reversed.
  if (kind === 'inverse') return pageDark ? INVERSE_LIGHT : INVERSE_DARK;
  return derivedRecipe(base, pageDark);
}

// ── interaction ─────────────────────────────────────────────────────────────

type InteractionState = { flatten: boolean; hoverCapable: boolean; pressed: boolean; hovered: boolean };

/**
 * Interaction-tint opacity — 0 or 1, never in between.
 *
 * The web animates only the tint layer's opacity and *snaps* its colour from
 * hover to active, since each tint value carries its own alpha (0.04 → 0.06 on
 * a light key). Hover-capable pointers only: a touch device dims the whole key
 * instead (`[@media(hover:none)]:after:hidden` plus `active:opacity-80`), and a
 * disabled key shows no tint at all (`group-disabled:after:hidden`).
 */
function tintOpacity({ flatten, hoverCapable, pressed, hovered }: InteractionState): 0 | 1 {
  if (flatten || !hoverCapable) return 0;
  return pressed || hovered ? 1 : 0;
}

/** Whole-key opacity: the web `disabled:opacity-50`, or its touch-press dim on
 *  devices that can't hover (where the tint layer never shows). */
function keyOpacity({ flatten, hoverCapable, pressed }: InteractionState): 0.5 | 0.8 | 1 {
  if (flatten) return 0.5;
  if (pressed && !hoverCapable) return 0.8;
  return 1;
}

// ── the layer stack ─────────────────────────────────────────────────────────

/**
 * Explicit stacking ladder. The web paints all seven slots from one box-shadow
 * list, where the *first*-listed shadow paints on top — edges over rim over
 * spotlights — and then its `::before` dome and `::after` tint paint above the
 * lot, because a child paints above its parent's own inset shadows.
 *
 * RN has no pseudo-elements, and a child paints above its parent's inset shadow
 * here too, so the slots can't share one element. They become siblings at
 * ascending zIndex in the same order the web paints them, bottom to top. Child
 * order alone would paint the same way; the explicit indices pin the stack so no
 * layer can drift.
 */
const FX_Z = { spots: 1, rim: 2, edges: 3, dome: 4, tint: 5, label: 10, ripples: 20 } as const;

/** One SVG gradient stop, colour and alpha held apart. */
type DomeStop = { color: string; opacity: number };

const RGBA_CHANNELS = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/;
// A stop with no colour of its own and no sibling to borrow one from — i.e. no
// dome at all. Nothing in the set hits this today; it's the total fallback.
const CLEAR_STOP: DomeStop = { color: oklchToSrgb(0, 0, 0), opacity: 0 };

/** Split a slot colour into an SVG `stopColor` / `stopOpacity` pair, or null for
 *  a value with no colour of its own (`transparent`). */
function parseStop(value: string): DomeStop | null {
  const channels = RGBA_CHANNELS.exec(value);
  if (channels === null) return null;
  const [, red, green, blue, alpha] = channels;
  const color = `rgb(${red}, ${green}, ${blue})`; /* theme-exempt: the slot's own channels, restated without its alpha */
  return { color, opacity: alpha === undefined ? 1 : Number(alpha) };
}

/**
 * The dome's two stops, RN-safe.
 *
 * Two translations happen here. Alpha moves out of the colour and into
 * `stopOpacity`, because react-native-svg's native backends read the attribute
 * rather than an alpha channel baked into `stopColor`. And `transparent` borrows
 * its sibling's colour at zero alpha, which is what a browser does when it
 * interpolates a premultiplied gradient — leave it a literal `transparent` and
 * the ramp slides through grey on its way to black.
 */
function domeStops({ domeTop, domeBottom }: GlossySlots): [DomeStop, DomeStop] {
  const top = parseStop(domeTop);
  const bottom = parseStop(domeBottom);
  // Whichever end has a colour lends it to the other. Every dome in the set has
  // exactly one transparent end, so one of the first two branches always wins.
  if (top !== null && bottom !== null) return [top, bottom];
  if (top !== null) return [top, { color: top.color, opacity: 0 }];
  if (bottom !== null) return [{ color: bottom.color, opacity: 0 }, bottom];
  return [CLEAR_STOP, CLEAR_STOP];
}

type DomeProps = { id: string; radius: number; slots: GlossySlots };

/** The dome gradient — SVG, since RN has no CSS gradients. Constant: it survives
 *  the press and the disabled state, exactly as the web's `::before` does. */
function GlossyDome({ id, radius, slots }: DomeProps) {
  const [top, bottom] = domeStops(slots);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', zIndex: FX_Z.dome }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`${id}-dome`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top.color} stopOpacity={top.opacity} />
            <Stop offset="1" stopColor={bottom.color} stopOpacity={bottom.opacity} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-dome)`} />
      </Svg>
    </View>
  );
}

/** A timing transition — the clock every lit slot and the tint fade on. */
type Fade = { type: 'timing'; duration: number };

type LayersProps = {
  id: string;
  radius: number;
  slots: GlossySlots;
  /** 1 at rest, 0 while pressed or flattened — the whole lit stack but the rim. */
  lifted: 0 | 1;
  fade: Fade;
  pressed: boolean;
  tint: 0 | 1;
  backdropColor: string | undefined;
};

/**
 * Everything painted between the face and the label: the state backdrop, the
 * four inset slots, the dome and the interaction tint.
 *
 * Split out from the component only because the stack is long — it holds no
 * state and takes no decisions, and the zIndex ladder is what orders it, not
 * this nesting.
 */
function GlossyLayers({ id, radius, slots, lifted, fade, pressed, tint, backdropColor }: LayersProps) {
  const rounded = { borderRadius: radius };
  return (
    <>
      {/* State backdrop — sits directly on the face, under every lit slot, so a
          success or error fill is still a *face* colour and stays lit. */}
      <MotiView
        animate={{ opacity: backdropColor === undefined ? 0 : 1 }}
        transition={TIMING_BASE}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor ?? 'transparent' }]}
      />
      {/* Spotlights, then rim, then edges — the web's box-shadow list read back to
          front. The rim is the one slot that survives the press, which is why it
          can't share a layer with the two that don't. */}
      <MotiView
        animate={{ opacity: lifted }}
        transition={fade}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, rounded, { boxShadow: spotShadow(slots), zIndex: FX_Z.spots }]}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, rounded, { boxShadow: rimShadow(slots), zIndex: FX_Z.rim }]} />
      <MotiView
        animate={{ opacity: lifted }}
        transition={fade}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, rounded, { boxShadow: edgeShadow(slots), zIndex: FX_Z.edges }]}
      />
      <GlossyDome id={id} radius={radius} slots={slots} />
      {/* Hover/press tint. Only the opacity animates — the colour snaps from hover
          to active in `style`, since each carries its own alpha and interpolating
          between them would dip through the wrong value. */}
      <MotiView
        animate={{ opacity: tint }}
        transition={fade}
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          rounded,
          { backgroundColor: pressed ? slots.tintActive : slots.tintHover, zIndex: FX_Z.tint },
        ]}
      />
    </>
  );
}

export interface GlossyButtonProps extends BaseButtonProps {
  /** Face colour from the built-in set: `neutral` (default) is the translucent
   *  glass key, the status values fill with their vivid theme tokens, `inverse`
   *  is the high-contrast slab, and `gray` is a fixed plate pinned in both
   *  schemes. Ignored when `color` is set. */
  variant?: GlossyVariant;
  /**
   * Paint the key any colour. The whole slot table — cast, rim, sheen, dome,
   * hover tint — is re-derived from it in OKLCH, and the label picks the legible
   * side automatically, so no variant needs to exist for it.
   *
   * Takes hex, `rgb()`/`rgba()` and `oklch()`; a translucent value is treated as
   * glass and derives from what it composites to over the page. Named CSS
   * colours (`'rebeccapurple'`) can't be parsed and fall back to the light
   * branch — pass those as hex.
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
  // The press feedback IS the sink (the lit layers drop away, the tint deepens),
  // so the key doesn't also shrink by default — pass a pressScale to opt in.
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
  // The derived branch runs a handful of gamut-mapped OKLCH conversions, and both
  // hover and press re-render — so it's keyed on the inputs, not on the render.
  const slots = useMemo(() => glossyRecipe(face.kind, face.base, pageDark), [face.kind, face.base, pageDark]);
  const content = contentColor ?? face.content;
  const pressSpring = mergeTransition(MOTION_SNAPPY, pressTransition);
  const fade = reduce ? TIMING_INSTANT : TIMING_FAST;
  const [hovered, setHovered] = useState(false);
  const isDisabled = Boolean(disabled || loading);
  // Two axes, mirroring ElevatedButton: `isDisabled` blocks interaction, while
  // `flatten` sinks the key (lit layers to 0, no tint, half opacity — the web
  // `disabled:opacity-50` plus its pressed shadow list). `noDisabledOpacity`
  // splits them so a non-interactive key (StatefulButton mid-machine, say) keeps
  // its lifted look.
  const flatten = isDisabled && !noDisabledOpacity;

  // SVG gradient ids must be unique per instance (they land in one shared
  // document on web). useId can emit ':', illegal in url(#…), so strip it.
  const gradientId = useId().replace(/:/g, '');
  const radius = buttonRadius(shape, size);

  const { pressed, ripples, onLayout, handlePressIn, handlePressOut } = usePressRipples({
    ripple,
    reduce,
    trackDims: false,
  });
  // Stable setters keep the handlers stable, dodging RNW's stale pointerleave capture.
  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);

  // The key sinks into the page: every lit slot but the rim drops to 0, which is
  // exactly the substitution the web's `--shadow-button-pressed` makes.
  const lifted = pressed || flatten ? 0 : 1;
  const interaction: InteractionState = { flatten, hoverCapable, pressed, hovered };

  const buttonContent = buildButtonContent({
    loading,
    reduce,
    // Family label ramp — the same text a flat Button paints at this size. Only
    // the colour is the key's own, and it arrives inline (below) because it's
    // derived per-face and has no `text-*` utility to name.
    labelClass: LABEL_TEXT_CLASS[size],
    labelColor: content,
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
      // clock as the lit layers so the touch dim and the sink move together.
      transition={{ ...pressSpring, opacity: fade }}
      className={cn(fitWidth && 'w-full', className)}
      style={style}
    >
      {/* Cast — behind the Pressable, because the Pressable clips (needed to
          round the dome, tint and ripples) and an outer shadow paints outside
          the bounds a clip allows. Fades with the rest of the lit slots. */}
      <MotiView
        animate={{ opacity: lifted }}
        transition={fade}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: castShadow(slots) }]}
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
        className={cn('flex-row items-center justify-center', BUTTON_BOX[shape][size])}
        style={[{ overflow: 'hidden', backgroundColor: face.paint }, contentStyle]}
      >
        <GlossyLayers
          id={gradientId}
          radius={radius}
          slots={slots}
          lifted={lifted}
          fade={fade}
          pressed={pressed}
          tint={tintOpacity(interaction)}
          backdropColor={backdropColor}
        />
        {/* Label above every lit slot — the web's `z-10` span. (The web adds a
            `px-0.5` inset here; dropped so the label sits at exactly the family's
            padding and a glossy key can be swapped for a flat Button in place.) */}
        <View style={{ zIndex: FX_Z.label }}>{buttonContent}</View>
        {ripple && !reduce ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: FX_Z.ripples }]}>
            {/* White shimmer over a dark face, dark shimmer over a light one. */}
            <ButtonRipples ripples={ripples} filled={slots.faceIsDark} />
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
