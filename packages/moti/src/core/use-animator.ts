import { useEffect, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import type { InternalControllerState, UseAnimationState, UseAnimationStateConfig, Variants } from './types';

export default function useAnimationState<V extends Variants<V>>(
  _variants: V,
  // biome-ignore lint/plugin: 'from'/'to' string literals can't be proven to be keyof V for an arbitrary generic V; these are moti's documented default variant keys
  { from = 'from' as keyof V, to = 'to' as keyof V }: UseAnimationStateConfig<V> = {},
) {
  const controller = useRef<UseAnimationState<V>>(null);
  const __state = useSharedValue<InternalControllerState<V>>(from ? _variants[from] : 0);

  const selectedVariant = useRef(from);
  const variants = useRef(_variants);

  // biome-ignore lint/plugin: variants ref must stay in sync with the latest prop without triggering re-renders — a ref update is a side effect
  useEffect(
    function updateVariantsRef() {
      variants.current = _variants;
    },
    [_variants],
  );

  if (controller.current === null)
    controller.current = {
      __state,
      transitionTo(nextStateOrFunction) {
        const runTransition = (nextStateKey: keyof V) => {
          selectedVariant.current = nextStateKey;
          const value = variants.current[nextStateKey];
          if (value) __state.value = value;
        };

        // biome-ignore lint/plugin: UseAnimationState types `current` as `keyof V | null`; runTransition needs the non-null key and the getter guarantees it
        if (typeof nextStateOrFunction === 'function') runTransition(nextStateOrFunction(this.current as keyof V));
        else runTransition(nextStateOrFunction);
      },
      get current(): keyof V {
        return selectedVariant.current;
      },
    };

  // biome-ignore lint/plugin: initial transition on mount must fire as a side effect after the controller ref is set up — cannot be expressed as derived state
  useEffect(
    function maybeTransitionOnMount() {
      if (variants.current[to]) {
        if (variants.current[from]) controller.current?.transitionTo(to);
        else
          console.error(
            `🐼 [moti]: Called useAnimationState with a "to" variant, but you are missing a "from" variant. A "from" variant is required if you are using "to". Instead, you passed these variants: "${Object.keys(
              variants.current,
            ).join(
              ', ',
            )}". If you want to just use the "to" value without "from", you shouldn't use this hook. Instead, just pass your values to a Moti component's "animate" prop.`,
          );
      }
    },
    [from, to],
  );

  // biome-ignore lint/plugin: controller.current is guaranteed non-null by the lazy-init block above, but TS can't track that across the ref; the cast preserves the hook's non-null return type
  return controller.current as UseAnimationState<V>;
}
