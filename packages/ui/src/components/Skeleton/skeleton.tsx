import { cva, type VariantProps } from 'class-variance-authority';
import type { ViewProps } from 'react-native';
import { Easing } from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { MotiView } from '../../moti/components/view';

// cubic-bezier(0.4, 0, 0.6, 1) — Tailwind's `animate-pulse` easing.
const PULSE_EASING = Easing.bezier(0.4, 0, 0.6, 1);

// cva drives the static styling layer — class strings are static literals so
// the Tailwind/uniwind scanner picks them up. Mirrors the Card pattern.
const skeleton = cva('bg-muted', {
  variants: {
    shape: {
      rounded: 'rounded-md',
      circle: 'rounded-full',
      square: 'rounded-none',
    },
  },
  defaultVariants: {
    shape: 'rounded',
  },
});

/** Join truthy class strings. (Local helper — this package ships no shared `cn`.) */
function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === 'string').join(' ');
}

export type SkeletonShape = NonNullable<VariantProps<typeof skeleton>['shape']>;
export type SkeletonProps = ViewProps & {
  /**
   * Corner preset. `rounded` (default) suits text/box placeholders, `circle`
   * avatars, `square` raw bars — pick by intent rather than reaching for a style.
   */
  shape?: SkeletonShape;
  /**
   * Seconds for one full pulse (opacity 1 → 0.5 → 1). Defaults to 2, matching
   * Tailwind's `animate-pulse`. Ignored under reduced-motion.
   */
  speed?: number;
};

/**
 * A shimmering placeholder box for loading states — the MotiView-driven
 * equivalent of Tailwind's `animate-pulse` (opacity 1 → 0.5 → 1 over 2s with
 * cubic-bezier(0.4, 0, 0.6, 1)). Size it with `className` (e.g. `h-4 w-full`)
 * or `style`. Respects reduced-motion: renders a static muted box.
 */
export function Skeleton({ shape = 'rounded', speed = 2, className, ...props }: SkeletonProps) {
  const reduce = useReducedMotion();
  // repeatReverse ping-pongs 1 → 0.5 → 1; the half-cycle duration yields a full
  // `speed`-second loop, so the dip lands at the midpoint like animate-pulse.
  return (
    <MotiView
      from={{ opacity: 1 }}
      animate={{ opacity: reduce ? 1 : 0.5 }}
      transition={
        reduce
          ? { type: 'timing', duration: 0 }
          : { type: 'timing', duration: (speed / 2) * 1000, loop: true, repeatReverse: true, easing: PULSE_EASING }
      }
      className={cn(skeleton({ shape }), className)}
      {...props}
    />
  );
}
