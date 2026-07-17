import { hasKey } from '@rn-motion-ui/utils/typeguards';
import type { MotiTransition } from '../types';

type ResolveTransitionParams<Animate> = {
  transitionProp: unknown;
  variantTransition: MotiTransition<Animate> | undefined;
  exitTransitionProp: unknown;
  isExiting: boolean;
  custom: () => unknown;
};

/**
 * Resolves the final animation transition by merging, in order:
 * 1. the base transition prop (plain or DerivedValue-wrapped)
 * 2. any variant-level transition from `state`
 * 3. the exit transition (plain, DerivedValue, or factory) when the component is exiting
 */

export function resolveTransition<Animate>({
  transitionProp,
  variantTransition,
  exitTransitionProp,
  isExiting,
  custom,
}: ResolveTransitionParams<Animate>): MotiTransition<Animate> | undefined {
  'worklet';

  let transition: MotiTransition<Animate> | undefined = hasKey('value', transitionProp)
    ? // biome-ignore lint/plugin: DerivedValue-wrapper detection — shared-value shape isn't in the static type
      (transitionProp as { value?: MotiTransition<Animate> }).value
    : // biome-ignore lint/plugin: DerivedValue-wrapper detection — shared-value shape isn't in the static type
      (transitionProp as MotiTransition<Animate> | undefined);

  if (variantTransition) transition = { ...transition, ...variantTransition };

  if (isExiting && exitTransitionProp) {
    let exitTransition: MotiTransition<Animate> | undefined;

    if (hasKey('value', exitTransitionProp))
      // biome-ignore lint/plugin: DerivedValue-wrapper detection on the exit-transition union
      exitTransition = (exitTransitionProp as { value?: MotiTransition<Animate> }).value;
    else if (typeof exitTransitionProp === 'function')
      // biome-ignore lint/plugin: exit-transition factory branch — the callable member of the union isn't narrowable without an assertion
      exitTransition = (exitTransitionProp as (c?: unknown) => MotiTransition<Animate>)(custom());
    // biome-ignore lint/plugin: plain-object branch of the exit-transition union isn't assignable to MotiTransition without an assertion
    else exitTransition = exitTransitionProp as MotiTransition<Animate>;

    transition = { ...transition, ...exitTransition };
  }

  return transition;
}
