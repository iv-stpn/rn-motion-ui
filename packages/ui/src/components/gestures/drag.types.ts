// Public contract for the drag system: <Draggable>, <Dragzone>, <DragManager>.
//
// Kept in its own module so a drop target can import the payload and event
// shapes without pulling in the components — and with them
// react-native-gesture-handler — and so the pure logic beside it
// (`drag-transfer.ts`, `drag-hit-test.ts`) stays unit-testable, which anything
// that imports react-native is not.

import type { ReactNode } from 'react';
import type { StyleProp, View, ViewStyle } from 'react-native';

/** What a drop may do with the payload — the DOM `dropEffect` values. */
export type DragDropEffect = 'copy' | 'link' | 'move' | 'none';

/** Which of those the source permits — the DOM `effectAllowed` values. */
export type DragEffectAllowed = DragDropEffect | 'all' | 'copyLink' | 'copyMove' | 'linkMove' | 'uninitialized';

/**
 * The payload a drag carries: MIME-keyed strings, identical on both platforms.
 *
 * This is deliberately the subset of the DOM `DataTransfer` that can be honoured
 * off the web, which buys one thing: a browser's own `DataTransfer` *is* a
 * `DragTransfer`, so a web drag hands the real object straight through. A
 * consumer's `getData(mime)` reads the same on both platforms, and an existing
 * HTML5 drop zone — `<FileSystem onExternalDrop>` — needs no adapter to receive
 * one of these drags. Native drags get the stand-in from `createDragTransfer`.
 *
 * Not included: `files`, `items`, `setDragImage`. Those have no native
 * counterpart, and promising them here would be promising something only half
 * the platforms could keep. Files arriving *from* the OS reach a `<Dragzone>`
 * through {@link DragzoneDropEvent.files} instead, which is web-only and says so.
 */
export type DragTransfer = {
  dropEffect: DragDropEffect;
  effectAllowed: DragEffectAllowed;
  /** Every format `setData` has written, in insertion order. */
  readonly types: readonly string[];
  /** The string written for `format`, or `''` when there is none. */
  getData: (format: string) => string;
  setData: (format: string, data: string) => void;
};

/**
 * Axis along which dragging is constrained.
 *
 * - `'x'`: horizontal movement only
 * - `'y'`: vertical movement only
 * - `'both'`: unconstrained (default)
 */
export type DragAxis = 'x' | 'y' | 'both';

/**
 * Algorithm used to decide whether a draggable is over a drop zone.
 *
 * - `'intersect'`: any overlap between the draggable rect and the zone rect (default
 *    when a collision algorithm is set; otherwise point-based hit testing applies)
 * - `'contain'`: the entire draggable rect must be inside the zone rect
 * - `'center'`: the draggable's center point must be inside the zone rect
 */
export type CollisionAlgorithm = 'intersect' | 'contain' | 'center';

/** A point in window coordinates — `clientX/Y` on web, `absoluteX/Y` on native. */
export type DragPoint = { x: number; y: number };

/** Window-relative box, as `measureInWindow` reports it. */
export type DragRect = { height: number; width: number; x: number; y: number };

/**
 * Which transport is carrying the drag.
 *
 * `'html5'` is the browser's own drag session — a real `DataTransfer`, so the
 * payload crosses to code that has never heard of this library. `'pan'` is a
 * gesture-driven drag: always the case on native, and the case on web for touch,
 * where there is no HTML5 drag to ride.
 */
export type DragTransport = 'html5' | 'pan';

/**
 * Group labels, matched between a source and a zone to decide whether the two
 * may interact. An empty (or omitted) list is a wildcard: it matches everything,
 * so a system with no groups at all needs no configuration to work.
 */
export type DragGroups = readonly string[];

/** Who lifted the drag, for a zone deciding whether it wants it. */
export type DragSource = {
  /** The `<Draggable>`'s id — stable for its lifetime. */
  id: string;
  /** The `<DragManager>` it sits under, or `null` when it is outside every manager. */
  managerId: string | null;
  /** Manager ids from the root down to {@link managerId} — how isolation is decided. */
  managerPath: readonly string[];
  /** Its `testID`, when it has one. Handy in an `accepts` predicate. */
  testID?: string;
};

