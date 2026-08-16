import { memo } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { CONTEXT_MENU_STATE, HOLD_ITEM_TRANSFORM_DURATION, IS_WEB } from './constants';
import { useHoldMenuInternal } from './context';
import { BACKDROP_DARK_BACKGROUND_COLOR, BACKDROP_LIGHT_BACKGROUND_COLOR } from './hold-menu-theme';

/**
 * The scrim behind the open menu — upstream's `Backdrop`. Always mounted in
 * the portal host, it fades in when the menu becomes active and slides off the
 * bottom of the window after exit (`withDelay` + `withTiming(windowHeight)`).
 * A tap with less than 10 px of movement closes the menu.
 *
 * A plain opacity-faded dim, not a blur: the near-opaque scrim color sits on
 * the same view whose `opacity` animates, so the layer fades in and out
 * without a full-screen expo-blur `BlurView` — whose first reveal blocks the
 * UI thread on device and delays the open.
 */
const BackdropComponent = () => {
  const { state, theme, windowSize } = useHoldMenuInternal();

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
    const backgroundColor = theme.value === 'light' ? BACKDROP_LIGHT_BACKGROUND_COLOR : BACKDROP_DARK_BACKGROUND_COLOR;
    return { backgroundColor };
  }, [theme]);

  // RNW forwards onClick on View, but RN's core types do not declare it — the
  // cast keeps the web-only prop off the native type (same pattern as HoldItem).
  // biome-ignore lint/plugin: RNW View accepts onClick at runtime
  const webProps = { onClick: closeIfActive } as Record<string, unknown>;

  return IS_WEB ? (
    <Animated.View {...webProps} className="absolute inset-0 z-0" style={[animatedContainerStyle, animatedBackgroundStyle]} />
  ) : (
    <GestureDetector gesture={tapGesture}>
      <Animated.View className="absolute inset-0 z-0" style={[animatedContainerStyle, animatedBackgroundStyle]} />
    </GestureDetector>
  );
};

export const Backdrop = memo(BackdropComponent);
