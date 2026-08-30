import { useCallback } from 'react';
import { Pressable } from 'react-native';

/** The backdrop's window-covering frame — negative offsets from the root's measured window position. */
export type OutsidePressFrame = { top: number; left: number; width: number; height: number };

export type OutsidePressBackdropProps = {
  /** The backdrop's window-covering frame. */
  frame: OutsidePressFrame;
  /** Fold the host on a backdrop tap. Undefined when `closeOnOutsidePress` is off — the layer then only dims. */
  onPress?: () => void;
  /** When true, render the dimming scrim; otherwise the layer is transparent. @default false */
  overlay?: boolean;
  testID?: string;
};

/**
 * Full-window layer that folds the host on an outside tap and carries the
 * optional scrim. Rendered inside the small root but measured to cover the
 * whole window, so a tap anywhere outside the pane — the page, the header,
 * another control — lands here and dismisses. Sits below the shell, above the
 * page.
 */
export function OutsidePressBackdrop({ frame, onPress, overlay = false, testID }: OutsidePressBackdropProps) {
  const handlePress = useCallback(() => onPress?.(), [onPress]);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? 'Close' : undefined}
      testID={testID}
      onPress={onPress ? handlePress : undefined}
      className={overlay ? 'bg-black/40' : undefined}
      style={{ position: 'absolute', top: frame.top, left: frame.left, width: frame.width, height: frame.height }}
    />
  );
}
