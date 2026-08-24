import { cva, type VariantProps } from 'class-variance-authority';
import type { Ref } from 'react';
import { Pressable, type PressableProps, View, type ViewProps } from 'react-native';
import { cn } from '../../../lib/cn';
import type { SurfaceElevation } from '../../../lib/elevated';
import { surface } from '../../../lib/surface';

// cva drives the padding layer by size; the radius + elevation come from `surface`.
const card = cva('', {
  variants: {
    size: { compact: 'gap-2 p-3', md: 'gap-3 p-4', lg: 'gap-4 p-6' },
  },
  defaultVariants: { size: 'md' },
});

export type CardSize = NonNullable<VariantProps<typeof card>['size']>;
export type CardProps = ViewProps & {
  size?: CardSize;
  /**
   * Whether the card casts the `shadow-elevated-N` recipe (drop + dark rim).
   * `false` drops the shadow so the surface sits flat, keeping its surface tint.
   * @default true
   */
  elevated?: boolean;
  /**
   * Ladder level for the surface — drives both the surface fill (`bg-surface-N`)
   * and, when `elevated`, the `shadow-elevated-N` recipe (drop + dark-mode rim),
   * so fill and rim highlight sit at the same level. `0` is the flat resting
   * surface: a `surface-3` fill with no shadow or border.
   * @default 3
   */
  elevation?: SurfaceElevation;
  /** When provided the card renders as a `Pressable` instead of a plain `View`. */
  onPress?: PressableProps['onPress'];
  ref?: Ref<View>;
};

export function Card({ size = 'md', elevated = true, elevation = 3, className, onPress, ...props }: CardProps) {
  // The surface derives its background from `elevation` and its shadow from
  // `elevated` + `elevation`, so the fill and the dark-mode rim highlight sit at
  // the same ladder level.
  const cardClassname = cn(card({ size }), surface(elevation, 'card', elevated), className);
  if (onPress !== undefined) return <Pressable className={cardClassname} onPress={onPress} {...props} />;
  return <View className={cardClassname} {...props} />;
}