/**
 * The drag in flight, tree-wide.
 *
 * Native has no OS drag session to ask, so anything that wants to know what is
 * coming reads this — see `getActiveDrag`. The pointer position is deliberately
 * absent: it changes every frame, and a snapshot that changed with it would
 * re-render every subscriber at 60fps. Read it with `getDragPoint()`, or take it
 * from the event a callback is handed.
 */
export type ActiveDrag = {
  id: string;
  transfer: DragTransfer;
  /** The source's groups; `[]` means it matches every zone. */
  groups: DragGroups;
  source: DragSource;
  transport: DragTransport;
  /** The source's window rect at lift time, and where in it the grab landed. */
  origin: { grab: DragPoint; rect: DragRect | null };
  /**
   * Collision detection algorithm for zone hit testing. When set, the spatial test
   * uses a rect-vs-rect comparison instead of the default point-in-rect. Unset means
   * the existing point-based behavior.
   */
  collisionAlgorithm?: CollisionAlgorithm;
};

/** The lift. Write into `transfer` here to change what the drag carries. */
export type DragStartEvent = { point: DragPoint; transfer: DragTransfer };

export type DragMoveEvent = {
  point: DragPoint;
  /** Offset from the lift point, so a consumer needn't remember where it began. */
  translation: DragPoint;
  transfer: DragTransfer;
  /** The `<Dragzone>` under the pointer that would take this drag, or `null`. */
  overZoneId: string | null;
};

export type DragEndEvent = {
  /**
   * Whether the drag ended without a drop. True when no zone claimed it — no
   * target, the user pressed Escape, or `cancel()` was called.
   */
  canceled: boolean;
  /** What the drop did with the payload; `'none'` whenever `canceled`. */
  dropEffect: DragDropEffect;
  point: DragPoint;
  transfer: DragTransfer;
  /** The `<Dragzone>` that took it, or `null` when nothing did. */
  zoneId: string | null;
};

/**
 * The imperative surface of a `<Draggable>`. Every member behaves the same on
 * both platforms except `cancel`, which cannot: see its note.
 */
export type DraggableHandle = {
  /**
   * Abandon the drag in flight; no-op when there is none. `onDragEnd` fires with
   * `canceled: true`.
   *
   * **Partial under the HTML5 transport.** Once the browser owns a drag, nothing
   * but the user's Escape key ends it, so this clears the library's own state
   * while the browser's drag image keeps following the cursor until release. A
   * pan-transport drag — every native drag, and touch on web — aborts outright.
   * Reach for it where the app decides a drag is void (the source was deleted, a
   * route changed) rather than as a general-purpose "stop dragging".
   */
  cancel: () => void;
  /** The live payload while dragging, else `null`. */
  getTransfer: () => DragTransfer | null;
  /**
   * The host view. On web react-native-web resolves this to the backing
   * `HTMLElement`, so DOM work is a `Platform.OS` guard and a cast away.
   */
  getNode: () => View | null;
  isDragging: () => boolean;
  /**
   * The host's window-relative box. Async on both platforms because native's
   * `measureInWindow` is callback-based; resolves `null` when unmounted.
   */
  measure: () => Promise<DragRect | null>;
};

/**
 * What a zone is asked before it takes a drag, once groups have already matched.
 *
 * `drag` is `null` for an external payload, where there is no in-library source to
 * describe — decide on those from `transfer.types`.
 */
export type DragzoneAcceptEvent = {
  drag: ActiveDrag | null;
  external: boolean;
  point: DragPoint;
  transfer: DragTransfer;
  zoneId: string;
};

/** The pointer crossing a zone's edge, and every move while inside it. */
export type DragzoneDragEvent = { drag: ActiveDrag; point: DragPoint; transfer: DragTransfer; zoneId: string };

