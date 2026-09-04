import { useSyncExternalStore } from 'react';

/**
 * Module registry backing the Android modal-menu blur host (`./blur-host`).
 *
 * Two subscriptions, both external-store shaped so components read them with
 * `useSyncExternalStore` and re-render exactly when the value changes:
 *
 * - Host presence: whether an `OverlayBlurHost` is currently mounted in the
 *   app window. Modal-menu scrims read it to decide between a hosted blur and
 *   the plain-dim degrade.
 * - Active panes: the set of open modal menus that requested a blur. The host
 *   renders one blur pane per id. Presence-based (register on mount, unregister
 *   on unmount) because menu scrims only exist while their overlay is open,
 *   exit animation included — so an entry's lifecycle IS the menu's visibility.
 *
 * iOS/web never touch this: their hosts render `null`, their scrims never
 * register (the platform guard in `ModalBlur` returns before registering).
 *
 * Internal to the package — not exported from the package entry.
 */

// ---- Host presence ----------------------------------------------------------

let hostCount = 0;
const hostListeners = new Set<() => void>();

function emitHostPresence() {
  for (const listener of hostListeners) listener();
}

function subscribeHostPresence(listener: () => void): () => void {
  hostListeners.add(listener);
  return () => hostListeners.delete(listener);
}

function getHostPresence(): boolean {
  return hostCount > 0;
}

/** Whether an `OverlayBlurHost` is mounted in the app window. False on iOS/web. */
export function useBlurHostMounted(): boolean {
  return useSyncExternalStore(subscribeHostPresence, getHostPresence, getHostPresence);
}

/** An `OverlayBlurHost` mounted (Android only — callers guard on platform). */
export function registerBlurHost() {
  hostCount += 1;
  emitHostPresence();
}

/** An `OverlayBlurHost` unmounted. */
export function unregisterBlurHost() {
  hostCount -= 1;
  emitHostPresence();
}

// ---- Active pane registry ---------------------------------------------------

const activePaneIds = new Set<string>();
const paneListeners = new Set<() => void>();
let paneSnapshot: readonly string[] = [];

function emitPaneChange() {
  paneSnapshot = [...activePaneIds];
  for (const listener of paneListeners) listener();
}

function subscribePanes(listener: () => void): () => void {
  paneListeners.add(listener);
  return () => paneListeners.delete(listener);
}

function getPaneSnapshot(): readonly string[] {
  return paneSnapshot;
}

export function registerBlurPane(id: string) {
  if (activePaneIds.has(id)) return;
  activePaneIds.add(id);
  emitPaneChange();
}

export function unregisterBlurPane(id: string) {
  if (!activePaneIds.delete(id)) return;
  emitPaneChange();
}

/** The ids of the open modal menus currently requesting a hosted blur. */
export function useActiveBlurPanes(): readonly string[] {
  return useSyncExternalStore(subscribePanes, getPaneSnapshot, getPaneSnapshot);
}
