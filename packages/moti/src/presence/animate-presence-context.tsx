import { createContext, useContext, useEffect, useId, useMemo } from 'react';

export type PresenceContextValue = {
  isPresent: boolean;
  /**
   * Registers a Moti component under the nearest presence key. Returns the
   * deregister function (called on unmount). The key is only unmounted once
   * every registered component has reported completion via `safeToUnmount`.
   */
  register: (childId: string) => () => void;
  /** Marks the given component's exit as complete. `null` while the key is present. */
  safeToUnmount: ((childId: string) => void) | null;
  /** Arbitrary user data forwarded to exit variant functions. */
  custom?: unknown;
  initial?: boolean;
};

export const PresenceContext = createContext<PresenceContextValue | null>(null);

/**
 * Consumed by every Moti component (via motify). Registers the component as a
 * presence child and returns `[isPresent, safeToUnmount]` with `safeToUnmount`
 * pre-bound to this component's id (`null` while present or outside any
 * AnimatePresence) — the same shape use-motify already consumes.
 */
export function usePresenceContext(): [boolean, (() => void) | null] {
  const context = useContext(PresenceContext);
  const childId = useId();

  const register = context?.register;
  // biome-ignore lint/plugin: presence registration is a mount/unmount lifecycle side effect — the deregister cleanup must run on unmount and cannot be expressed as derived state
  useEffect(() => {
    if (!register) return;
    return register(childId);
  }, [register, childId]);

  const safeToUnmount = context?.safeToUnmount ?? null;
  const bound = useMemo(() => (safeToUnmount ? () => safeToUnmount(childId) : null), [safeToUnmount, childId]);

  if (!context) return [true, null];
  return [context.isPresent, bound];
}
