import { useCallback } from 'react';
import { runOnUI } from 'react-native-reanimated';
import { type UseDraggableReturn, useDraggable } from '../../gestures/Draggable/use-draggable';
import type { HoldItemDragOptions } from './hold-menu-types';

type UseHoldItemDragOptions = {
  dragOptions: HoldItemDragOptions | undefined;
  /** Inert trigger — no drag. */
  disabled: boolean;
  testID: string | undefined;
  /** Minimum hold before the menu opens — the drag's `holdDelay`, so the hold and the drag lift at the same moment. */
  longPressMinDurationMs: number;
  /** The activation worklet (measure + squeeze + open), run from the drag's `onHold`. */
  activate: () => void;
  /** JS side of a hold: fire consumer `onHold` + `onOpenChange(true)`. */
  onActivate: () => void;
  /** Closes the menu (and its overlay) when the hold escapes into a drag. */
  closeMenu: () => void;
};

/**
 * The drag half of a `HoldItem`'s hold. Wires `HoldItemDragOptions` into
 * `useDraggable`: a hold that lands fires the JS consumer activation and runs
 * the activation worklet (so the menu opens and the item lifts), and a move past
 * `escapeSlop` after that fires `closeMenu` — the menu closes and its overlay
 * comes down — before the drag lifts the ghost. A missing `dragOptions` (or a
 * `disabled` trigger) makes the source inert, exactly as `useDraggable` does.
 */
export function useHoldItemDrag({
  dragOptions,
  disabled,
  testID,
  longPressMinDurationMs,
  activate,
  onActivate,
  closeMenu,
}: UseHoldItemDragOptions): UseDraggableReturn {
  const handleHold = useCallback(() => {
    onActivate();
    runOnUI(activate)();
  }, [onActivate, activate]);

  const handleHoldEscape = useCallback(() => {
    runOnUI(closeMenu)();
  }, [closeMenu]);

  return useDraggable({
    // `useDraggable` resolves `holdDelay` against the *drag* defaults, where web
    // has none (`null`) — a mouse never holds. This item's hold is the point, so
    // pin it to `longPressMinDurationMs` everywhere, exactly as the native
    // long-press gesture does: a touch hold on a phone's browser opens the menu
    // (or toggles the selection) at the same moment the drag is allowed to lift.
    behavior: { holdDelay: longPressMinDurationMs },
    data: dragOptions?.data,
    disabled: disabled || !dragOptions,
    effectAllowed: dragOptions?.effectAllowed,
    groups: dragOptions?.groups,
    onDragEnd: dragOptions?.onDragEnd,
    onDragStart: dragOptions?.onDragStart,
    onHold: dragOptions ? handleHold : undefined,
    onHoldEscape: dragOptions ? handleHoldEscape : undefined,
    preview: dragOptions?.preview,
    testID,
  });
}
