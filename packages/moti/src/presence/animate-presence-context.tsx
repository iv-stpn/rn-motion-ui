import { createContext, useContext } from 'react';

export type PresenceContextValue = {
  isPresent: boolean;
  safeToUnmount: (() => void) | null;
  /** Arbitrary user data forwarded to exit variant functions. */
  custom?: unknown;
  initial?: boolean;
};

export const PresenceContext = createContext<PresenceContextValue | null>(null);

export function usePresenceContext(): [boolean, (() => void) | null] {
  const context = useContext(PresenceContext);
  if (!context) return [true, null];
  return [context.isPresent, context.safeToUnmount];
}
