import type { MotiTransition, TransitionConfig } from '../types';

export function animationDelay<Animate>(key: string, transition: MotiTransition<Animate> | undefined, defaultDelay?: number) {
  'worklet';
  let delayMs: TransitionConfig['delay'] = defaultDelay;
  // biome-ignore lint/plugin: dynamic style-key lookup — MotiTransition<Animate> has no string index signature, so indexing it by a runtime key requires a cast
  const keyTransition = (transition as Record<string, TransitionConfig | undefined> | undefined)?.[key];
  // A delay only wins its level when actually set — an absent (undefined) delay
  // falls through to the level below instead of clobbering it.
  const keyDelay = keyTransition?.delay;
  const rootDelay = transition?.delay;
  if (keyDelay !== null && keyDelay !== undefined) delayMs = keyDelay;
  else if (rootDelay !== null && rootDelay !== undefined) delayMs = rootDelay;
  return { delayMs };
}
