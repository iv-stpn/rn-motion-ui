import type { ReactNode } from 'react';

/** One registered outlet — an (id, setter) pair so the stack survives concurrent updates. */
type OutletEntry = { id: number; setter: (node: ReactNode) => void };

let nextId = 0;
const stack: OutletEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const cb of listeners) cb();
}

/**
 * Subscribe to stack changes (used by useSyncExternalStore).
 * Returns an unsubscribe function.
 */
export function subscribeOutletStack(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Register an outlet setter. Returns a cleanup function that unregisters it.
 *
 * Call inside `useMountEffect` so the outlet is registered exactly as long as
 * its View is mounted. The cleanup clears the outlet's content before popping
 * so a handed-off `OverlayPortal` doesn't leave a stale node in the closing
 * window.
 */
export function pushOutlet(setter: (node: ReactNode) => void): () => void {
  nextId += 1;
  const id = nextId;
  stack.push({ id, setter });
  notify();
  return () => {
    const idx = stack.findIndex((e) => e.id === id);
    if (idx === -1) {
      notify();
      return;
    }
    // Clear the content before removing so the outlet doesn't hold a stale
    // node after it has been handed off to a different target.
    stack[idx]?.setter(null);
    stack.splice(idx, 1);
    notify();
  };
}

/**
 * The setter for the topmost open overlay's outlet, or `null` when no overlay
 * is open. The returned function reference is stable for a given outlet, so
 * `useSyncExternalStore` only triggers a re-render when the stack actually
 * changes.
 */
export function getTopOutletSetter(): ((node: ReactNode) => void) | null {
  return stack.at(-1)?.setter ?? null;
}

/** Number of overlays with an outlet currently registered. */
export function getOutletDepth(): number {
  return stack.length;
}
