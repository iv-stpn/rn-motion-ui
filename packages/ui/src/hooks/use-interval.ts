import { useEffect, useRef } from 'react';

/**
 * Runs `callback` on a fixed `delay`-ms interval, cleaning up on unmount or
 * when `delay` changes. Pass `null` to pause without unmounting.
 *
 * The callback ref is always up-to-date — closures inside it see the latest
 * props/state without restarting the interval.
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const saved = useRef(callback);
  saved.current = callback;

  // biome-ignore lint/plugin: setInterval lifecycle cannot be expressed without useEffect — the interval must be set up and torn down as a side effect
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
