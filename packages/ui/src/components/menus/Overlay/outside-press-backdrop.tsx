import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { EASE_OUT } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { TIMING_INSTANT } from '../../../theme/motion';
import { OverlayBlur } from './overlay-blur';
import type { OverlayType } from './overlay-type';

/** The backdrop's window-covering frame — negative offsets from the root's measured window position. */
export type OutsidePressFrame = { top: number; left: number; width: number; height: number };

export type OutsidePressBackdropProps = {
  /** The backdrop's window-covering frame. */
  frame: OutsidePressFrame;
  /** Fold the host on a backdrop tap. Undefined when `closeOnOutsidePress` is off — the layer then only dims. */
  onPress?: () => void;
  /** The scrim kind: `"blur"` frosts behind a dim, `"opacity"` dims only, `"none"` is transparent. @default 'none' */
  overlay?: OverlayType;
  /**
   * Whether the blur layer renders inline within the `BlurTarget` it frosts
   * (the Morphing* panes), which the Android peer cannot do — it degrades to
   * the dim there. Pass `false` when the backdrop is teleported OUT of the
   * target through the `BlurProvider` overlay host, so the blur renders.
   * @default true
   */
  blurInline?: boolean;
  testID?: string;
};

/**
 * Full-window layer that folds the host on an outside tap and carries the
 * optional scrim. Rendered inside the small root but measured to cover the
 * whole window, so a tap anywhere outside the pane — the page, the header,
 * another control — lands here and dismisses. Sits below the shell, above the
 * page.
 *
 * The dim fades its OWN opacity in on mount and out on exit (the caller
 * decides whether an exit runs by wrapping this in an `AnimatePresence` — the
 * MorphingFAB/Switcher backdrops do, so closing un-blurs progressively instead
 * of popping the scrim off in one frame). The blur is a SIBLING of the dim's
 * fade wrapper, never a child of it: an ancestor with `opacity < 1` becomes a
 * CSS "backdrop root" that clips a child's `backdrop-filter` on web, so the
 * blur layer carries its own opacity fade (see `OverlayBlur`).
 */
export function OutsidePressBackdrop({ frame, onPress, overlay = 'none', blurInline = true, testID }: OutsidePressBackdropProps) {
  const reduce = useReducedMotion();
  const handlePress = useCallback(() => onPress?.(), [onPress]);
  const frameStyle = {
    position: 'absolute' as const,
    top: frame.top,
    left: frame.left,
    width: frame.width,
    height: frame.height,
  };
  const fade = reduce ? TIMING_INSTANT : { type: 'timing' as const, duration: 200, easing: EASE_OUT };
  return (
    <>
      {/* The blur is a sibling behind the dim so its backdrop-filter samples the
       * page (not the flat dim above it). `blurInline` distinguishes the two
       * homes: inline (the Morphing* pane's own backdrop, inside the BlurTarget
       * it blurs on Android) degrades to the plain dim there, while a teleported
       * backdrop (rendered OUT of the target through the BlurProvider overlay
       * host) passes `blurInline={false}` so the frost actually renders.
       * `OverlayBlur` fades its own opacity (0→1 / 1→0) — see the module doc. */}
      {overlay === 'blur' ? (
        <View pointerEvents="none" style={frameStyle}>
          <OverlayBlur inline={blurInline} />
        </View>
      ) : null}
      <MotiView
        pointerEvents="box-none"
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fade}
        style={frameStyle}
      >
        <Pressable
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={onPress ? 'Close' : undefined}
          testID={testID}
          onPress={onPress ? handlePress : undefined}
          className={overlay === 'none' ? undefined : 'bg-black/40'}
          style={StyleSheet.absoluteFill}
        />
      </MotiView>
    </>
  );
}
