import { type RefObject, useEffect } from 'react';
import { BackHandler, Platform, type View } from 'react-native';

/** Dismiss on Escape, native Back, or interaction outside the action controls. */
export function useActionFABDismiss(controlsRef: RefObject<View | null>, open: boolean, close: () => void) {
  // biome-ignore lint/plugin: platform dismissal subscribes to external keyboard/back events while open.
  useEffect(() => {
    if (!open) return;
    if (Platform.OS !== 'web') {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        close();
        return true;
      });
      return () => subscription.remove();
    }
    // biome-ignore lint/plugin: RNW's View ref is an HTMLElement on web.
    const controls = controlsRef.current as unknown as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && controls?.contains(event.target)) return;
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [controlsRef, open, close]);
}
