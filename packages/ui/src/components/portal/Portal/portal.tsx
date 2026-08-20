import {
  createContext,
  type Dispatch,
  Fragment,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useReducer,
} from 'react';
import { INITIAL_PORTAL_STATE, type PortalAction, type PortalState, portalReducer } from './portal-store';

/**
 * `Portal` — teleport a subtree into a named host rendered elsewhere in the
 * tree, so it can paint above overlays without being nested inside them.
 *
 * A faithful, dependency-free reimplementation of
 * [@gorhom/portal](https://github.com/gorhom/react-native-portal): the same
 * provider/context/reducer around named host slots, minus the escape hatches
 * (`handleOnMount`/`handleOnUnmount`/`handleOnUpdate` override callbacks and the
 * public `usePortal`) nothing here uses.
 *
 * The three pieces compose:
 *
 * - `PortalProvider` holds the host state and, by default, renders a root
 *   `<PortalHost>` **after** its children — so content a `Portal` teleports
 *   paints on top of whatever the provider wraps, which is how `HoldMenu` lifts
 *   its twin above the page.
 * - `PortalHost` renders everything registered under its `name`.
 * - `Portal` renders `null` in place and teleports `children` into a host. A
 *   stable `name` keeps the slot; children updates replace the slot's node
 *   **in place**, so the teleported subtree never remounts (see
 *   {@link portalReducer}).
 *
 * ```tsx
 * <PortalProvider>
 *   <App />
 *   <Portal name="tooltip">
 *     <FloatingTooltip />
 *   </Portal>
 * </PortalProvider>
 * ```
 *
 * Omitting `name` auto-generates a stable id (React `useId`), so a bare
 * `<Portal>` still targets the root host — `name` only matters when you need to
 * reach a specific `<PortalHost>`.
 */

const DEFAULT_HOST_NAME = 'root';

const PortalStateContext = createContext<PortalState | null>(null);
const PortalDispatchContext = createContext<Dispatch<PortalAction> | null>(null);

/** Reads the dispatch and wraps it in per-host `add`/`remove` callbacks. */
function usePortal(hostName: string) {
  const dispatch = useContext(PortalDispatchContext);

  if (dispatch === null) throw new Error('Portal components must be rendered inside a <PortalProvider>.');

  const addUpdatePortal = useCallback(
    (name: string, node: ReactNode) => {
      dispatch({ type: 'add-update-portal', hostName, portalName: name, node });
    },
    [dispatch, hostName],
  );

  const removePortal = useCallback(
    (name: string) => {
      dispatch({ type: 'remove-portal', hostName, portalName: name });
    },
    [dispatch, hostName],
  );

  return { addUpdatePortal, removePortal };
}

function PortalComponent({ name, hostName = DEFAULT_HOST_NAME, children }: PortalProps) {
  // `useId` runs unconditionally; the provided `name` simply wins when present.
  const generatedId = useId();
  const resolvedName = name ?? generatedId;
  const { addUpdatePortal, removePortal } = usePortal(hostName);

  // Register the slot on mount and deregister on unmount. The slot outlives
  // children changes (add-update upserts), so this effect is mount-scoped; the
  // effect below keeps the node in sync.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the slot registers with the children present at mount — later changes are synced by the effect below
  // biome-ignore lint/plugin: register/deregister is mount-scoped — children sync happens in the effect below
  useEffect(() => {
    addUpdatePortal(resolvedName, children);
    return () => removePortal(resolvedName);
  }, [addUpdatePortal, removePortal, resolvedName]);

  // Sync children into the slot whenever they change (and on mount).
  // biome-ignore lint/plugin: syncing ReactNode children into the portal host is an intentional imperative side-effect — no derived-state or event-handler form exists
  useEffect(() => {
    addUpdatePortal(resolvedName, children);
  }, [addUpdatePortal, resolvedName, children]);

  return null;
}

function PortalHostComponent({ name = DEFAULT_HOST_NAME }: PortalHostProps) {
  const state = useContext(PortalStateContext);

  if (state === null) throw new Error('PortalHost must be rendered inside a <PortalProvider>.');

  const portals = state[name] ?? [];
  return (
    <>
      {portals.map((entry) => (
        <Fragment key={entry.name}>{entry.node}</Fragment>
      ))}
    </>
  );
}

function PortalProviderComponent({ rootHostName = DEFAULT_HOST_NAME, shouldAddRootHost = true, children }: PortalProviderProps) {
  const [state, dispatch] = useReducer(portalReducer, INITIAL_PORTAL_STATE);

  return (
    <PortalDispatchContext.Provider value={dispatch}>
      <PortalStateContext.Provider value={state}>
        {children}
        {shouldAddRootHost ? <PortalHost name={rootHostName} /> : null}
      </PortalStateContext.Provider>
    </PortalDispatchContext.Provider>
  );
}

export type PortalProps = {
  /** Stable identifier for the slot. Omit to auto-generate one (`useId`). */
  name?: string;
  /** Host to teleport into. @default 'root' */
  hostName?: string;
  /** The subtree to teleport. */
  children?: ReactNode;
};

export type PortalHostProps = {
  /** Host identifier. @default 'root' */
  name?: string;
};

export type PortalProviderProps = {
  /** Name of the root host the provider renders after its children. @default 'root' */
  rootHostName?: string;
  /** Whether to render the root host at all. @default true */
  shouldAddRootHost?: boolean;
  children: ReactNode;
};

export const Portal = memo(PortalComponent);
export const PortalHost = memo(PortalHostComponent);
export const PortalProvider = memo(PortalProviderComponent);
