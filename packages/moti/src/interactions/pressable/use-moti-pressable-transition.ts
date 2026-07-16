import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import type { MotiTransition } from '../../core';
import { type MotiPressableInteractionIds, useMotiPressableContext } from './context';
import type { MotiPressableInteractionState } from './types';
import { useFactory } from './use-validate-factory-or-id';

type Factory = (interaction: MotiPressableInteractionState) => MotiTransition;
type Deps = unknown[] | null | undefined;

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
  return useDerivedValue<MotiTransition>(() => {
    return context && factory(context.containers[id]?.value ?? { hovered: false, pressed: false });
  });
}
