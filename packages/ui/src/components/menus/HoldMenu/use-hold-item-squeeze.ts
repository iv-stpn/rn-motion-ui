import { useCallback } from 'react';
import { runOnJS, type SharedValue, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import {
  CONTEXT_MENU_STATE,
  HOLD_ITEM_SCALE_DOWN_DURATION,
  HOLD_ITEM_SCALE_DOWN_VALUE,
  HOLD_ITEM_TRANSFORM_DURATION,
} from './hold-menu-constants';
import { fireHapticFeedback } from './hold-menu-haptics';
import type { HoldItemProps, MenuItemProps } from './hold-menu-types';

type UseHoldItemSqueezeOptions = {
  activateOn: HoldItemProps['activateOn'];
  hapticFeedback: HoldItemProps['hapticFeedback'];
  items: MenuItemProps[];
  state: SharedValue<CONTEXT_MENU_STATE>;
  isActive: SharedValue<boolean>;
  reducedMotion: SharedValue<0 | 1>;
};

type UseHoldItemSqueezeResult = {
  itemScale: SharedValue<number>;
  isHold: boolean;
  canCallActivateFunctions: () => boolean;
  scaleHold: () => void;
  scaleTap: () => void;
  scaleBack: () => void;
};

/**
 * The squeeze/lift animation of a `HoldItem` — upstream's `scaleHold`,
 * `scaleTap`, `scaleBack`, `onCompletion` and `canCallActivateFunctions`
 * worklets, extracted from the component so it stays under the per-function
 * line limit. Reduced motion collapses every duration to 0.
 */
export function useHoldItemSqueeze({
  activateOn,
  hapticFeedback,
  items,
  state,
  isActive,
  reducedMotion,
}: UseHoldItemSqueezeOptions): UseHoldItemSqueezeResult {
  const isAnimationStarted = useSharedValue(false);
  const itemScale = useSharedValue(1);

  const isHold = !activateOn || activateOn === 'hold';

  const hapticResponse = useCallback(() => {
    fireHapticFeedback(hapticFeedback);
  }, [hapticFeedback]);

  const scaleBack = useCallback(() => {
    'worklet';
    itemScale.value = withTiming(1, {
      duration: reducedMotion.value === 1 ? 0 : HOLD_ITEM_TRANSFORM_DURATION / 2,
    });
  }, [itemScale, reducedMotion]);

  const onCompletion = useCallback(
    (isFinised?: boolean) => {
      'worklet';
      const isListValid = items && items.length > 0;
      if (isFinised && isListValid) {
        state.value = CONTEXT_MENU_STATE.ACTIVE;
        isActive.value = true;
        scaleBack();
        if (hapticFeedback !== 'None') runOnJS(hapticResponse)();
      }

      isAnimationStarted.value = false;
    },
    [items, state, isActive, scaleBack, hapticFeedback, hapticResponse, isAnimationStarted],
  );

  const scaleHold = useCallback(() => {
    'worklet';
    itemScale.value = withTiming(
      HOLD_ITEM_SCALE_DOWN_VALUE,
      { duration: reducedMotion.value === 1 ? 0 : HOLD_ITEM_SCALE_DOWN_DURATION },
      onCompletion,
    );
  }, [itemScale, reducedMotion, onCompletion]);

  const scaleTap = useCallback(() => {
    'worklet';
    isAnimationStarted.value = true;

    itemScale.value = withSequence(
      withTiming(HOLD_ITEM_SCALE_DOWN_VALUE, {
        duration: reducedMotion.value === 1 ? 0 : HOLD_ITEM_SCALE_DOWN_DURATION,
      }),
      withTiming(
        1,
        {
          duration: reducedMotion.value === 1 ? 0 : HOLD_ITEM_TRANSFORM_DURATION / 2,
        },
        onCompletion,
      ),
    );
  }, [itemScale, reducedMotion, onCompletion, isAnimationStarted]);

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

  return { itemScale, isHold, canCallActivateFunctions, scaleHold, scaleTap, scaleBack };
}
