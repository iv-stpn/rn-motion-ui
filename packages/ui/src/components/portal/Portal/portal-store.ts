import type { ReactNode } from 'react';

/**
 * Pure state for the `Portal` primitive — the reducer and its types, kept out of
 * the `.tsx` views so the portal's registration logic is unit-testable without
 * loading react-native (see [[vitest-cannot-import-tsx]]).
 */

/** One registered portal — a stable `name` keyed to the node it teleports. */
export type PortalEntry = { name: string; node: ReactNode };

/** Portal state: host name → the ordered list of portals that host renders. */
export type PortalState = Record<string, PortalEntry[]>;

export type PortalAction =
  | { type: 'register-host'; hostName: string }
  | { type: 'deregister-host'; hostName: string }
  | { type: 'add-update-portal'; hostName: string; portalName: string; node: ReactNode }
  | { type: 'remove-portal'; hostName: string; portalName: string };

export const INITIAL_PORTAL_STATE: PortalState = {};

/**
 * Folds a {@link PortalAction} into the portal state, immutably.
 *
 * `add-update-portal` is an *upsert*: a second dispatch for an existing name
 * replaces that slot's node in place rather than removing and re-adding it, so
 * the host keeps the same element identity across children updates — the
 * structural reason a `Portal` with a stable `name` never remounts its content.
 */
export function portalReducer(state: PortalState, action: PortalAction): PortalState {
  switch (action.type) {
    case 'register-host': {
      if (Object.hasOwn(state, action.hostName)) return state;
      return { ...state, [action.hostName]: [] };
    }
    case 'deregister-host': {
      if (!Object.hasOwn(state, action.hostName)) return state;
      return Object.fromEntries(Object.entries(state).filter(([hostName]) => hostName !== action.hostName));
    }
    case 'add-update-portal': {
      const portals = state[action.hostName] ?? [];
      const index = portals.findIndex((item) => item.name === action.portalName);
      const entry = { name: action.portalName, node: action.node };

      if (index === -1) return { ...state, [action.hostName]: [...portals, entry] };

      const next = portals.slice();
      next[index] = entry;
      return { ...state, [action.hostName]: next };
    }
    case 'remove-portal': {
      const portals = state[action.hostName];
      if (!portals) return state;
      const index = portals.findIndex((entry) => entry.name === action.portalName);
      if (index === -1) return state;
      const next = portals.slice();
      next.splice(index, 1);
      return { ...state, [action.hostName]: next };
    }
    default:
      return state;
  }
}
