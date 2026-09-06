import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Rim — the glass edge-light primitive.
 *
 * A recreation of `react-glass-rim`'s specular edge (a highlight that runs along
 * a surface's border and fades inward) as a cross-platform `react-native-svg`
 * layer. It draws the rim as a single band of `thickness` px, sliced into
 * hairline sub-rings (see {@link SLICE}) so the inward fade reads as one
 * continuous gradient — a wider rim just gets more slices, never coarser
 * concentric layers.
 *
 * The DOM original masks a conic gradient down to a hairline border for its
 * directional falloff (bright opposite corners, dim between). SVG has no conic
 * gradient, so the directional falloff is a diagonal linear gradient —
 * accent → transparent → accent along the top-left/bottom-right axis — which
 * reads as the same two bright specular corners.
 *
 * The host must hand in the measured pixel `width`/`height` (the `Surface`
 * primitive measures itself on its root, the way `ElevatedButton` feeds its
 * own SVG rim): an absolutely-positioned child cannot measure itself on native,
 * so the ring never draws. Each ring's inward fade is baked into its gradient
 * stops (rather than `strokeOpacity`), so it renders identically on native.
 *
 * The directional falloff (bright opposite corners, transparent between — the
 * `react-glass-rim` "lit corners" look) is a diagonal gradient. It cannot use
 * `objectBoundingBox` units: react-native-svg's iOS painter projects that
 * gradient along the raw pixel diagonal, so a wide pane collapses the diagonal
 * toward horizontal and every edge reads uniformly bright. `userSpaceOnUse` with
 * a pre-corrected endpoint restores the true 45° falloff in *normalized* space
 * (offset 0 at top-left, 1 at bottom-right, 0.5 at the other two corners), so
 * web and native agree — see the `gradientEndX`/`gradientEndY` maths below.
 *
 * The rim is purely decorative: it absolutely-fills its host, never intercepts
 * touches, and draws inside the host's own edge so a rounded `overflow-hidden`
 * parent clips it to the same silhouette.
 */

/** The specular highlight is white in every scheme (light reflecting off glass)
 *  — the same default `react-glass-rim` ships. */
const DEFAULT_ACCENT = '#ffffff';

/**
 * The fixed sub-ring width the rim is sliced at. Cutting the band into hairline
 * slices (rather than a few thick strokes) keeps the inward fade smooth at any
 * thickness, and it sets the granularity of the rim width: `thickness` snaps to
 * multiples of this, so a caller can step the rim in 0.5px increments.
 */
const SLICE = 0.5;

export type RimProps = {
  /** Measured host width in px — required so the rings trace the host edge. */
  width: number;
  /** Measured host height in px — required so the rings trace the host edge. */
  height: number;
  /** Corner radius of the host surface in px, so the rim traces the same curve. @default 0 */
  borderRadius?: number;
  /** Color of the highlight (any CSS color). @default "#ffffff" */
  accentColor?: string;
  /** Peak alpha (0–1) of the outermost ring; inner rings fade toward 0. @default 0.5 */
  intensity?: number;
  /**
   * How fast the highlight drops off inward from the edge — the falloff
   * exponent. `1` is a linear ramp; higher values concentrate the white at the
   * outermost ring (a faster, crisper dropoff). @default 2
   */
  falloff?: number;
  /** Total rim width in px; snaps to 0.5px increments. @default 1 */
  thickness?: number;
  /** Mount/unmount the rim. @default true */
  enabled?: boolean;
};

export function Rim({
  width,
  height,
  borderRadius = 0,
  accentColor = DEFAULT_ACCENT,
  intensity = 0.5,
  falloff = 2,
  thickness = 1,
  enabled = true,
}: RimProps) {
  // react-native-svg resolves `url(#id)` against the whole document, so each
  // ring needs a distinct gradient id. `useId` is unique per mount; colons are
  // stripped so the id survives as an SVG fragment reference.
  const gradientId = useId().replace(/:/g, '');

  if (!enabled || width <= 0 || height <= 0) return null;

  // Slice the band into hairline sub-rings so the fade is a smooth ramp rather
  // than visible concentric layers. `ringCount` follows the requested thickness
  // (snapped to 0.5px), and each sub-ring's stroke is `thickness / ringCount`
  // wide so fractional widths tile flush against the host edge.
  const ringCount = Math.max(1, Math.round(thickness / SLICE));
  const band = thickness / ringCount;

  // The gradient's `objectBoundingBox` diagonal is squashed by the iOS painter
  // for non-square hosts, so we draw in `userSpaceOnUse` and correct the endpoint
  // by hand. For a diagonal that is 45° in *normalized* space the gradient line
  // must point along (1/width, 1/height) in pixels, i.e. (height, width); scaling
  // that direction so offset 0 lands on top-left and offset 1 on bottom-right
  // gives the endpoints below. (Derivation: `ex/(ex²+ey²) = 1/(2·width)` and
  // `ey/(ex²+ey²) = 1/(2·height)`.)
  const diag = width * width + height * height;
  const gradientEndX = (2 * width * height * height) / diag;
  const gradientEndY = (2 * width * width * height) / diag;

  return (
    <Svg width={width} height={height} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        {Array.from({ length: ringCount }, (_, index) => {
          const id = `${gradientId}-${index}`;
          // The outward ring is full `intensity`; each inner ring dims by the
          // falloff curve (`falloff` 1 = linear, higher = faster dropoff). The
          // fade is baked into the stops (rather than `strokeOpacity`) so it
          // renders identically on native.
          const alpha = Math.min(1, Math.max(0, intensity * (1 - index / ringCount) ** falloff));
          return (
            <LinearGradient key={id} id={id} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={gradientEndX} y2={gradientEndY}>
              <Stop offset={0} stopColor={accentColor} stopOpacity={alpha} />
              <Stop offset={0.5} stopColor={accentColor} stopOpacity={0} />
              <Stop offset={1} stopColor={accentColor} stopOpacity={alpha} />
            </LinearGradient>
          );
        })}
      </Defs>
      {Array.from({ length: ringCount }, (_, index) => {
        // Each sub-ring sits `band` px further inward; the stroke is centred on
        // the path, so `band / 2` keeps the outermost sub-ring flush with the edge.
        const inset = index * band + band / 2;
        const radius = Math.max(0, borderRadius - inset);
        return (
          <Rect
            key={inset}
            x={inset}
            y={inset}
            width={width - inset * 2}
            height={height - inset * 2}
            rx={radius}
            ry={radius}
            fill="none"
            stroke={`url(#${gradientId}-${index})`}
            strokeWidth={band}
          />
        );
      })}
    </Svg>
  );
}
