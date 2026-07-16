import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import type { MotiPressableContext } from './context';
import { useMotiPressableContext } from './context';
import type { MotiPressableInteractionProp } from './types';

type Factory = (containers: MotiPressableContext['containers']) => ReturnType<MotiPressableInteractionProp>;

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