/**
 * A drop landing on a zone.
 *
 * `drag` is `null` exactly when the payload came from outside the library — an OS
 * file drag, another tab, another application. That case is web-only: there is no
 * such thing off the browser, so `external` is always `false` on native.
 */
export type DragzoneDropEvent = {
  drag: ActiveDrag | null;
  external: boolean;
  /** Files the OS handed over. Empty for an in-library drag, and always off the web. */
  files: readonly File[];
  point: DragPoint;
  transfer: DragTransfer;
  zoneId: string;
};

/** What the store keeps for a registered `<Dragzone>`, read fresh on every hit test. */
export type DragzoneConfig = {
  /** Which sources it will take; `[]` matches every one. */
  groups: DragGroups;
  disabled: boolean;
  /** What it claims a drop does with the payload. @default 'copy' */
  dropEffect: DragDropEffect;
  /** The last word on whether this zone wants a drag, after groups have matched. */
  accepts?: (event: DragzoneAcceptEvent) => boolean;
  /** Whether an OS/foreign payload may land here. Web only. */
  acceptsExternal: boolean;
  /** Breaks a tie between overlapping zones; higher wins. @default 0 */
  priority: number;
  /**
   * When true, this zone is never measured and always passes the spatial hit test.
   * Set on zones whose consumer handles hit testing through another mechanism
   * (e.g. arithmetic position calculation in SortableList). @default false
   */
  skipRectMeasure?: boolean;
  testID?: string;
  onDragEnter?: (event: DragzoneDragEvent) => void;
  onDragOver?: (event: DragzoneDragEvent) => void;
  onDragLeave?: (event: DragzoneDragEvent) => void;
  onDrop?: (event: DragzoneDropEvent) => void;
};

/** How a zone stands with respect to the drag in flight. */
export type DragzoneState = {
  /** A drag is in flight and this zone would take it. */
  isEligible: boolean;
  /** …and the pointer is inside it, so a release now lands here. */
  isOver: boolean;
};

/**
 * How one zone stands with respect to the drag in flight, cached on its entry.
 *
 * The object a `<Dragzone>` subscribes to, one per zone instead of one snapshot
 * per drag. Identity is stable across publishes that leave this zone's own
 * standing unchanged — the contract `useSyncExternalStore` needs to bail out of
 * re-rendering every zone when the pointer crosses a *different* zone's edge.
 * The `drag` reference is stable for the whole drag, so a zone re-renders once
 * at lift, once at release, and only on crossings it is a party to.
 */
export type DragzoneStanding = {
  /** The drag in flight, or `null`. Identity stable for the whole drag. */
  drag: ActiveDrag | null;
  /** A drag is in flight and this zone would take it. */
  isEligible: boolean;
  /** …and the pointer is inside it, so a release now lands here. */
  isOver: boolean;
};

/**
 * What a zone hands its render-prop children, and paints its own affordance from.
 *
 * `isEligible`/`isOver` mean the same for a foreign payload as for one of ours, so
 * the common case — highlight while a drop is possible — needs no branch. `external`
 * is there for the cases that do differ: an OS file drag has no source to name and
 * nothing readable until it drops.
 */
export type DragzoneRenderState = DragzoneState & {
  /** The drag in flight, or `null` — including whenever `external` is true. */
  drag: ActiveDrag | null;
  /** The payload comes from outside the library. Web only. */
  external: boolean;
};

/** The imperative surface of a `<Dragzone>`. */
export type DragzoneHandle = {
  /** The zone's store id — what {@link DragSnapshot.overZoneId} is compared against. */
  getId: () => string;
  /** The underlying view. `HTMLElement` on web, where react-native-web renders a div. */
  getNode: () => View | null;
  /** This zone's window rect, measured now. */
  measure: () => Promise<DragRect | null>;
  /**
   * Re-measure into the store. Already done on the zone's own layout and at lift
   * time; call it when the box moves with no layout pass of its own.
   */
  remeasure: () => Promise<void>;
};

