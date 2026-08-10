import { useRef } from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { DynamicStyleProp, ExcludeFunctionKeys, UseDynamicAnimationState } from './types';

const fallback = () => ({});

/**
 * Creates a freeform animation state controller — an alternative to
 * {@link useAnimationState} that doesn't constrain you to pre-defined variant
 * keys.
 *
 * Unlike `useAnimationState` (which switches between named variants), this hook
 * lets you call `animateTo(nextStyle)` with any style object at any time. It is
 * the right choice when the target styles are computed dynamically rather than
 * chosen from a fixed set.
 *
 * ## Comparison with useAnimationState
 *
 * | Feature | `useAnimationState` | `useDynamicAnimation` |
 * |---|---|---|
 * | Style source | Pre-defined variant record | Any style object at call time |
 * | State shape | Named keys (`from`, `to`, …) | Arbitrary `DynamicStyleProp` |
 * | Best for | Known states (tabs, toggles, steps) | Computed styles (drag, scroll, gesture) |
 *
 * ```ts
 * const dynamic = useDynamicAnimation(() => ({ opacity: 0, translateX: -100 }))
 *
 * // Drive a MotiView
 * <MotiView state={dynamic} />
 *
 * // Animate to any style
 * dynamic.animateTo({ opacity: 1, translateX: 0 })
 * ```
 *
 * @param initialState - A factory returning the initial style (called once).
 *   Defaults to an empty object.
 * @returns A stable controller with `current` (the active style), `__state`
 *   (a Reanimated shared value to pass to a Moti component's `state` prop),
 *   and `animateTo(nextStyle | fn)`.
 */
export default function useDynamicAnimation<
  _Animate = ViewStyle | TextStyle | ImageStyle,
  Animate = ExcludeFunctionKeys<_Animate>,
>(initialState: () => DynamicStyleProp<Animate> = fallback) {
  // biome-ignore lint/plugin: lazy ref-init idiom — the ref is populated on first render below, so its initial value must be typed as the eventual shape
  const initializer = useRef<{ value: DynamicStyleProp<Animate> }>(null as unknown as { value: DynamicStyleProp<Animate> });
  if (initializer.current === null) initializer.current = { value: initialState() };

  const __state = useSharedValue(initializer.current.value);

  // biome-ignore lint/plugin: lazy ref-init idiom — the ref is populated on first render below, so its initial value must be typed as the eventual shape
  const controller = useRef<UseDynamicAnimationState<Animate>>(null as unknown as UseDynamicAnimationState<Animate>);

  if (controller.current === null) {
    // biome-ignore lint/plugin: the generic Animate can't be unified with the default DynamicStyleProp<ImageStyle & ViewStyle & TextStyle> shape of the object literal at this call-site
    controller.current = {
      __state,
      get current() {
        return __state.value;
      },
      animateTo(nextStateOrFunction) {
        'worklet';
        const nextStyle =
          typeof nextStateOrFunction === 'function'
            ? // biome-ignore lint/suspicious/noExplicitAny: worklet function cast — shared value type isn't narrowable without any
              // biome-ignore lint/plugin: worklet function cast — shared value type isn't narrowable without a cast
              (nextStateOrFunction as (s: any) => any)(__state.value)
            : nextStateOrFunction;
        // biome-ignore lint/suspicious/noExplicitAny: shared value assignment — generic Animate can't be expressed as the SharedValue's inferred type
        // biome-ignore lint/plugin: shared value assignment — generic Animate can't be expressed as the SharedValue's inferred type
        __state.value = nextStyle as any;
      },
    } as UseDynamicAnimationState<Animate>;
  }

  return controller.current;
}
