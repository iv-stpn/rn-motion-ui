// biome-ignore-all lint/style/useExportsLast: the public rect/geometry types head the module so the geometry helpers below read against them
/**
 * spotlight-layout — pure geometry for the spotlight's overlay.
 *
 * Given a target's window-space rect and the viewport size, it derives:
 * - the **hole** (the target inflated by `padding`),
 * - the four **shades** that dim the viewport around the hole (the "cut-out"),
 * - the **tooltip** position (below the hole when it fits, above otherwise,
 *   horizontally clamped to the viewport margins).
 *
 * Everything here is React-free so it is unit-testable without react-native.
 */

export type SpotlightRect = { x: number; y: number; width: number; height: number };

export type SpotlightGeometryOptions = {
  /** Inflate the hole by this many px per side, so the highlight reads generous. @default 4 */
  padding?: number;
  /** Gap between the hole and the tooltip card. @default 12 */
  gap?: number;
  /** Tooltip card width. @default 280 */
  tooltipWidth?: number;
  /** Tooltip card height, used to decide below-vs-above placement. @default 120 */
  tooltipHeight?: number;
  /** Minimum distance the tooltip keeps from the viewport edges. @default 16 */
  margin?: number;
};

export type SpotlightGeometry = {
  /** The highlight hole — the target inflated by `padding`. */
  hole: SpotlightRect;
  /** The four dim regions, in order: top, bottom, left, right. */
  shades: readonly [SpotlightRect, SpotlightRect, SpotlightRect, SpotlightRect];
  /** The tooltip's absolute top-left and width. */
  tooltip: { x: number; y: number; width: number };
  /** True when the tooltip sits below the hole. */
  below: boolean;
};

const DEFAULTS: Required<SpotlightGeometryOptions> = {
  padding: 4,
  gap: 12,
  tooltipWidth: 280,
  tooltipHeight: 120,
  margin: 16,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The overlay geometry for a target. Shades are non-negative and tile the
 * viewport exactly around the hole, leaving the hole undimmed.
 */
export function spotlightGeometry(
  target: SpotlightRect,
  viewportWidth: number,
  viewportHeight: number,
  options?: SpotlightGeometryOptions,
): SpotlightGeometry {
  const { padding, gap, tooltipWidth, tooltipHeight, margin } = { ...DEFAULTS, ...options };

  const hole = {
    x: target.x - padding,
    y: target.y - padding,
    width: target.width + padding * 2,
    height: target.height + padding * 2,
  };

  const shades: [SpotlightRect, SpotlightRect, SpotlightRect, SpotlightRect] = [
    { x: 0, y: 0, width: viewportWidth, height: Math.max(0, hole.y) },
    {
      x: 0,
      y: hole.y + hole.height,
      width: viewportWidth,
      height: Math.max(0, viewportHeight - (hole.y + hole.height)),
    },
    { x: 0, y: hole.y, width: Math.max(0, hole.x), height: hole.height },
    {
      x: hole.x + hole.width,
      y: hole.y,
      width: Math.max(0, viewportWidth - (hole.x + hole.width)),
      height: hole.height,
    },
  ];

  const fitsBelow = hole.y + hole.height + gap + tooltipHeight <= viewportHeight - margin;
  const fitsAbove = hole.y - gap - tooltipHeight >= margin;
  const below = fitsBelow || !fitsAbove;
  const y = below ? hole.y + hole.height + gap : hole.y - gap - tooltipHeight;
  const idealX = hole.x + hole.width / 2 - tooltipWidth / 2;
  const maxX = Math.max(margin, viewportWidth - margin - tooltipWidth);
  const x = clamp(idealX, margin, maxX);

  return { hole, shades, tooltip: { x, y, width: tooltipWidth }, below };
}
