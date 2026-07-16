import { useAnimatedProps } from 'react-native-reanimated';
import { type MotiPressableInteractionIds, useMotiPressableContext } from './context';
import type { MotiPressableInteractionState } from './types';
import { useFactory } from './use-validate-factory-or-id';

type Factory<Props> = (interaction: MotiPressableInteractionState) => Props;
type Deps = unknown[] | null | undefined;

export function useMotiPressableAnimatedProps<Props>(
  id: MotiPressableInteractionIds['id'],
  factory: Factory<Props>,
  deps?: Deps,
): Partial<Props>;
export function useMotiPressableAnimatedProps<Props>(factory: Factory<Props>, deps?: Deps): Partial<Props>;
export function useMotiPressableAnimatedProps<Props extends object>(
  factoryOrId: Factory<Props> | MotiPressableInteractionIds['id'],
  maybeFactoryOrDeps?: Factory<Props> | Deps,
  maybeDeps?: Deps,
) {
  const context = useMotiPressableContext();

  const { factory, id } = useFactory<Factory<Props>>(
    'useMotiPressableAnimatedProps',
    factoryOrId,
    maybeFactoryOrDeps,
    maybeDeps,
  );

  // RNR4: useAnimatedProps no longer accepts a dependency array.
  return useAnimatedProps<Props>(() => {
    return context ? factory(context.containers[id]?.value ?? { hovered: false, pressed: false }) : ({} as Props);
  });
}
