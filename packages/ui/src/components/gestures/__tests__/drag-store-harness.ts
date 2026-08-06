// The store half of the fixtures: the same four steps every store test starts
// with, which are only interesting once.
//
// Split from `drag-harness.ts` because these touch the store and those do not —
// the hit-test tests want the shapes without the module state.

import { vi } from 'vitest';
import type { DragzoneConfig } from '../drag.types';
import { beginDrag, endDrag, refreshDragzones, registerDragManager, registerDragzone } from '../drag-store';
import { drag, manager, zone } from './drag-harness';

type ZoneArgs = Parameters<typeof zone>[0];
type ManagerConfig = Parameters<typeof manager>[0];
type DragArgs = Parameters<typeof drag>[0];

/**
 * Register a zone and measure it in — the state a zone is in by the time a pointer
 * can reach it.
 *
 * `registerDragzone` starts every entry at `rect: null` on purpose, since the box
 * arrives from an async measure. A test that skipped the refresh would be asserting
 * against zones that can never be hit.
 */
export async function addZone(args: ZoneArgs) {
  const registration = registerDragzone(zone(args));
  await refreshDragzones();
  return registration;
}

/** Register a manager, with `parentId` also standing in for its path. */
export function addManager(id: string, config: Partial<ManagerConfig> = {}, parentId: string | null = null) {
  const path = parentId === null ? [id] : [parentId, id];
  return registerDragManager({ getConfig: () => manager(config), id, parentId, path });
}

/** Every zone callback as a spy, to spread into a zone's config. */
export function zoneSpies() {
  return {
    onDragEnter: vi.fn(),
    onDragLeave: vi.fn(),
    onDragOver: vi.fn(),
    onDrop: vi.fn(),
  } satisfies Partial<DragzoneConfig>;
}

/**
 * Begin a drag with the `sourceCancel` a real `<Draggable>` passes — ending itself
 * on `endDrag`, which is what makes `cancelActiveDrag()` from a manager reach the
 * source's own teardown rather than quietly clearing the session.
 */
export function lift(options: DragArgs = {}) {
  const active = drag(options);
  beginDrag({ drag: active, sourceCancel: () => endDrag({ commit: false, point: active.origin.grab, sourceId: active.id }) });
  return active;
}
