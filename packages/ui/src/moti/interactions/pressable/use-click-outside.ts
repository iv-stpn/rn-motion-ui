import { type RefObject, useEffect } from 'react';

/**
 * Calls `onClickOutside` whenever a `mousedown` lands outside the element
 * referenced by `ref`. Web-only; the listener is a no-op on non-web platforms.
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onClickOutside: () => void): void {
  // biome-ignore lint/plugin: DOM event-listener lifecycle requires useEffect — the listener must be attached and removed as a side effect
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (ref.current && event.target instanceof HTMLElement && !ref.current.contains(event.target)) onClickOutside();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, onClickOutside]);
}
