import { cva, type VariantProps } from 'class-variance-authority';
import type { Ref } from 'react';
import { View, type ViewProps } from 'react-native';
import { elevatedShadow, type SurfaceLevel, surfaceBackground } from '../../lib/elevated';

// cva drives the static styling layer — class strings are static literals so
// the Tailwind/uniwind scanner picks them up. Mirrors the Button pattern.
const card = cva('rounded-2xl', {
  variants: {
    size: {
      compact: 'gap-2 p-3',
      md: 'gap-3 p-4',
      lg: 'gap-4 p-6',
    },
    variant: {
      // Cards rest at surface-3 of the elevation ladder (`bg-surface-3`): white
      // above the surface-1 page in light, one tinted step up in dark. `border`
      // keeps a hairline edge; `elevated` drops the border for the elevation
      // recipe — background and shadow both track the `elevation` prop
      // (default 3), applied in the render below; `filled` is the flat
      // subtle-fill idiom.
      border: 'border border-border bg-surface-3',
      elevated: '',
      filled: 'bg-muted',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'border',
  },
});

/** Join truthy class strings. (Local helper — this package ships no shared `cn`.) */
function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === 'string').join(' ');
}

export type CardSize = NonNullable<VariantProps<typeof card>['size']>;
export type CardVariant = NonNullable<VariantProps<typeof card>['variant']>;
export type CardProps = ViewProps & {
  size?: CardSize;
  variant?: CardVariant;
  /**
   * Ladder level for the `elevated` variant — drives both the surface fill
   * (`bg-surface-N`) and the `shadow-elevated-N` recipe (drop + dark-mode rim),
   * so fill and rim highlight sit at the same level. Ignored by `border`/
   * `filled`, which carry their own background and no shadow by design.
   * @default 3
   */
  elevation?: SurfaceLevel;
  ref?: Ref<View>;
};

export function Card({ size = 'md', variant = 'border', elevation = 3, className, ...props }: CardProps) {
  // React 19: ref is a plain prop and passes through via ...props.
  // `elevated` derives both its surface background and shadow from `elevation`
  // so the fill and the dark-mode rim highlight sit at the same ladder level.
  const surface = variant === 'elevated' ? `${surfaceBackground(elevation)} ${elevatedShadow(elevation)}` : undefined;
  return <View className={cn(card({ size, variant }), surface, className)} {...props} />;
}
