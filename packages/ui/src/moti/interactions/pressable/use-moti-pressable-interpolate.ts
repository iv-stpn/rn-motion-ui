import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import { type MotiPressableInteractionIds, useMotiPressableContext } from './context';
import type { MotiPressableInteractionState } from './types';
import { useFactory } from './use-validate-factory-or-id';

type Factory<Props> = (interaction: MotiPressableInteractionState) => Props;
type Deps = unknown[] | null | undefined;

/**
 * Returns a Reanimated `SharedValue<Props>` that — unlike
 * `useMotiPressable`/`useMotiPressables` — holds the factory's **raw**
 * output rather than wrapping it as Moti `state`.
 *
 * Use this when you need a `SharedValue` that reacts to a
 * `<MotiPressable>`'s interaction state for custom worklet logic, rather
 * than driving a Moti component's `state` prop directly.
 *
 * @param id - Optional pressable `id` to target a specific ancestor.
 * @param factory - Called with `{ hovered, pressed }`; must return the
 *   derived value.
 * @param deps - Optional dependency array.
 * @returns A readonly `SharedValue<Props>` that updates with the interaction.
 */
export function useInterpolateMotiPressable<Props>(
  id: MotiPressableInteractionIds['id'],
  factory: Factory<Props>,
  deps?: Deps,
): Readonly<SharedValue<Props>>;
export function useInterpolateMotiPressable<Props>(factory: Factory<Props>, deps?: Deps): Readonly<SharedValue<Props>>;
export function useInterpolateMotiPressable<Props>(
  factoryOrId: Factory<Props> | MotiPressableInteractionIds['id'],
  maybeFactoryOrDeps?: Factory<Props> | Deps,
  maybeDeps?: Deps,
): Readonly<SharedValue<Props>> {
  const context = useMotiPressableContext();

  const { factory, id } = useFactory<Factory<Props>>('useMotiPressableAnimatedProps', factoryOrId, maybeFactoryOrDeps, maybeDeps);

  // RNR4: useDerivedValue no longer accepts a dependency array.
  return useDerivedValue<Props>(() => context && factory(context.containers[id]?.value ?? { hovered: false, pressed: false }));
}
