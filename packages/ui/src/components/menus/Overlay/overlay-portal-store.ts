import type { ReactNode } from 'react';

// ─── Layer stack state ─────────────────────────────────────────────────────────
// One native Modal hosts every open overlay; layers draw bottom → top.

let nextLayerId = 0;
let layers: OverlayLayerState = [];
const layerListeners = new Set<() => void>();

function notifyLayers() {
  for (const cb of layerListeners) cb();
}

// ─── Outlet setter stack state ─────────────────────────────────────────────────
// The toast portal re-targets onto the topmost layer's outlet. Outlets mount in
// layer-render order inside the single Modal, so this stack (kept in mount order)
// is the topmost layer's outlet by construction.

/** One registered outlet — an (id, setter) pair so the stack survives concurrent updates. */
type OutletEntry = { id: number; setter: (node: ReactNode) => void };

let nextOutletId = 0;
const outletStack: OutletEntry[] = [];
const outletListeners = new Set<() => void>();

function notifyOutlets() {
  for (const cb of outletListeners) cb();
}

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * One registered overlay layer — the unit the single root `<Modal>` renders in
 * registration order (bottom → top). When N overlays open at once they collapse
 * into one native `<Modal>` hosting N of these, so a confirm dialog raised from
 * a settings sheet can present on top of it on iOS.
 */
export type OverlayLayer = {
  id: number;
  /** The AnimatePresence-wrapped scrim + panel, plus this layer's outlet. */
  render: () => ReactNode;
  /**
   * Fires once this layer's exit animation finishes. Stored on the layer so the
   * bottom (Modal-owning) layer can reason about a guest's exit state; each
   * `OverlayShell` drives its own deregistration off its `rendered` gate.
   */
  onExitComplete: () => void;
  /** This layer's request-close handler (respects its `dismissable` flag). */
  onRequestClose: () => void;
};

/** Immutable layer stack, in registration order (bottom → top). */
export type OverlayLayerState = OverlayLayer[];

/** Input to {@link upsertOverlayLayer}. */
export type UpsertOverlayLayerInput = {
  id?: number;
  render: () => ReactNode;
  onExitComplete: () => void;
  onRequestClose: () => void;
};

/** Result of {@link upsertOverlayLayer}. */
export type UpsertOverlayLayerResult = { id: number; isBottom: boolean };

// ─── Pure layer-stack transitions (unit-testable without react-native) ────────

/**
 * Upsert a layer in place: append when `id` is new, replace the same slot when
 * it already exists — a layer never moves position just because its render
 * closure changed (the no-remount guarantee).
 */
export function upsertLayer(state: OverlayLayerState, id: number, layer: Omit<OverlayLayer, 'id'>): OverlayLayerState {
  const entry: OverlayLayer = { id, ...layer };
  const index = state.findIndex((item) => item.id === id);
  if (index === -1) return [...state, entry];
  const next = state.slice();
  next[index] = entry;
  return next;
}

/** Remove a layer by id, preserving the relative order of the rest. */
export function removeLayer(state: OverlayLayerState, id: number): OverlayLayerState {
  if (!state.some((item) => item.id === id)) return state;
  return state.filter((item) => item.id !== id);
}

// ─── Layer stack API ───────────────────────────────────────────────────────────

/** Subscribe to layer-stack changes (useSyncExternalStore). Returns an unsubscribe fn. */
export function subscribeOverlayStack(cb: () => void): () => void {
  layerListeners.add(cb);
  return () => {
    layerListeners.delete(cb);
  };
}

/** The current layer stack, in registration order (bottom → top). */
export function getOverlayStack(): OverlayLayerState {
  return layers;
}

/** Number of overlay layers currently registered. */
export function getOverlayDepth(): number {
  return layers.length;
}

/**
 * Register a new layer, or refresh an existing one (matched by `input.id`) in
 * place. Returns the layer id and whether it is the bottom (Modal-owning) layer
 * — `isBottom` is only meaningful on first registration, where it answers "was
 * the stack empty before I joined".
 */
export function upsertOverlayLayer(input: UpsertOverlayLayerInput): UpsertOverlayLayerResult {
  if (input.id === undefined) nextLayerId += 1;
  const id = input.id ?? nextLayerId;
  const index = layers.findIndex((layer) => layer.id === id);
  const isBottom = index === -1 ? layers.length === 0 : layers[0]?.id === id;
  layers = upsertLayer(layers, id, {
    render: input.render,
    onExitComplete: input.onExitComplete,
    onRequestClose: input.onRequestClose,
  });
  notifyLayers();
  return { id, isBottom };
}

/** Remove a layer by id. No-op when it is not present. */
export function removeOverlayLayer(id: number): void {
  const next = removeLayer(layers, id);
  if (next === layers) return;
  layers = next;
  notifyLayers();
}

// ─── Outlet setter stack API (toast portal) ────────────────────────────────────

/**
 * Subscribe to outlet-stack changes (used by useSyncExternalStore).
 * Returns an unsubscribe function.
 */
export function subscribeOutletStack(cb: () => void): () => void {
  outletListeners.add(cb);
  return () => {
    outletListeners.delete(cb);
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
  nextOutletId += 1;
  const id = nextOutletId;
  outletStack.push({ id, setter });
  notifyOutlets();
  return () => {
    const idx = outletStack.findIndex((e) => e.id === id);
    if (idx === -1) {
      notifyOutlets();
      return;
    }
    // Clear the content before removing so the outlet doesn't hold a stale
    // node after it has been handed off to a different target.
    outletStack[idx]?.setter(null);
    outletStack.splice(idx, 1);
    notifyOutlets();
  };
}

/**
 * The setter for the topmost open overlay's outlet, or `null` when no overlay
 * is open. The returned function reference is stable for a given outlet, so
 * `useSyncExternalStore` only triggers a re-render when the stack actually
 * changes.
 */
export function getTopOutletSetter(): ((node: ReactNode) => void) | null {
  return outletStack.at(-1)?.setter ?? null;
}

/** Number of overlays with an outlet currently registered. */
export function getOutletDepth(): number {
  return outletStack.length;
}
