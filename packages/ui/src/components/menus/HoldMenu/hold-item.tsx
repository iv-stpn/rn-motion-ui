import { memo, useId, useMemo } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { CONTEXT_MENU_STATE, HOLD_ITEM_TRANSFORM_DURATION, IS_WEB } from './constants';
import { useHoldMenuInternal } from './context';
import { HoldItemTwin } from './hold-item-twin';
import type { HoldItemProps } from './hold-menu-types';
import { useHoldItemActivation } from './use-hold-item-activation';
import { useHoldItemGesture } from './use-hold-item-gesture';
import { useHoldItemSqueeze } from './use-hold-item-squeeze';

/**
 * The gesture + portal wrapper — upstream's `HoldItem`, ported to the RNGH v2
 * `Gesture` API and Reanimated 4, with the sibling's portal primitive in place
 * of `@gorhom/portal`.
 *
 * The in-place wrapper holds the gesture and hides (opacity → 0) while active;
 * the permanent portal twin (`HoldItemTwin`) is the lifted copy that travels
 * with the panel. Activation is measured on the UI thread (`measure()` inside
 * the gesture's `onStart` worklet) and drives the menu through the provider's
 * `menuProps` shared value. The squeeze, measurement and gesture layers live in
 * `use-hold-item-squeeze.ts` / `use-hold-item-activation.ts` /
 * `use-hold-item-gesture.ts`.
 *
 * ## Web
 *
 * On web (`IS_WEB`) the interaction is a right-click for `'hold'` — the
 * wrapper's `contextmenu` handler, which browsers also raise for Shift+F10 and
 * the ContextMenu key on a focused element, so the keyboard path comes for free
 * — and a plain `onClick` for `'tap'` / `'double-tap'`. The lift is not
 * native-only: the twin renders on every platform, so on web the held item
 * still lifts and travels with the panel exactly as on native.
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
  children,
}: HoldItemProps) => {
  const { state, menuProps, windowSize, safeAreaInsets, rootRef } = useHoldMenuInternal();

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
    menuProps,
    windowSize,
    safeAreaInsets,
    scaleHold,
  });

  const webHold = IS_WEB && isHold;

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
    const animateOpacity = () => withDelay(HOLD_ITEM_TRANSFORM_DURATION, withTiming(1, { duration: 0 }));

    // The in-place item never travels. Only the portal twin carries the travel
    // that keeps the pair on screen when the menu overflows; this copy hides
    // under it while active and only squeezes/scales before that.
    return {
      opacity: isActive.value ? 0 : animateOpacity(),
      transform: [
        {
          scale: isActive.value ? withTiming(1, { duration: HOLD_ITEM_TRANSFORM_DURATION }) : itemScale.value,
        },
      ],
    };
  }, [isActive, itemScale]);

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
  else if (IS_WEB) webOnlyProps = { onClick: handleWebTap, tabIndex: 0 };

  const wrapper = (
    <Animated.View ref={containerRef} style={containerStyle} {...webOnlyProps}>
      {children}
    </Animated.View>
  );

  const gestureWrapper = gesture ? <GestureDetector gesture={gesture}>{wrapper}</GestureDetector> : wrapper;

  return (
    <>
      {gestureWrapper}
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
    </>
  );
};

export const HoldItem = memo(HoldItemComponent);
