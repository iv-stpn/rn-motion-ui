import { useAnimatedProps } from 'react-native-reanimated';
import { type MotiPressableInteractionIds, useMotiPressableContext } from './context';
import type { MotiPressableInteractionState } from './types';
import { useFactory } from './use-validate-factory-or-id';

type Factory<Props> = (interaction: MotiPressableInteractionState) => Props;
type Deps = unknown[] | null | undefined;

/**
 * Derives arbitrary animated (non-style) props from a `<MotiPressable>` ancestor's
 * interaction state. Wraps Reanimated's `useAnimatedProps`.
 *
 * Unlike `useMotiPressable` (which produces Moti `state` for style animation),
 * this hook is for animating props like `borderWidth`, `src`, or any non-style
 * animated property.
 *
 * @param id - Optional pressable `id` to target a specific ancestor.
 * @param factory - Called with `{ hovered, pressed }`; must return a partial
 *   props object.
 * @param deps - Optional dependency array.
 * @returns A partial props object to spread onto an animated component.
 */
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

  const { factory, id } = useFactory<Factory<Props>>('useMotiPressableAnimatedProps', factoryOrId, maybeFactoryOrDeps, maybeDeps);

  // RNR4: useAnimatedProps no longer accepts a dependency array.
  return useAnimatedProps<Partial<Props>>(() =>
    context ? factory(context.containers[id]?.value ?? { hovered: false, pressed: false }) : {},
  );
}
