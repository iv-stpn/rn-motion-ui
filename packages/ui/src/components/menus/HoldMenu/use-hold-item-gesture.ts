import { useCallback, useMemo, useRef } from 'react';
import { Gesture, type GestureType } from 'react-native-gesture-handler';
import { runOnJS, runOnUI, type SharedValue } from 'react-native-reanimated';
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
  /** Inert trigger — no activation, no menu. */
  disabled: boolean;
  canCallActivateFunctions: () => boolean;
  didMeasureLayout: SharedValue<boolean>;
  activateAnimation: () => void;
  isActive: SharedValue<boolean>;
  scaleHold: () => void;
  scaleTap: () => void;
  scaleBack: () => void;
  activateFromContextMenu: () => void;
  /** Fires consumer `onHold` + `onOpenChange(true)` — hold / tap / double-tap. */
  onActivateJS: () => void;
  /** Fires consumer `onOpenChange(true)` — the context-menu (right-click / keyboard) path. */
  onOpenJS: () => void;
};

type UseHoldItemGestureResult = {
  /**
   * The composed gesture, or `null` on web where activation is DOM events
   * (`contextmenu` for hold, `onClick` for tap/double-tap`) — RNGH web
   * gestures need trusted pointer events, which synthetic clicks (tests,
   * automation) cannot produce — and on a disabled trigger.
   */
  gesture: GestureType | null;
  handleContextMenu: (event: ContextMenuEvent) => void;
  /** Web tap/double-tap — a click handler with a manual double-tap window. */
  handleWebTap: () => void;
  /** Web touch hold — a touch long-press meaning "hold" where there is no drag and no gesture. */
  handleWebHold: () => void;
  /** The activation worklet — exposed for the drag path, which fires it from `onHold`. */
  onActivate: () => void;
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
  disabled,
  canCallActivateFunctions,
  didMeasureLayout,
  activateAnimation,
  isActive,
  scaleHold,
  scaleTap,
  scaleBack,
  activateFromContextMenu,
  onActivateJS,
  onOpenJS,
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

  /** Gesture `onStart`: the activation worklet plus the JS consumer firing (`onHold` + open). */
  const onStart = useCallback(() => {
    'worklet';
    onActivate();
    runOnJS(onActivateJS)();
  }, [onActivate, onActivateJS]);

  const onFinish = useCallback(() => {
    'worklet';
    didMeasureLayout.value = false;
    if (isHold) scaleBack();
  }, [didMeasureLayout, isHold, scaleBack]);

  const handleContextMenu = useCallback(
    (event: ContextMenuEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onOpenJS();
      runOnUI(activateFromContextMenu)();
    },
    [activateFromContextMenu, onOpenJS],
  );

  /**
   * Web touch hold — the same firing as a tap, but from a touch long-press rather
   * than a click. Used where `webHold` is true and there is no drag to carry the
   * hold (a `'hold'` item without `dragOptions`): a phone's browser has no right
   * button, so the only gesture that means "hold" is a long press. The consumer
   * `onHold` fires (via `onActivateJS`), and the lift choreography runs.
   */
  const handleWebHold = useCallback(() => {
    onActivateJS();
    runOnUI(activateFromContextMenu)();
  }, [activateFromContextMenu, onActivateJS]);

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
      onActivateJS();
      runOnUI(activateFromContextMenu)();
      return;
    }
    const now = Date.now();
    // Consume the pair rather than leaving `last` set, so a third tap starts a
    // new pair instead of re-opening on every tap after the first two.
    if (now - lastTapRef.current <= DOUBLE_TAP_WINDOW) {
      lastTapRef.current = 0;
      onActivateJS();
      runOnUI(activateFromContextMenu)();
      return;
    }
    lastTapRef.current = now;
  }, [activateOn, activateFromContextMenu, onActivateJS]);

  const gesture = useMemo(() => {
    // Web activation is DOM events (`contextmenu` for hold, `onClick` for
    // tap/double-tap) — never an RNGH gesture, see `handleWebTap`. A disabled
    // trigger has no gesture at all.
    if (disabled || webHold || (IS_WEB && !isHold)) return null;
    if (isHold) return Gesture.LongPress().minDuration(longPressMinDurationMs).onStart(onStart).onFinalize(onFinish);
    return Gesture.Tap()
      .numberOfTaps(activateOn === 'double-tap' ? 2 : 1)
      .onStart(onStart)
      .onFinalize(onFinish);
  }, [disabled, webHold, isHold, longPressMinDurationMs, activateOn, onStart, onFinish]);

  return { gesture, handleContextMenu, handleWebTap, handleWebHold, onActivate };
}
