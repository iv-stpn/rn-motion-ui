import type { MotiTransition, TransitionConfig } from '../types';

export function animationDelay<Animate>(key: string, transition: MotiTransition<Animate> | undefined, defaultDelay?: number) {
  'worklet';
  let delayMs: TransitionConfig['delay'] = defaultDelay;
  // biome-ignore lint/plugin: dynamic style-key lookup — MotiTransition<Animate> has no string index signature, so indexing it by a runtime key requires a cast
  const keyTransition = (transition as Record<string, TransitionConfig | undefined> | undefined)?.[key];
  if (keyTransition !== undefined && keyTransition.delay !== null) delayMs = keyTransition.delay;
  else if (transition !== undefined && transition.delay !== null) delayMs = transition.delay;
  return { delayMs };
}
