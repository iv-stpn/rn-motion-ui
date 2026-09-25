// biome-ignore-all lint/style/useExportsLast: the entry types head the module so the implementation below reads against them

import { CloseLine } from 'rn-motion-ui-icons/icons/close-line';
import type { SurfaceElevation } from '../../../lib/elevated';
import { useThemeColor } from '../../../theme/use-theme-color';
import { IconButton } from '../IconButton/icon-button';

export type CloseButtonSize = 'sm' | 'md' | 'lg';

export type CloseButtonProps = {
  /**
   * Hit-area size — controls both the touch target and the icon inside it.
   * @default 'md'
   */
  size?: CloseButtonSize;
  /**
   * Swap the button's ladder shadow for the shared compact floating shadow
   * (`shadow-floating`). It replaces the `shadow-elevated-N` rung rather than
   * adding to it, so the button keeps its `elevation` tint but trades the
   * layered drop for the halo. @default false
   */
  floating?: boolean;
  /**
   * Surface elevation level (0–3) — drives the background colour and the
   * `shadow-elevated-N` recipe (drop shadow + dark-mode rim). `0` is the flat
   * resting surface (no shadow or border) and the default — a CloseButton rests
   * flat on the page.
   * @default 0
   */
  elevation?: SurfaceElevation;
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

/** @deprecated Use IconButton with CloseLine at the call site. */
export function CloseButton({
  size = 'md',
  floating = false,
  elevation = 0,
  onPress,
  accessibilityLabel = 'Close',
  className,
  testID,
}: CloseButtonProps) {
  const iconColor = useThemeColor('muted-foreground');
  const buttonSize = { sm: 'xs', md: 'sm', lg: 'md' } as const;
  return (
    <IconButton
      icon={CloseLine}
      size={buttonSize[size]}
      iconColor={iconColor}
      contentClassName="bg-surface-selected hover:bg-surface-hover"
      density="compact"
      elevation={elevation}
      floating={floating}
      className={className}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
    />
  );
}
