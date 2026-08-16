import { memo, useId, useMemo } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { HoldItemTwin } from './hold-item-twin';
import { CONTEXT_MENU_STATE, HOLD_ITEM_TRANSFORM_DURATION, HOLD_MENU_LIFTS } from './hold-menu-constants';
import { useHoldMenuInternal } from './hold-menu-context';
import type { HoldItemProps } from './hold-menu-types';
import { useHoldItemActivation } from './use-hold-item-activation';
import { useHoldItemGesture } from './use-hold-item-gesture';
import { useHoldItemSqueeze } from './use-hold-item-squeeze';

/**
 * The gesture + portal wrapper — upstream's `HoldItem`, modernized to the
 * react-native-gesture-handler v2 `Gesture` API.
 *
 * Activation is measured on the UI thread (`measure()` inside the gesture's
 * `onStart` worklet) — no `measureInWindow` round-trip, no layout-state race —
 * and drives the menu through the provider's `menuProps` shared value. The
 * squeeze/lift animation, the measurement worklets and the gesture layer live
 * in `use-hold-item-squeeze.ts` / `use-hold-item-activation.ts` /
 * `use-hold-item-gesture.ts`; the permanent portal twin lives in
 * `HoldItemTwin` (see its doc for why the twin never remounts).
 *
 * ## Web
 *
 * On web (`HOLD_MENU_LIFTS` is false) the interaction is a right-click for
 * `'hold'` — the wrapper's `contextmenu` handler, which browsers also raise
 * for Shift+F10 and the ContextMenu key on a focused element, so the keyboard
 * path comes for free. The children render ONCE: the twin is skipped entirely,
 * so the DOM is never duplicated, and the in-place copy never hides.
 * `'tap'` / `'double-tap'` keep the press on web through the same `Gesture.Tap`
 * the native build uses.
 */
const HoldItemComponent = ({
  items,
  bottom,
  containerStyles,
  disableMove,
  menuAnchorPosition,
  activateOn,
  hapticFeedback,
  actionParams,
  closeOnTap,
  longPressMinDurationMs = 150,
  testID,
  children,
}: HoldItemProps) => {
  const { state, menuProps, windowSize, safeAreaInsets, reducedMotion, rootRef } = useHoldMenuInternal();

  const isActive = useSharedValue(false);
  /** Stable key for the portal twin — generated once per item, never changes. */
  const name = `hold-item-${useId()}`;
  const containerRef = useAnimatedRef<Animated.View>();

  const { itemScale, isHold, canCallActivateFunctions, scaleHold, scaleTap, scaleBack } = useHoldItemSqueeze({
    activateOn,
    hapticFeedback,
    items,
    state,
    isActive,
    reducedMotion,
  });

  const {
    itemRectY,
    itemRectX,
    itemRectWidth,
    itemRectHeight,
    transformOrigin,
    didMeasureLayout,
    activateAnimation,
    activateFromContextMenu,
  } = useHoldItemActivation({
    containerRef,
    rootRef,
    items,
    actionParams,
    disableMove,
    bottom,
    menuAnchorPosition,
    testID,
    menuProps,
    windowSize,
    safeAreaInsets,
    state,
    scaleHold,
  });

  const webHold = !HOLD_MENU_LIFTS && isHold;

  const { gesture, handleContextMenu, handleWebTap } = useHoldItemGesture({
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
  });

  const animatedContainerStyle = useAnimatedStyle(() => {
    const animateOpacity = () =>
      withDelay(reducedMotion.value === 1 ? 0 : HOLD_ITEM_TRANSFORM_DURATION, withTiming(1, { duration: 0 }));

    // The in-place item never travels. Only the portal twin (native) carries
    // the travel that keeps the pair on screen when the menu overflows — and
    // on web there is no twin, so the item stays put and only squeezes/scales.
    // This mirrors upstream, whose in-place item animates scale + opacity
    // alone.
    return {
      opacity: isActive.value && HOLD_MENU_LIFTS ? 0 : animateOpacity(),
      transform: [
        {
          scale: isActive.value
            ? withTiming(1, {
                duration: reducedMotion.value === 1 ? 0 : HOLD_ITEM_TRANSFORM_DURATION,
                easing: reducedMotion.value === 1 ? undefined : Easing.out(Easing.cubic),
              })
            : itemScale.value,
        },
      ],
    };
  }, [reducedMotion, isActive, itemScale]);

  const containerStyle = useMemo(() => [containerStyles, animatedContainerStyle], [containerStyles, animatedContainerStyle]);

  useAnimatedReaction(
    () => state.value,
    (_state) => {
      if (_state === CONTEXT_MENU_STATE.END) {
        isActive.value = false;
        didMeasureLayout.value = false;
      }
    },
  );

  // RNW forwards onContextMenu/onClick/tabIndex on View, but RN's core types
  // do not declare them — the cast keeps the web-only props off the native type.
  let webOnlyProps: Record<string, unknown> = {};
  if (webHold) webOnlyProps = { onContextMenu: handleContextMenu, tabIndex: 0 };
  else if (!HOLD_MENU_LIFTS) webOnlyProps = { onClick: handleWebTap, tabIndex: 0 };

  const wrapper = (
    <Animated.View ref={containerRef} style={containerStyle} testID={testID} {...webOnlyProps}>
      {children}
    </Animated.View>
  );

  const gestureWrapper = gesture ? <GestureDetector gesture={gesture}>{wrapper}</GestureDetector> : wrapper;

  return (
    <>
      {gestureWrapper}
      {HOLD_MENU_LIFTS ? (
        <HoldItemTwin
          closeOnTap={closeOnTap}
          disableMove={disableMove}
          isActive={isActive}
          itemRectHeight={itemRectHeight}
          itemRectWidth={itemRectWidth}
          itemRectX={itemRectX}
          itemRectY={itemRectY}
          itemScale={itemScale}
          items={items}
          name={name}
          transformOrigin={transformOrigin}
        >
          {children}
        </HoldItemTwin>
      ) : null}
    </>
  );
};

const HoldItem = memo(HoldItemComponent);

export { HoldItem };
