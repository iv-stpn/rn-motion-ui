// biome-ignore-all lint/style/useExportsLast: shared values and the JS store interleave by intent
import { useSyncExternalStore } from 'react';
import { makeMutable } from 'react-native-reanimated';

/**
 * The `OverlayHost`'s own window offset, measured once it lays out and
 * re-measured on every layout (rotation, a header appearing above the
 * provider). Written by `overlay-host.tsx`, read by the teleported HoldMenu
 * menu and twins.
 *
 * The teleported pieces compute their `top`/`left` in the provider root's
 * coordinate space (item page coords minus the root's page offset). Their
 * containing block is the `OverlayHost` — a sibling of the `BlurTarget`, whose
 * origin is the `BlurProvider`'s parent rather than the window whenever that
 * parent is inset (storybook's chrome, a nested screen). Converting root space
 * back into host space is therefore `rootPageY - overlayHostPageY`, not
 * `rootPageY` alone: adding the root's window offset lands the pieces `hostPageY`
 * too low. Module-level so the overlay content — rendered outside the provider's
 * React tree — can reach it without a context.
 */
export const overlayHostPageX = makeMutable(0);
export const overlayHostPageY = makeMutable(0);

/**
 * A plain-JS mirror of the host's window offset for overlay content that
 * positions itself from React state instead of a UI-thread worklet (the
 * MorphingFAB/Switcher teleport). The shared values above are read inside
 * reanimated worklets and offer no JS-side subscription, so this store carries
 * the same measurement into the React render tree via `useSyncExternalStore`.
 */
type WindowPosition = { x: number; y: number };

let windowPosition: WindowPosition = { x: 0, y: 0 };
const positionListeners = new Set<() => void>();

function getOverlayHostWindowPosition(): WindowPosition {
  return windowPosition;
}

function subscribeOverlayHostWindowPosition(listener: () => void): () => void {
  positionListeners.add(listener);
  return () => {
    positionListeners.delete(listener);
  };
}

/** Writes the JS-side host offset (called from `OverlayHost`'s `onLayout`). */
export function setOverlayHostWindowPosition(next: WindowPosition): void {
  if (next.x === windowPosition.x && next.y === windowPosition.y) return;
  windowPosition = next;
  for (const listener of positionListeners) listener();
}

/**
 * The `OverlayHost`'s window offset as a React value, re-rendering the caller
 * when the host re-measures (rotation, chrome changes). Internal to the package.
 */
export function useOverlayHostWindowPosition(): WindowPosition {
  return useSyncExternalStore(subscribeOverlayHostWindowPosition, getOverlayHostWindowPosition);
}
