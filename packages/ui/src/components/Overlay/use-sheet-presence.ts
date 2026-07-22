import { useEffect, useState } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const OPEN_SPRING = { damping: 32, stiffness: 300, mass: 0.75 };
const CLOSE_SPRING = { damping: 40, stiffness: 300, mass: 0.75, overshootClamping: true };

export type SheetSpringConfig = { damping: number; stiffness: number; mass: number; overshootClamping?: boolean };

export type UseSheetPresenceOptions = {
  /** Whether the sheet is currently open. */
  open: boolean;
  /** Full-screen dimension in the slide direction (px). */
  screenExtent: number;
  /** Called after the close spring settles and the component is unmounted. */
  onAfterClose?: () => void;
  /** Spring config overrides for the open (enter) transition. */
  openSpring?: Partial<SheetSpringConfig>;
  /** Spring config overrides for the close (exit) transition. */
  closeSpring?: Partial<SheetSpringConfig>;
};

/**
 * Manages mount state + directional spring for slide-from-edge sheets.
 *
 * Generalised from the private `useSlideSheetPresence` in BottomSheet.
 * Returns a `translateY` shared value (positive = below screen) and `isMounted`
 * so the caller can conditionally render the sheet.
 *
 * @example
 * const { isMounted, translateY } = useSheetPresence({ open, screenExtent: height });
 * const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
 */
export function useSheetPresence({ open, screenExtent, onAfterClose, openSpring, closeSpring }: UseSheetPresenceOptions) {
  const [isMounted, setIsMounted] = useState(open);
  const translateY = useSharedValue(open ? 0 : screenExtent);

  const resolvedOpen = { ...OPEN_SPRING, ...openSpring };
  const resolvedClose = { ...CLOSE_SPRING, ...closeSpring };

  // biome-ignore lint/correctness/useExhaustiveDependencies: screenExtent and callbacks are stable refs — only `open` drives slide animation
  // biome-ignore lint/plugin: slide animation tied to `open` — effect intentionally omits stable refs
  useEffect(() => {
    if (open) {
      setIsMounted(true);
      translateY.value = withSpring(0, resolvedOpen);
    } else if (isMounted)
      translateY.value = withSpring(screenExtent, { ...resolvedClose }, (finished) => {
        if (finished) {
          scheduleOnRN(setIsMounted, false);
          if (onAfterClose) scheduleOnRN(onAfterClose);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { isMounted, translateY };
}
