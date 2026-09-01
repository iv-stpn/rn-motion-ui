import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
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
  testID?: string;
};

/**
 * Full-window layer that folds the host on an outside tap and carries the
 * optional scrim. Rendered inside the small root but measured to cover the
 * whole window, so a tap anywhere outside the pane — the page, the header,
 * another control — lands here and dismisses. Sits below the shell, above the
 * page.
 */
export function OutsidePressBackdrop({ frame, onPress, overlay = 'none', testID }: OutsidePressBackdropProps) {
  const handlePress = useCallback(() => onPress?.(), [onPress]);
  const frameStyle = {
    position: 'absolute' as const,
    top: frame.top,
    left: frame.left,
    width: frame.width,
    height: frame.height,
  };
  return (
    <>
      {/*
       * The blur is a sibling behind the dim so its backdrop-filter samples the
       * page (not the flat dim above it). `inline`: this scrim lives inside the
       * BlurTarget it blurs on Android, which the peer can't render — it degrades
       * to the plain dim there, same as the HoldMenu backdrop.
       */}
      {overlay === 'blur' ? (
        <View pointerEvents="none" style={frameStyle}>
          <OverlayBlur inline={true} />
        </View>
      ) : null}
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? 'Close' : undefined}
        testID={testID}
        onPress={onPress ? handlePress : undefined}
        className={overlay === 'none' ? undefined : 'bg-black/40'}
        style={frameStyle}
      />
    </>
  );
}
