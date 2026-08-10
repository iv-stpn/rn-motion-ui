import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import type { MotiTransition } from '../../core/types';
import { type MotiPressableInteractionIds, useMotiPressableContext } from './context';
import type { MotiPressableInteractionState } from './types';
import { useFactory } from './use-validate-factory-or-id';

type Factory = (interaction: MotiPressableInteractionState) => MotiTransition;
type Deps = unknown[] | null | undefined;

/**
 * Derives a transition config from a `<MotiPressable>` ancestor's interaction
 * state, so press/hover animations can change their spring/timing parameters
 * dynamically.
 *
 * ```tsx
 * const transition = useMotiPressableTransition(({ pressed }) =>
 *   pressed ? { type: 'timing', duration: 50 } : { type: 'spring', damping: 15 }
 * )
 * ```
 *
 * @param id - Optional pressable `id` to target a specific ancestor.
 * @param factory - Called with `{ hovered, pressed }`; must return a
 *   `MotiTransition` config.
 * @param deps - Optional dependency array.
 * @returns A readonly `SharedValue<MotiTransition>`.
 */
export function useMotiPressableTransition(
  id: MotiPressableInteractionIds['id'],
  factory: Factory,
  deps?: Deps,
): Readonly<SharedValue<MotiTransition>>;
export function useMotiPressableTransition(factory: Factory, deps?: Deps): Readonly<SharedValue<MotiTransition>>;
export function useMotiPressableTransition(
  factoryOrId: Factory | MotiPressableInteractionIds['id'],
  maybeFactoryOrDeps?: Factory | Deps,
  maybeDeps?: Deps,
): Readonly<SharedValue<MotiTransition>> {
  const context = useMotiPressableContext();

  const { factory, id } = useFactory<Factory>('useMotiPressableTransition', factoryOrId, maybeFactoryOrDeps, maybeDeps);

  // RNR4: useDerivedValue no longer accepts a dependency array.
  return useDerivedValue<MotiTransition>(
    () => context && factory(context.containers[id]?.value ?? { hovered: false, pressed: false }),
  );
}