/** What a manager is told about a drag happening anywhere under it. */
export type DragManagerEvent = { drag: ActiveDrag; point: DragPoint; zoneId: string | null };

/** What the store keeps for a registered `<DragManager>`. */
export type DragManagerConfig = {
  /**
   * Groups every source and zone under this manager inherits when it declares
   * none of its own — the one-line way to keep two boards from mixing.
   */
  groups: DragGroups;
  /**
   * Confine drags to this subtree: a source under an isolating manager can only
   * reach zones under it, and a zone under one can only be reached from inside.
   * @default false
   */
  isolate: boolean;
  /** Whether this manager draws the ghost for drags lifted beneath it. */
  hostsOverlay: boolean;
  onDragStart?: (event: DragManagerEvent) => void;
  onDragMove?: (event: DragManagerEvent) => void;
  onDragEnd?: (event: DragManagerEvent & { canceled: boolean; dropEffect: DragDropEffect }) => void;
  onDrop?: (event: DragzoneDropEvent) => void;
};

/** The imperative surface of a `<DragManager>`. */
export type DragManagerHandle = {
  /** The drag in flight anywhere in the tree, or `null`. */
  getActiveDrag: () => ActiveDrag | null;
  /** Abandon the drag in flight, wherever it was lifted. Same caveat as {@link DraggableHandle.cancel}. */
  cancelDrag: () => void;
  /**
   * Re-measure every registered zone. The manager already does this at lift time
   * and on its own layout; call it after moving zones without a layout pass —
   * a virtualised list recycling rows, say.
   */
  refreshZones: () => Promise<void>;
};

/** What `endDrag` resolved to, for the transport to report back to its consumer. */
export type DragEndOutcome = { canceled: boolean; dropEffect: DragDropEffect; point: DragPoint; zoneId: string | null };

/**
 * The store's render-visible state, as `useSyncExternalStore` sees it.
 *
 * Identity is stable while nothing render-visible changes, which is the whole
 * design: pointer movement inside one zone does not produce a new snapshot, so a
 * zone re-renders when the drag starts, when the pointer crosses its edge, and
 * when the drag ends — not once a frame.
 */
export type DragSnapshot = {
  drag: ActiveDrag | null;
  /** The zone a release would land on, or `null`. */
  overZoneId: string | null;
  /** Every zone that would take this drag — what paints the "you can drop here" state. */
  eligibleZoneIds: readonly string[];
  /** The ghost to draw, and which manager should draw it. */
  preview: { hostId: string | null; node: ReactNode } | null;
};

/** A registered zone, as the store holds it. */
export type DragzoneEntry = {
  id: string;
  /** Manager ids from the root down to this zone's own — how isolation is decided. */
  managerPath: readonly string[];
  /** Last measured window rect; `null` until the first measure resolves. */
  rect: DragRect | null;
  /**
   * The zone's cached standing in the drag in flight. Replaced in `publish()`
   * only when one of its fields changed; read by the zone through
   * `getZoneStanding` so a crossing elsewhere in the tree re-renders nothing.
   */
  standing: DragzoneStanding;
  /** Read fresh per hit test, so a config change needs no re-registration. */
  getConfig: () => DragzoneConfig;
  measure: () => Promise<DragRect | null>;
};

/** A registered manager, as the store holds it. */
export type DragManagerEntry = {
  id: string;
  parentId: string | null;
  /** Manager ids from the root down to and including this one. */
  path: readonly string[];
  getConfig: () => DragManagerConfig;
};

/**
 * Props for the `<Draggable.Handle>` sub-component.
 *
 * When a `<Draggable>` contains at least one `<Draggable.Handle>`, only the handle
 * area can initiate a drag — the rest of the component is inert to drag gestures.
 */
export type DraggableHandleProps = {
  /** The content rendered inside the handle area. */
  children: ReactNode;
  /** Optional style applied to the handle wrapper. */
  style?: StyleProp<ViewStyle>;
};
