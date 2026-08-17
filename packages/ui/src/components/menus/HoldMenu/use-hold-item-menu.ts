import { useCallback, useRef } from 'react';
import { runOnJS, type SharedValue, useAnimatedReaction } from 'react-native-reanimated';
import { CONTEXT_MENU_STATE } from './constants';
import type { MenuItemProps } from './hold-menu-types';

type UseHoldItemMenuOptions = {
  items: MenuItemProps[];
  /** Inert trigger — no menu, no hold side-effect. */
  disabled: boolean;
  onHold: (() => void) | undefined;
  onOpenChange: ((open: boolean) => void) | undefined;
  state: SharedValue<CONTEXT_MENU_STATE>;
  isActive: SharedValue<boolean>;
  didMeasureLayout: SharedValue<boolean>;
  scaleBack: () => void;
};

type UseHoldItemMenuResult = {
  /** Hold / tap / double-tap: open the menu (when there is one) and fire the hold side-effect. */
  handleActivate: () => void;
  /** Context menu (right-click / keyboard): fire `onOpenChange(true)`, no hold side-effect. */
  handleOpen: () => void;
  /** Fires `onOpenChange(false)` once, when the menu actually closed after having opened. */
  handleClose: () => void;
  /** Closes the menu and its overlay when a hold escapes into a drag. */
  closeMenu: () => void;
};

/**
 * The menu lifecycle of a `HoldItem` — the bridge between the provider's `state`
 * shared value and the consumer's `onHold` / `onOpenChange` callbacks.
 *
 * `handleOpen` / `handleHold` mirror the activation firing semantics the
 * file-system relied on from `HoldContextMenu`: a hold opens the menu and fires
 * the hold side-effect, a context menu only opens it, and an empty (inert) row
 * fires the side-effect without opening anything. `handleClose` fires the close
 * side symmetrically, latched so a close that never opened doesn't fire.
 */
export function useHoldItemMenu({
  items,
  disabled,
  onHold,
  onOpenChange,
  state,
  isActive,
  didMeasureLayout,
  scaleBack,
}: UseHoldItemMenuOptions): UseHoldItemMenuResult {
  const canOpen = !disabled && items.length > 0;
  /** Latches "the menu opened" so the close side fires `onOpenChange(false)` symmetrically. */
  const openedRef = useRef(false);

  const handleOpen = useCallback(() => {
    if (canOpen) {
      openedRef.current = true;
      onOpenChange?.(true);
    }
  }, [canOpen, onOpenChange]);

  const handleHold = useCallback(() => {
    if (!disabled) onHold?.();
  }, [disabled, onHold]);

  const handleActivate = useCallback(() => {
    handleOpen();
    handleHold();
  }, [handleOpen, handleHold]);

  const handleClose = useCallback(() => {
    if (openedRef.current) {
      openedRef.current = false;
      onOpenChange?.(false);
    }
  }, [onOpenChange]);

  // Close side: when the provider's state reaches END, release the in-place item
  // and fire `onOpenChange(false)` — latched so a close that never opened doesn't.
  useAnimatedReaction(
    () => state.value,
    (_state) => {
      if (_state === CONTEXT_MENU_STATE.END) {
        isActive.value = false;
        didMeasureLayout.value = false;
        runOnJS(handleClose)();
      }
    },
  );

  /**
   * Runs on the UI thread so the state reset and the squeeze interrupt are
   * atomic: `scaleBack` cancels a squeeze still in flight, so its completion
   * cannot re-open the menu after a hold escapes into a drag.
   */
  const closeMenu = useCallback(() => {
    'worklet';
    state.value = CONTEXT_MENU_STATE.END;
    isActive.value = false;
    didMeasureLayout.value = false;
    scaleBack();
  }, [state, isActive, didMeasureLayout, scaleBack]);

  return { handleActivate, handleOpen, handleClose, closeMenu };
}
