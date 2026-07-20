import { useRef } from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { DynamicStyleProp, ExcludeFunctionKeys, UseDynamicAnimationState } from './types';

const fallback = () => ({});

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
