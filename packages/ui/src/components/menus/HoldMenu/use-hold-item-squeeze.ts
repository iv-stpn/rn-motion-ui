import { useCallback } from 'react';
import type { ViewStyle } from 'react-native';
import { runOnJS, type SharedValue, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { fireHapticFeedback } from '../../../lib/haptics';
import {
  CONTEXT_MENU_STATE,
  HOLD_ITEM_SCALE_DOWN_DURATION,
  HOLD_ITEM_SCALE_DOWN_VALUE,
  HOLD_ITEM_TRANSFORM_DURATION,
} from './constants';
import type { HoldItemProps, MenuItemProps } from './hold-menu-types';

type UseHoldItemSqueezeOptions = {
  activateOn: HoldItemProps['activateOn'];
  hapticFeedback: HoldItemProps['hapticFeedback'];
  items: MenuItemProps[];
  state: SharedValue<CONTEXT_MENU_STATE>;
  isActive: SharedValue<boolean>;
  /** Release handover, 0 = active (twin showing), 1 = released (this item showing). */
  releaseProgress: SharedValue<number>;
};

type UseHoldItemSqueezeResult = {
  itemScale: SharedValue<number>;
  isHold: boolean;
  canCallActivateFunctions: () => boolean;
  scaleHold: (duration?: number) => void;
  scaleTap: () => void;
  scaleBack: () => void;
  /** The in-place item's opacity/scale while it squeezes and hides under the twin. */
  animatedContainerStyle: ReturnType<typeof useAnimatedStyle<ViewStyle>>;
};

/**
 * The squeeze/lift animation of a `HoldItem` — upstream's `scaleHold`,
 * `scaleTap`, `scaleBack`, `onCompletion` and `canCallActivateFunctions`
 * worklets, extracted from the component so it stays under the per-function
 * line limit. Verbatim: the squeeze-down and the tap bounce use plain
 * `withTiming` (no easing), the completion callback flips the menu active and
 * fires haptics when the list is non-empty, and the re-tap guard stops
 * the tap animation from restarting mid-flight. One departure: an inert hold
 * (empty items — the mobile views' multi-select join) also scales back on
 * completion, so the press pulse returns to full size instead of staying stuck,
 * and it fires its haptic when one was passed — the touch cue the file-system's
 * mobile views enable for the long-press-into-selection.
 */
export function useHoldItemSqueeze({
  activateOn,
  hapticFeedback,
  items,
  state,
  isActive,
  releaseProgress,
}: UseHoldItemSqueezeOptions): UseHoldItemSqueezeResult {
  const isAnimationStarted = useSharedValue(false);
  const itemScale = useSharedValue(1);

  const isHold = !activateOn || activateOn === 'hold';

  const hapticResponse = useCallback(() => {
    fireHapticFeedback(hapticFeedback);
  }, [hapticFeedback]);

  const scaleBack = useCallback(() => {
    'worklet';
    itemScale.value = withTiming(1, { duration: HOLD_ITEM_TRANSFORM_DURATION / 2 });
  }, [itemScale]);

  const onCompletion = useCallback(
    (isFinised?: boolean) => {
      'worklet';
      const isListValid = items && items.length > 0;
      if (isFinised && isListValid) {
        state.value = CONTEXT_MENU_STATE.ACTIVE;
        isActive.value = true;
        scaleBack();
        if (hapticFeedback !== 'None') runOnJS(hapticResponse)();
      } else if (isFinised) {
        // No menu to pop into — an inert hold (empty items) is the multi-select join,
        // so the squeeze is just a press pulse: return to full size once it lands. It
        // still fires its haptic when one was explicitly passed — opt-in, unlike the
        // menu path, because there is no panel opening to signal by default.
        scaleBack();
        if (hapticFeedback !== undefined && hapticFeedback !== 'None') runOnJS(hapticResponse)();
      }

      isAnimationStarted.value = false;
    },
    [items, state, isActive, scaleBack, hapticFeedback, hapticResponse, isAnimationStarted],
  );

  const scaleHold = useCallback(
    (duration?: number) => {
      'worklet';
      const effectiveDuration = duration === undefined ? HOLD_ITEM_SCALE_DOWN_DURATION : duration;
      itemScale.value = withTiming(HOLD_ITEM_SCALE_DOWN_VALUE, { duration: effectiveDuration }, onCompletion);
    },
    [itemScale, onCompletion],
  );

  const scaleTap = useCallback(() => {
    'worklet';
    isAnimationStarted.value = true;

    itemScale.value = withSequence(
      withTiming(HOLD_ITEM_SCALE_DOWN_VALUE, { duration: HOLD_ITEM_SCALE_DOWN_DURATION }),
      withTiming(1, { duration: HOLD_ITEM_TRANSFORM_DURATION / 2 }, onCompletion),
    );
  }, [itemScale, onCompletion, isAnimationStarted]);

  /**
   * Upstream's re-tap guard: when activating by tap and the user taps again
   * while the scale animation is still running, the animation must not restart
   * — that was a real bug upstream fixed with this check.
   */
  const canCallActivateFunctions = useCallback(() => {
    'worklet';
    const willActivateWithTap = activateOn === 'double-tap' || activateOn === 'tap';

    return (willActivateWithTap && !isAnimationStarted.value) || !willActivateWithTap;
  }, [activateOn, isAnimationStarted]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    // The in-place item never travels. Only the portal twin carries the travel
    // that keeps the pair on screen when the menu overflows; this copy hides
    // under it while active and only squeezes/scales before that. Opacity stays
    // fully on while the twin fades in over it (0 < `releaseProgress` ≤ 1) and
    // snaps off the instant the twin is fully opaque (`releaseProgress` === 0),
    // so the pair never overlaps semi-transparently (a cross-fade would dim) and
    // never leaves a gap.
    return {
      opacity: releaseProgress.value > 0 ? 1 : 0,
      transform: [
        {
          scale: isActive.value ? withTiming(1, { duration: HOLD_ITEM_TRANSFORM_DURATION }) : itemScale.value,
        },
      ],
    };
  }, [isActive, itemScale, releaseProgress]);

  return { animatedContainerStyle, itemScale, isHold, canCallActivateFunctions, scaleHold, scaleTap, scaleBack };
}
