import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import type { MotiProps } from '../../core';
import { type MotiPressableInteractionIds, useMotiPressableContext } from './context';
import type { MotiPressableInteractionProp } from './types';
import { useFactory } from './use-validate-factory-or-id';

type Id = MotiPressableInteractionIds['id'];
type Deps = unknown[] | null | undefined;

function useMotiPressable(factory: MotiPressableInteractionProp, maybeDeps?: Deps): MotiProps['state'];
function useMotiPressable(id: Id, factory: MotiPressableInteractionProp, maybeDeps?: Deps): MotiProps['state'];
function useMotiPressable(
  factoryOrId: MotiPressableInteractionProp | Id,
  maybeFactoryOrDeps?: MotiPressableInteractionProp | Deps,
  maybeDeps?: Deps,
): MotiProps['state'] {
  const context = useMotiPressableContext();

  const { factory, id } = useFactory<MotiPressableInteractionProp>(
    'useMotiPressable',
    factoryOrId,
    maybeFactoryOrDeps,
    maybeDeps,
  );

  // RNR4: useDerivedValue no longer accepts a dependency array.
  const __state = useDerivedValue(() => {
    const interaction = context.containers[id];
    return interaction && factory(interaction.value);
  });

  return useMemo(() => ({ __state }), [__state]);
}

export { useMotiPressable };
