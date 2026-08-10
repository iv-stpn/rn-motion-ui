import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import type { MotiPressableContext } from './context';
import { useMotiPressableContext } from './context';
import type { MotiPressableInteractionProp } from './types';

type Factory = (containers: MotiPressableContext['containers']) => ReturnType<MotiPressableInteractionProp>;

/**
 * Like {@link useMotiPressable}, but the factory receives **all** ancestor
 * pressable containers at once — not just one.
 *
 * Use this when a component's animation depends on the interaction state of
 * multiple pressables (e.g. a panel that responds when *any* item in a list
 * is hovered).
 *
 * ```tsx
 * const state = useMotiPressables((containers) => {
 *   const anyPressed = Object.values(containers).some((v) => v.value.pressed)
 *   return { opacity: anyPressed ? 0.5 : 1 }
 * })
 * ```
 *
 * @param factory - Called with the full `containers` record (keyed by pressable
 *   `id`, with `__INTERACTION_CONTAINER_ID` being the nearest unnamed one).
 * @param deps - Dependency array for the factory.
 * @returns A `{ __state }` object to pass to a Moti component's `state` prop.
 */
export function useMotiPressables(factory: Factory, deps: readonly unknown[] = []) {
  const context = useMotiPressableContext();

  if (!deps) {
    console.warn(
      '[moti/interactions] useMotiPressables is missing a dependency array as the second argument. https://moti.fyi/interactions/use-pressables',
    );
  }

  // RNR4: useDerivedValue no longer accepts a dependency array.
  const __state = useDerivedValue(() => {
    return factory(context.containers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  return useMemo(() => ({ __state }), [__state]);
}
