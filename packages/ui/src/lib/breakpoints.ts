/**
 * Width breakpoints — the single source of truth for every responsive decision
 * in this package.
 *
 * The scale mirrors Tailwind's default `screens`, so a `md:` class and a
 * `useBreakpoint() === 'md'` check flip at the same width. `base` is the
 * implicit unprefixed tier (any width ≥ 0) and exists so the return type of
 * {@link breakpointForWidth} is always a real key.
 *
 * Everything here is pure and React-free: components that measure their own
 * container (rather than the window) can reuse the same thresholds by calling
 * {@link breakpointForWidth} / {@link isWidthAtLeast} with a measured width.
 */

// Declared before the exports below to satisfy `useExportsLast`. `Breakpoint` is
// a type alias, so referencing it ahead of its declaration is fine.

/** Canonical widest-to-narrowest order, used as the tie-break when two tiers share a width. */
const DESCENDING: readonly Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm', 'base'];

/**
 * Tiers ordered widest-first by their *resolved* width, so an override that
 * reorders the scale (`{ md: 1200 }`, putting md above lg) still resolves by
 * width rather than by name position. Ties keep {@link DESCENDING}, so
 * `{ sm: 768 }` — which collides sm with md — resolves 768 to `'md'`.
 */
function descendingTiers(scale: Record<Breakpoint, number>): readonly Breakpoint[] {
  return [...DESCENDING].sort((a, b) => scale[b] - scale[a]);
}

export const defaultBreakpoints = {
  base: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof defaultBreakpoints;

/** Partial override of the default scale — `{ md: 720 }` moves only the `md` edge. */
export type BreakpointOverrides = Partial<Record<Breakpoint, number>>;

/**
 * A width threshold expressed either as a breakpoint name (resolved against the
 * active scale) or as a raw pixel number. Component props that expose a single
 * cutoff take this, so callers can say `'md'` or `900`.
 */
export type BreakpointValue = Breakpoint | number;

/** Merges `overrides` onto the default scale. `base` is pinned to 0 so every width resolves. */
export function resolveScale(overrides?: BreakpointOverrides): Record<Breakpoint, number> {
  if (!overrides) return { ...defaultBreakpoints };
  return { ...defaultBreakpoints, ...overrides, base: 0 };
}

/** The widest breakpoint whose min-width `width` satisfies. */
export function breakpointForWidth(width: number, overrides?: BreakpointOverrides): Breakpoint {
  const scale = resolveScale(overrides);
  for (const name of descendingTiers(scale)) {
    if (width >= scale[name]) return name;
  }
  return 'base';
}

/** Pixel value of a {@link BreakpointValue} against the given scale. */
export function breakpointWidth(value: BreakpointValue, overrides?: BreakpointOverrides): number {
  return typeof value === 'number' ? value : resolveScale(overrides)[value];
}

/** Whether `width` reaches `value` — the imperative form of a `min-width` media query. */
export function isWidthAtLeast(width: number, value: BreakpointValue, overrides?: BreakpointOverrides): boolean {
  return width >= breakpointWidth(value, overrides);
}

/**
 * A stable string identity for a scale, used as a memo/effect dependency so an
 * inline `{ md: 700 }` prop doesn't re-subscribe the listener every render.
 */
export function scaleSignature(overrides?: BreakpointOverrides): string {
  if (!overrides) return '';
  const scale = resolveScale(overrides);
  return DESCENDING.map((name) => `${name}:${scale[name]}`).join(',');
}
