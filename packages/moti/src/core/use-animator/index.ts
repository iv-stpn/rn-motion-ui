import { useEffect, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { PackageName } from '../constants';
import type { InternalControllerState, UseAnimationState, UseAnimationStateConfig, Variants } from '../types';

export default function useAnimationState<V extends Variants<V>>(
  _variants: V,
  { from = 'from' as keyof V, to = 'to' as keyof V }: UseAnimationStateConfig<V> = {},
) {
  const controller = useRef<UseAnimationState<V>>(null);
  const __state = useSharedValue<InternalControllerState<V>>(from ? _variants[from] : 0);

  const selectedVariant = useRef(from);
  const variants = useRef(_variants);

  useEffect(
    function updateVariantsRef() {
      variants.current = _variants;
    },
    [_variants],
  );

  if (controller.current == null) {
    controller.current = {
      __state,
      transitionTo(nextStateOrFunction) {
        const runTransition = (nextStateKey: keyof V) => {
          selectedVariant.current = nextStateKey;
          const value = variants.current[nextStateKey];
          if (value) __state.value = value as InternalControllerState<V>;
        };

        if (typeof nextStateOrFunction === 'function') {
          runTransition(nextStateOrFunction(this.current as keyof V));
        } else {
          runTransition(nextStateOrFunction);
        }
      },
      get current(): keyof V {
        return selectedVariant.current as keyof V;
      },
    };
  }

  useEffect(
    function maybeTransitionOnMount() {
      if (variants.current[to]) {
        if (variants.current[from]) {
          controller.current?.transitionTo(to);
        } else {
          console.error(
            `🐼 [${PackageName}]: Called useAnimationState with a "to" variant, but you are missing a "from" variant. A "from" variant is required if you are using "to". Instead, you passed these variants: "${Object.keys(
              variants.current,
            ).join(
              ', ',
            )}". If you want to just use the "to" value without "from", you shouldn't use this hook. Instead, just pass your values to a ${PackageName} component's "animate" prop.`,
          );
        }
      }
    },
    [from, to],
  );

  return controller.current as UseAnimationState<V>;
}
