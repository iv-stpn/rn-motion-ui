import { memo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { HoldMenuBlur } from './hold-menu-blur';
import { CONTEXT_MENU_STATE, HOLD_ITEM_TRANSFORM_DURATION, HOLD_MENU_LIFTS } from './hold-menu-constants';
import { useHoldMenuInternal } from './hold-menu-context';
import { BACKDROP_DARK_BACKGROUND_COLOR, BACKDROP_LIGHT_BACKGROUND_COLOR } from './hold-menu-theme';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
});

/**
 * The scrim behind the open menu — upstream's `Backdrop`. Always mounted in
 * the portal host, it fades in when the menu becomes active and slides off the
 * bottom of the window after exit (`withDelay` + `withTiming(windowHeight)`).
 * A tap with less than 10 px of movement closes the menu.
 *
 * On iOS the blur layer is an expo-blur `BlurView` with the intensity animated
 * 0↔100 (via the platform-split `HoldMenuBlur`); the colored overlay renders
 * ABOVE the blur, exactly as upstream lays it out. Android and web get the
 * plain dim — and on web this is what makes clicking outside close the menu.
 */
const BackdropComponent = () => {
  const { state, theme, windowSize, reducedMotion, menuProps } = useHoldMenuInternal();

  const [activeTestID, setActiveTestID] = useState<string | undefined>(undefined);
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
    const duration = reducedMotion.value === 1 ? 0 : HOLD_ITEM_TRANSFORM_DURATION;

    const topValueAnimation = () =>
      state.value === CONTEXT_MENU_STATE.ACTIVE
        ? 0
        : withDelay(
            duration,
            withTiming(windowSize.value.height, {
              duration: 0,
            }),
          );

    const opacityValueAnimation = () =>
      withTiming(state.value === CONTEXT_MENU_STATE.ACTIVE ? 1 : 0, {
        duration,
        easing: Easing.out(Easing.cubic),
      });

    return {
      top: topValueAnimation(),
      opacity: opacityValueAnimation(),
    };
  }, [windowSize, reducedMotion]);

  const animatedInnerContainerStyle = useAnimatedStyle(() => {
    const backgroundColor = theme.value === 'light' ? BACKDROP_LIGHT_BACKGROUND_COLOR : BACKDROP_DARK_BACKGROUND_COLOR;

    return { backgroundColor };
  }, [theme]);

  useAnimatedReaction(
    () => menuProps.value.testID,
    (testID) => {
      runOnJS(setActiveTestID)(testID);
    },
    [menuProps],
  );

  const backdrop = (
    <HoldMenuBlur style={[styles.container, animatedContainerStyle]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, animatedInnerContainerStyle]}
        testID={activeTestID ? `${activeTestID}-backdrop` : undefined}
      />
    </HoldMenuBlur>
  );

  // Native wraps the backdrop in the movement-threshold tap gesture; web uses
  // a plain click — see `closeIfActive`.
  return HOLD_MENU_LIFTS ? (
    <GestureDetector gesture={tapGesture}>{backdrop}</GestureDetector>
  ) : (
    <HoldMenuBlur onClick={closeIfActive} style={[styles.container, animatedContainerStyle]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, animatedInnerContainerStyle]}
        testID={activeTestID ? `${activeTestID}-backdrop` : undefined}
      />
    </HoldMenuBlur>
  );
};

export const Backdrop = memo(BackdropComponent);
