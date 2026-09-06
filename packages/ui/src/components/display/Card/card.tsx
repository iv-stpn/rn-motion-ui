import { cva, type VariantProps } from 'class-variance-authority';
import type { Ref } from 'react';
import { Pressable, type PressableProps, type View, type ViewProps } from 'react-native';
import { cn } from '../../../lib/cn';
import type { SurfaceElevation } from '../../../lib/elevated';
import { Surface } from '../Surface/surface';

// cva drives the padding layer by size; the radius + elevation (+ optional frost)
// come from the shared `Surface` primitive.
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
  /**
   * Backdrop blur radius in px/dp. `0` keeps the card a solid surface; any
   * positive value frosts it — a `glass` tint over a backdrop blur, with the
   * specular edge light when `rim` is also set. @default 0
   */
  blurRadius?: number;
  /** Opacity of the frosted tint (0–1); only thins the fill when `blurRadius` is set. @default 1 */
  opacity?: number;
  /** Draw the glass edge light — the `Rim` specular ring around the card. @default false */
  rim?: boolean;
  /** Rim width in px/dp. @default 1 */
  rimWidth?: number;
  /** Peak alpha (0–1) of the rim's specular highlight — lower is subtler. @default 0.5 */
  intensity?: number;
  /**
   * Set true when the card renders inside the `BlurTarget` it blurs on Android
   * (a card in the page). An inline pane degrades to the tint fill rather than
   * crash. @default false
   */
  inline?: boolean;
  /** When provided the card renders as a `Pressable` instead of a plain `View`. */
  onPress?: PressableProps['onPress'];
  ref?: Ref<View>;
};

export function Card({
  size = 'md',
  floating = false,
  elevation = 0,
  blurRadius = 0,
  opacity = 1,
  rim = false,
  rimWidth,
  intensity,
  inline = false,
  className,
  onPress,
  children,
  ...props
}: CardProps) {
  const surfaceProps = { elevation, floating, blurRadius, opacity, rim, rimWidth, intensity, inline, radius: 'card' as const };
  if (onPress !== undefined)
    return (
      <Surface {...surfaceProps} className={className} {...props}>
        <Pressable onPress={onPress} className={card({ size })}>
          {children}
        </Pressable>
      </Surface>
    );
  return (
    <Surface {...surfaceProps} className={cn(card({ size }), className)} {...props}>
      {children}
    </Surface>
  );
}
