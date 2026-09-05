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
   * Swap the card's ladder shadow for the input field's large, diffuse halo
   * (`shadow-floating`). It replaces the `shadow-elevated-N` rung rather than
   * adding to it, so the card keeps its `elevation` tint but trades the
   * layered drop for the halo. @default false
   */
  floating?: boolean;
  /**
   * Ladder level for the surface — drives both the surface fill (`bg-surface-N`)
   * and the `shadow-elevated-N` recipe (drop + dark-mode rim), so fill and rim
   * highlight sit at the same level. `0` is the flat resting surface: a
   * `surface-3` fill with no shadow or border.
   * @default 0
   */
  elevation?: SurfaceElevation;
  /** When provided the card renders as a `Pressable` instead of a plain `View`. */
  onPress?: PressableProps['onPress'];
  ref?: Ref<View>;
};

export function Card({ size = 'md', floating = false, elevation = 0, className, onPress, ...props }: CardProps) {
  // The surface derives its background from `elevation`; `floating` swaps the
  // `shadow-elevated-N` rung for the input field's diffuse halo.
  const cardClassname = cn(card({ size }), surface(elevation, 'card', floating), className);
  if (onPress !== undefined) return <Pressable className={cardClassname} onPress={onPress} {...props} />;
  return <View className={cardClassname} {...props} />;
}
