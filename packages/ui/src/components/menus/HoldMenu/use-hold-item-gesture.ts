import { useCallback, useMemo, useRef } from 'react';
import { Gesture, type GestureType } from 'react-native-gesture-handler';
import { runOnUI, type SharedValue } from 'react-native-reanimated';
import { IS_WEB } from './constants';
import type { HoldItemProps } from './hold-menu-types';

/** The DOM `contextmenu` surface the web handler needs (RNW forwards it on View). */
type ContextMenuEvent = { preventDefault: () => void; stopPropagation: () => void };

/** Second tap must land within this to count as a double-tap. */
const DOUBLE_TAP_WINDOW = 300;

type UseHoldItemGestureOptions = {
  /** Web `'hold'` — no gesture at all, the wrapper's `contextmenu` opens the menu. */
  webHold: boolean;
  isHold: boolean;
  longPressMinDurationMs: number;
  activateOn: HoldItemProps['activateOn'];
  canCallActivateFunctions: () => boolean;
  didMeasureLayout: SharedValue<boolean>;
  activateAnimation: () => void;
  isActive: SharedValue<boolean>;
  scaleHold: () => void;
  scaleTap: () => void;
  scaleBack: () => void;
  activateFromContextMenu: () => void;
};

type UseHoldItemGestureResult = {
  /**
   * The composed gesture, or `null` on web where activation is DOM events
   * (`contextmenu` for hold, `onClick` for tap/double-tap) — RNGH web
   * gestures need trusted pointer events, which synthetic clicks (tests,
   * automation) cannot produce.
   */
  gesture: GestureType | null;
  handleContextMenu: (event: ContextMenuEvent) => void;
  /** Web tap/double-tap — a click handler with a manual double-tap window. */
  handleWebTap: () => void;
};

/**
 * The gesture layer of a `HoldItem` — upstream's `gestureEvent` (a legacy
 * `useAnimatedGestureHandler` over `LongPressGestureHandler` /
 * `TapGestureHandler`) ported to the RNGH v2 `Gesture` API.
 *
 * Activation (measure + publish + squeeze) runs in the gesture's `onStart`
 * worklet, gated by upstream's re-tap guard; `onFinalize` resets the
 * once-per-activation measure flag and releases the squeeze. On web `'hold'`
 * there is no gesture — the `contextmenu` handler measures and opens directly
 * (browsers also raise `contextmenu` for Shift+F10 and the ContextMenu key on
 * a focused element, so this is the keyboard path too).
 */
export function useHoldItemGesture({
  webHold,
  isHold,
  longPressMinDurationMs,
  activateOn,
  canCallActivateFunctions,
  didMeasureLayout,
  activateAnimation,
  isActive,
  scaleHold,
  scaleTap,
  scaleBack,
  activateFromContextMenu,
}: UseHoldItemGestureOptions): UseHoldItemGestureResult {
  const onActivate = useCallback(() => {
    'worklet';
    if (canCallActivateFunctions()) {
      if (!didMeasureLayout.value) activateAnimation();
      if (!isActive.value) {
        if (isHold) scaleHold();
        else scaleTap();
      }
    }
  }, [canCallActivateFunctions, didMeasureLayout, activateAnimation, isActive, isHold, scaleHold, scaleTap]);

  const onFinish = useCallback(() => {
    'worklet';
    didMeasureLayout.value = false;
    if (isHold) scaleBack();
  }, [didMeasureLayout, isHold, scaleBack]);

  const handleContextMenu = useCallback(
    (event: ContextMenuEvent) => {
      event.preventDefault();
      event.stopPropagation();
      runOnUI(activateFromContextMenu)();
    },
    [activateFromContextMenu],
  );

  /**
   * Web tap / double-tap activation. RNGH web gestures cannot fire on
   * synthetic pointer events (its event manager calls `setPointerCapture`,
   * which browsers reject for untrusted pointers), so on web the press is a
   * plain `onClick` with a manual double-tap window. Native keeps the `Gesture`
   * API.
   */
  const lastTapRef = useRef(0);
  const handleWebTap = useCallback(() => {
    if (activateOn === 'tap') {
      runOnUI(activateFromContextMenu)();
      return;
    }
    const now = Date.now();
    // Consume the pair rather than leaving `last` set, so a third tap starts a
    // new pair instead of re-opening on every tap after the first two.
    if (now - lastTapRef.current <= DOUBLE_TAP_WINDOW) {
      lastTapRef.current = 0;
      runOnUI(activateFromContextMenu)();
      return;
    }
    lastTapRef.current = now;
  }, [activateOn, activateFromContextMenu]);

  const gesture = useMemo(() => {
    // Web activation is DOM events (`contextmenu` for hold, `onClick` for
    // tap/double-tap) — never an RNGH gesture, see `handleWebTap`.
    if (webHold || (IS_WEB && !isHold)) return null;
    if (isHold) return Gesture.LongPress().minDuration(longPressMinDurationMs).onStart(onActivate).onFinalize(onFinish);
    return Gesture.Tap()
      .numberOfTaps(activateOn === 'double-tap' ? 2 : 1)
      .onStart(onActivate)
      .onFinalize(onFinish);
  }, [webHold, isHold, longPressMinDurationMs, activateOn, onActivate, onFinish]);

  return { gesture, handleContextMenu, handleWebTap };
}
