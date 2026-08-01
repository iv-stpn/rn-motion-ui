import { cva, type VariantProps } from 'class-variance-authority';
import type { Ref } from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../../../lib/cn';
import { elevatedShadow, type SurfaceLevel, surfaceBackground } from '../../../lib/elevated';

// cva drives the static styling layer — class strings are static literals so
// the Tailwind/uniwind scanner picks them up. Mirrors the Button pattern.
const card = cva('rounded-2xl', {
  variants: {
    size: { compact: 'gap-2 p-3', md: 'gap-3 p-4', lg: 'gap-4 p-6' },
  },
  defaultVariants: { size: 'md' },
});

export type CardSize = NonNullable<VariantProps<typeof card>['size']>;
export type CardProps = ViewProps & {
  size?: CardSize;
  /**
   * Ladder level for the surface — drives both the surface fill (`bg-surface-N`)
   * and the `shadow-elevated-N` recipe (drop + dark-mode rim), so fill and rim
   * highlight sit at the same level.
   * @default 3
   */
  elevation?: SurfaceLevel;
  ref?: Ref<View>;
};

export function Card({ size = 'md', elevation = 3, className, ...props }: CardProps) {
  // The surface derives both its background and shadow from `elevation` so the
  // fill and the dark-mode rim highlight sit at the same ladder level.
  return <View className={cn(card({ size }), surfaceBackground(elevation), elevatedShadow(elevation), className)} {...props} />;
}
