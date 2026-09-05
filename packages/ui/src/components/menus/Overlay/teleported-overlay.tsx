import type { ReactNode } from 'react';
import { View } from 'react-native';
import { OverlayPortal } from './overlay-host';
import { useOverlayHostWindowPosition } from './overlay-host-position';

type TeleportedOverlayProps = {
  /** When false this renders nothing — the caller stays inline. */
  teleported: boolean;
  /** The inline root's window offset (top-left), from `measureInWindow`. */
  rootWindow: { x: number; y: number } | null;
  /** The overlay's width — matches the inline root's current width. */
  width: number;
  /** The overlay's height — matches the inline root's current height. */
  height: number;
  children: ReactNode;
};

/**
 * Renders overlay content (the MorphingFAB/Switcher backdrop + shell) OUTSIDE
 * the `BlurTarget` through the `BlurProvider` overlay host, positioned at the
 * inline root's window position so the shell morphs in place instead of jumping
 * to the host's origin.
 *
 * On Android the target-based blur cannot render inside the target it frosts,
 * and cannot sit *behind* an overlay that lives inside the target — so the
 * Morphing* panes teleport here (a sibling of the target) exactly like
 * HoldMenu's backdrop/menu. The wrapper is `box-none` and only carries the
 * position; the backdrop and shell inside keep their own hit-testing. The
 * window-offset conversion mirrors HoldMenu's (`rootPageY - overlayHostPageY`):
 * the host's origin is the provider's parent, not the window, whenever that
 * parent is inset (storybook's chrome).
 *
 * Internal to the package — not exported.
 */
export function TeleportedOverlay({ teleported, rootWindow, width, height, children }: TeleportedOverlayProps) {
  const hostWindow = useOverlayHostWindowPosition();

  if (!teleported || rootWindow === null) return null;

  return (
    <OverlayPortal layer="menu">
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: rootWindow.y - hostWindow.y,
          left: rootWindow.x - hostWindow.x,
          width,
          height,
        }}
      >
        {children}
      </View>
    </OverlayPortal>
  );
}
