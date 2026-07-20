import { useEffect } from 'react';

/**
 * Fires the effect exactly once after the component mounts.
 * The effect may return an optional cleanup that runs on unmount.
 */

// biome-ignore lint/suspicious/noConfusingVoidType: follows useEffect's typing
export function useMountEffect(effect: () => void | (() => void)): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design
  // biome-ignore lint/plugin: mount-only by design
  useEffect(effect, []);
}
