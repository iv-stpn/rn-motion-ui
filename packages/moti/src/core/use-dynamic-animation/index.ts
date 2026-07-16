import { useRef } from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { DynamicStyleProp, ExcludeFunctionKeys, UseDynamicAnimationState } from '../types';

const fallback = () => ({});

export default function useDynamicAnimation<
  _Animate = ViewStyle | TextStyle | ImageStyle,
  Animate = ExcludeFunctionKeys<_Animate>,
>(initialState: () => DynamicStyleProp<Animate> = fallback) {
  const initializer = useRef<{ value: DynamicStyleProp<Animate> }>(
    null as unknown as { value: DynamicStyleProp<Animate> },
  );
  if (initializer.current === null) {
    initializer.current = { value: initialState() };
  }

  const __state = useSharedValue(initializer.current.value);

  const controller = useRef<UseDynamicAnimationState<Animate>>(null as unknown as UseDynamicAnimationState<Animate>);

  if (controller.current == null) {
    // Cast needed: the generic Animate can't be unified with the default
    // DynamicStyleProp<ImageStyle & ViewStyle & TextStyle> at this call-site.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    controller.current = {
      __state,
      get current() {
        return __state.value;
      },
      animateTo(nextStateOrFunction) {
        'worklet';
        const nextStyle =
          typeof nextStateOrFunction === 'function'
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (nextStateOrFunction as (s: any) => any)(__state.value)
            : nextStateOrFunction;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        __state.value = nextStyle as any;
      },
    } as UseDynamicAnimationState<Animate>;
  }

  return controller.current as UseDynamicAnimationState<Animate>;
}
