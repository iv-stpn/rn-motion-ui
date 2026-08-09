// biome-ignore-all lint/style/useExportsLast: the entry types head the module so the implementation below reads against them

import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { CloseLine } from 'rn-motion-ui-icons/icons/close-line';
import { usePressState } from '../../../hooks/use-press-state';
import { cn } from '../../../lib/cn';
import { elevatedShadow, type SurfaceLevel, surfaceBackground } from '../../../lib/elevated';
import { ThemedIcon } from '../../icon/themed-icon';

export type CloseButtonSize = 'sm' | 'md' | 'lg';

/**
 * Per-size dimensions.
 *
 * The hit area is square so `rounded-full` on the outer shell produces a
 * circle. Sizes track the interactive-surface token ramp from tokens.css
 * (24 / 32 / 40 px) — the close button matches the primary button heights so a
 * row of mixed controls lines up.
 */
const SIZE_SCALE: Record<CloseButtonSize, { shellClass: string; iconSize: number }> = {
  sm: { shellClass: 'h-6 w-6 rounded-full', iconSize: 14 },
  md: { shellClass: 'h-8 w-8 rounded-full', iconSize: 18 },
  lg: { shellClass: 'h-10 w-10 rounded-full', iconSize: 22 },
};

export type CloseButtonProps = {
  /**
   * Hit-area size — controls both the touch target and the icon inside it.
   * @default 'md'
   */
  size?: CloseButtonSize;
  /**
   * Surface elevation level (1–8) — drives the background colour and the
   * drop-shadow + dark-mode rim. Defaults to 3, the resting level for cards
   * and popovers, so the button floats just above the page.
   * @default 3
   */
  elevation?: SurfaceLevel;
  /** Called when the button is pressed. Wire it to the panel's close handler. */
  onPress?: () => void;
  /**
   * Accessible name announced to assistive tech.
   * @default 'Close'
   */
  accessibilityLabel?: string;
  /** Merged onto the outer shell — use to position the button within a header. */
  className?: string;
  testID?: string;
};

/**
 * A themed close button — a circular elevated surface with a centred ✕ icon.
 *
 * The outer shell carries a surface background and drop shadow (with a dark-mode
 * rim), so the button floats above the panel it sits in rather than blending
 * into it. An inner `Pressable` fills the circle and drives the hover / press
 * overlays: `bg-surface-hover` on hover and `bg-surface-selected` on press,
 * matching the row highlight pattern from {@link MenuItem}. The icon is tinted
 * `muted-foreground` so it stays subordinate to the title.
 *
 * @example
 * // Floating over a sheet header:
 * <View className="flex-row items-center justify-between">
 *   <Text className="font-semibold text-xl">Title</Text>
 *   <CloseButton onPress={handleClose} />
 * </View>
 *
 * @example
 * // Larger, higher float for a full-screen overlay:
 * <CloseButton size="lg" elevation={5} onPress={handleClose} />
 */
export function CloseButton({
  size = 'md',
  elevation = 3,
  onPress,
  accessibilityLabel = 'Close',
  className,
  testID,
}: CloseButtonProps) {
  const [hovered, setHovered] = useState(false);
  const { pressed, pressHandlers } = usePressState();

  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);

  const scale = SIZE_SCALE[size];

  return (
    <View
      className={cn('overflow-hidden', scale.shellClass, surfaceBackground(elevation), elevatedShadow(elevation), className)}
      testID={testID}
    >
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        className={cn(
          'h-full w-full items-center justify-center',
          hovered && 'bg-surface-hover',
          pressed && 'bg-surface-selected',
        )}
        hitSlop={8}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onPress={onPress}
        {...pressHandlers}
      >
        <ThemedIcon icon={CloseLine} token="muted-foreground" size={scale.iconSize} />
      </Pressable>
    </View>
  );
}
