import { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import type { MotiProps } from '../../core/types';
import { type MotiPressableInteractionIds, useMotiPressableContext } from './context';
import type { MotiPressableInteractionProp } from './types';
import { useFactory } from './use-validate-factory-or-id';

type Id = MotiPressableInteractionIds['id'];
type Deps = unknown[] | null | undefined;

/**
 * Derives a Moti `state` value from the nearest `<MotiPressable>` ancestor's
 * interaction shared value.
 *
 * The factory receives `{ hovered, pressed }` and must return an `animate`
 * style object. Pass the returned `{ __state }` to a descendant Moti
 * component's `state` prop — it will animate whenever the interaction changes.
 *
 * ```tsx
 * const state = useMotiPressable(({ pressed }) => ({
 *   scale: pressed ? 0.95 : 1,
 * }))
 * return <MotiView state={state} />
 * ```
 *
 * @param id - Optional pressable `id` to target a specific ancestor. Omit to
 *   use the nearest `<MotiPressable>`.
 * @param factory - Called with `{ hovered, pressed }`; must return an animate
 *   style object.
 * @param maybeDeps - Optional dependency array for the factory (passed through
 *   to `useDerivedValue`).
 * @returns A `{ __state }` object to pass to a Moti component's `state` prop.
 */
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
