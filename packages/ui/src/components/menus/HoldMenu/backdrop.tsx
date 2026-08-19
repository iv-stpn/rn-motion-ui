import { memo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { OverlayBlur } from '../Overlay/overlay-blur';
import { CONTEXT_MENU_STATE, HOLD_ITEM_TRANSFORM_DURATION, IS_WEB } from './constants';
import { useHoldMenuInternal } from './context';
import { BACKDROP_BLUR_BACKGROUND_COLOR } from './hold-menu-theme';

/**
 * The scrim behind the open menu — upstream's `Backdrop`. Always mounted in
 * the portal host, it fades in when the menu becomes active and slides off the
 * bottom of the window after exit (`withDelay` + `withTiming(windowHeight)`).
 * A tap with less than 10 px of movement closes the menu.
 *
 * The scrim is a `BlurView` under a translucent dim (`OverlayBlur` +
 * `BACKDROP_BLUR_BACKGROUND_COLOR`), so the page behind reads as frosted glass
 * instead of a flat wash. `OverlayBlur` resolves to `react-native-blur`'s
 * native `BlurView` on iOS/Android and its CSS-`backdrop-filter` twin in the
 * browser, so the frosted look is consistent everywhere. The container's
 * `opacity` still drives the fade, so blur and dim come up together.
 */
const BackdropComponent = () => {
  const { state, windowSize } = useHoldMenuInternal();

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Native: an RNGH `Gesture.Tap` with upstream's 10 px movement threshold —
  // a finger that moved is a scroll, not a dismiss. Web: RNGH web gestures
  // cannot fire on synthetic pointer events (its event manager calls
  // `setPointerCapture`, which browsers reject for untrusted pointers), so
  // web closes on a plain `onClick` — a click has no movement by definition.
  const closeIfActive = () => {
    'worklet';
    if (state.value === CONTEXT_MENU_STATE.ACTIVE) state.value = CONTEXT_MENU_STATE.END;
  };

  const tapGesture = Gesture.Tap()
    .onBegin((event) => {
      startX.value = event.x;
      startY.value = event.y;
    })
    .onEnd((event) => {
      const distance = Math.hypot(event.x - startX.value, event.y - startY.value);
      const shouldClose = distance < 10;
      const isStateActive = state.value === CONTEXT_MENU_STATE.ACTIVE;

      if (shouldClose && isStateActive) state.value = CONTEXT_MENU_STATE.END;
    });

  const animatedContainerStyle = useAnimatedStyle(() => {
    const topValueAnimation = () =>
      state.value === CONTEXT_MENU_STATE.ACTIVE
        ? 0
        : withDelay(HOLD_ITEM_TRANSFORM_DURATION, withTiming(windowSize.value.height, { duration: 0 }));

    const opacityValueAnimation = () =>
      withTiming(state.value === CONTEXT_MENU_STATE.ACTIVE ? 1 : 0, { duration: HOLD_ITEM_TRANSFORM_DURATION });

    return {
      top: topValueAnimation(),
      opacity: opacityValueAnimation(),
    };
  }, [windowSize]);

  const animatedBackgroundStyle = useAnimatedStyle(() => {
    // A light translucent dim over the `OverlayBlur` — a near-opaque scrim
    // would hide the blur entirely.
    return { backgroundColor: BACKDROP_BLUR_BACKGROUND_COLOR };
  }, []);

  // RNW forwards onClick on View, but RN's core types do not declare it — the
  // cast keeps the web-only prop off the native type (same pattern as HoldItem).
  // biome-ignore lint/plugin: RNW View accepts onClick at runtime
  const webProps = { onClick: closeIfActive } as Record<string, unknown>;

  // The blur under the dim. The dim lives on its own layer so the `OverlayBlur`
  // can sit beneath it — painting the dim as the container's own
  // `backgroundColor` would put it *behind* the blur, not over it.
  const backdropFill = (
    <>
      <OverlayBlur />
      <Animated.View className="absolute inset-0" style={animatedBackgroundStyle} />
    </>
  );

  return IS_WEB ? (
    <Animated.View {...webProps} className="absolute inset-0 z-0" style={animatedContainerStyle}>
      {backdropFill}
    </Animated.View>
  ) : (
    <GestureDetector gesture={tapGesture}>
      <Animated.View className="absolute inset-0 z-0" style={animatedContainerStyle}>
        {backdropFill}
      </Animated.View>
    </GestureDetector>
  );
};

export const Backdrop = memo(BackdropComponent);
