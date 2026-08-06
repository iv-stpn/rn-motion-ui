// Fixtures for the drag tests.
//
// Every helper here builds one of the shapes the store and the hit test consume,
// with defaults that mean "no opinion" — no groups, not disabled, no `accepts`.
// A test then names only the field it is about, which is what keeps the assertion
// legible: a test titled "refuses a group it does not share" should mention groups
// and nothing else.
//
// No react-native anywhere in this graph, for the reason given in `drag.types.ts`.

import type {
  ActiveDrag,
  DragGroups,
  DragManagerConfig,
  DragPoint,
  DragRect,
  DragzoneConfig,
  DragzoneEntry,
} from '../drag.types';
import { createDragTransfer } from '../drag-transfer';

const NO_GROUPS: DragGroups = [];

type ZoneOptions = Partial<DragzoneConfig> & {
  id: string;
  managerPath?: readonly string[];
  /** The measured box. `null` models a zone that has not laid out yet. */
  rect?: DragRect | null;
};

type DragOptions = {
  groups?: DragGroups;
  id?: string;
  managerPath?: readonly string[];
  origin?: { grab: DragPoint; rect: DragRect | null };
};

/** A box, from the corner and the size — shorter than four named fields per zone. */
export function rect(x: number, y: number, width: number, height: number): DragRect {
  return { height, width, x, y };
}

/**
 * A registered zone.
 *
 * `getConfig` closes over the options rather than copying them, matching the real
 * component: config is read fresh on every hit test, so a test can mutate what it
 * returns mid-drag exactly as a re-rendering component would.
 */
export function zone({ id, managerPath = [], rect: box = null, ...config }: ZoneOptions): DragzoneEntry {
  const entry: DragzoneEntry = {
    getConfig: () => ({
      acceptsExternal: false,
      disabled: false,
      dropEffect: 'copy',
      groups: NO_GROUPS,
      priority: 0,
      ...config,
    }),
    id,
    managerPath,
    measure: () => Promise.resolve(box),
    rect: box,
  };
  return entry;
}

/** A drag in flight, with a real transfer so `getData` round-trips in a test. */
export function drag({ groups = NO_GROUPS, id = 'source', managerPath = [], origin }: DragOptions = {}): ActiveDrag {
  const grab = origin?.grab ?? { x: 0, y: 0 };
  return {
    groups,
    id,
    origin: { grab, rect: origin?.rect ?? null },
    source: { id, managerId: managerPath.at(-1) ?? null, managerPath },
    transfer: createDragTransfer(),
    transport: 'pan',
  };
}

/** A manager config, defaulting to the one that changes nothing about a drag. */
export function manager(config: Partial<DragManagerConfig> = {}): DragManagerConfig {
  return { groups: NO_GROUPS, hostsOverlay: false, isolate: false, ...config };
}

/** `isIsolating` over a set of ids — the only thing the hit test asks about managers. */
export function isolators(...ids: string[]): (managerId: string) => boolean {
  const set = new Set(ids);
  return (managerId) => set.has(managerId);
}
