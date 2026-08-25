/** biome-ignore-all lint/style/useExportsLast: props types sit with their components */
/** biome-ignore-all lint/style/useComponentExportOnlyModules: the zone→destination registry is a module-level lookup for the drop hint, not a component */
// A folder that will take a drop, wherever it is drawn.
//
// One component behind all four cases — a list row, an icons tile, a columns row,
// a whole column — because the rule is the same in each: the destination is a
// folder path, and whether a drag may land there is decided by
// `canDropFileSystemItem` reading the entries off the transfer. The old drag stack
// re-derived that per view with index arithmetic, which is why the three views
// could disagree about the same drop.
//
// Both callbacks that a drop can reach are passed in rather than read from a
// context: every view already receives `onMove` and `onExternalDrop` as props, so
// a context would be a second path to values that are already in hand.

import type { ReactNode, Ref } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { Dragzone } from '../../../gestures/Dragzone/dragzone';
import type {
  ActiveDrag,
  DragTransfer,
  DragzoneAcceptEvent,
  DragzoneDropEvent,
  DragzoneEntry,
  DragzoneHandle,
  DragzoneRenderState,
} from '../../../gestures/drag.types';
import { acceptsFileSystemDrop, movableFileSystemSources, readFileSystemDragItems } from '../logic/file-system-drag';
import type { FileSystemExternalDropEvent, FileSystemMoveEvent } from '../types/file-system.types';

// The `<Dragzone>` ids are runtime `useId()`s, opaque to the views. Two overlays
// need to turn the store's `overZoneId` back into something meaningful:
//   • the drop hint (the "Move into …" chip that follows the drag ghost) needs the
//     destination folder;
//   • the drop indicator (the info outline painted at the over zone's rect) needs
//     to know *what kind* of zone it is — a portal overlay is a drag-only surface
//     and carries the overlay test id, a background fallback paints its own ring.
// So every dropzone publishes its mapping here: the destination, and the two flags
// that classify it.
type ZoneRegistration = { background: boolean; destination: string; portal: boolean };

const zoneDestinations = new Map<string, ZoneRegistration>();

export function registerZoneDestination(zoneId: string, destination: string, portal: boolean, background: boolean): void {
  zoneDestinations.set(zoneId, { background, destination, portal });
}

export function unregisterZoneDestination(zoneId: string): void {
  zoneDestinations.delete(zoneId);
}

/** The destination folder a zone id accepts drops for, or `undefined` when the zone is gone. */
export function zoneDestinationFor(zoneId: string): string | undefined {
  return zoneDestinations.get(zoneId)?.destination;
}

/**
 * Whether the zone is a portal (drag-only) surface — the expanded-folder overlays
 * of the list view. The drop indicator draws these with the overlay test id, the
 * same handle the previous per-overlay outlines exposed.
 */
export function isPortalZone(zoneId: string): boolean {
  return zoneDestinations.get(zoneId)?.portal ?? false;
}

/**
 * Whether the zone is a background fallback (the file area's own zone, a column
 * pane). These paint their own drop surface — they have delay and external-drop
 * handling a single shared indicator cannot express — so the indicator skips them.
 */
export function isBackgroundZone(zoneId: string): boolean {
  return zoneDestinations.get(zoneId)?.background ?? false;
}

/**
 * The predicate the views hand `shiftZoneRects` so a scroll shifts the zones
 * that moved with the content (rows, tiles, overlays) and leaves the ones that
 * did not — the body and pane fallbacks wrap the scrollable instead of living
 * inside it, so their cached window rects are already correct and must not be
 * re-based onto a scroll delta.
 */
export function isZoneInScrollableContent(entry: DragzoneEntry): boolean {
  return !isBackgroundZone(entry.id);
}

/**
 * Whether a drag the library *did* see start is nonetheless foreign to this
 * component: a `<Draggable>` somewhere else on the page — a palette chip, an upload
 * tray — carrying a payload of its own rather than FileSystem entries.
 *
 * It belongs on the same path as an OS file drag, because from here the two are the
 * same thing: something arrived that this component did not send, and only the
 * consumer knows what to do with it. Without this a page whose tray chips are
 * `<Draggable>`s would find them silently refused, while the identical payload
 * dragged in from another tab was accepted.
 *
 * Restricted to the HTML5 transport so `dataTransfer` is honest — that is the case
 * where the object handed on is the browser's own, or the readable mirror of it.
 */
function isForeignPayload(drag: ActiveDrag | null, transfer: DragTransfer): boolean {
  if (drag === null || drag.transport !== 'html5') return false;
  return readFileSystemDragItems(transfer).length === 0;
}

export type FileSystemDropzoneProps = {
  /**
   * When true, this zone is a background fallback — the whole file area, a column
   * pane. Such a zone paints its own drop surface (it has delay and external-drop
   * handling a shared indicator cannot express), so the container-level drop
   * indicator skips it.
   */
  background?: boolean;
  children?: ReactNode | ((state: DragzoneRenderState) => ReactNode);
  className?: string;
  /** Folder the drop lands in. `''` is the implicit root. */
  destination: string;
  /** Refuses everything — a file row, or a view with dragging turned off. */
  disabled?: boolean;
  /**
   * When true, accepts every in‑library file‑system drag regardless of
   * `canDropFileSystemItem`. The drop handler still only moves items that can
   * actually change location. Use for a background zone that should always
   * "register" a drag — the origin folder outline, or a column pane fallback.
   */
  portal?: boolean;
  /** Called after a successful move drop — the list view uses it to lazy-load children. */
  onDropCompleted?: (destination: string) => void;
  onExternalDrop?: (event: FileSystemExternalDropEvent) => void;
  onMove?: (event: FileSystemMoveEvent) => void;
  /**
   * Breaks a tie against an overlapping zone. Left at the default for an entry;
   * negative for a background zone that should only win where no entry is.
   */
  priority?: number;
  /** Forwarded to the underlying `<Dragzone>` — see `DragzoneHandle`. */
  ref?: Ref<DragzoneHandle>;
  /** When true, the zone is never measured and always passes the spatial hit test. */
  skipRectMeasure?: boolean;
  /**
   * Optional additional predicate AND-ed with the standard file-system checks.
   * Used by the list view for arithmetic row‑index verification when
   * `skipRectMeasure` is on — the stored `measureInWindow` rect goes stale
   * after a folder expand shifts rows in a FlatList without firing `onLayout`.
   */
  additionalAccepts?: (event: DragzoneAcceptEvent) => boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A `<Dragzone>` configured for one destination folder.
 *
 * `accepts` runs the same predicate the drop runs, so a folder cannot highlight
 * and then refuse: both ask whether *any* carried entry could move here, and the
 * drop then moves exactly those that can. A mixed selection dropped on a folder it
 * partly already lives in moves the rest, which is what a file manager does.
 *
 * External payloads (an OS file drag) are accepted only when the consumer passed
 * `onExternalDrop` — a component that has not asked for files should not swallow
 * the page's own drop handling.
 */
export function FileSystemDropzone({
  additionalAccepts,
  background = false,
  children,
  className,
  destination,
  disabled = false,
  onDropCompleted,
  onExternalDrop,
  onMove,
  portal = false,
  priority,
  ref,
  skipRectMeasure = false,
  style,
  testID,
}: FileSystemDropzoneProps) {
  const accepts = useCallback(
    ({ drag, external, point, transfer, zoneId }: DragzoneAcceptEvent) => {
      if (external) return onExternalDrop !== undefined;
      // A `<Draggable>` from elsewhere on the page — a palette chip, an upload
      // tray — is an in-library drag the store knows all about, and still a
      // foreign *payload*: it carries none of our entries, so there is nothing to
      // move. It goes to `onExternalDrop` for the same reason an OS file does,
      // which is what `onExternalDrop`'s own docs promise ("a custom element on
      // the page that sets drag data").
      if (isForeignPayload(drag, transfer)) {
        // An additional predicate — used by the list view for arithmetic row‑index
        // verification.  Foreign payloads need it too: with `skipRectMeasure`
        // every row passes the spatial hit test, so without this the last‑registered
        // row wins the tie‑break regardless of pointer position.
        if (additionalAccepts && !additionalAccepts({ drag, external, point, transfer, zoneId })) return false;
        return onExternalDrop !== undefined;
      }
      if (additionalAccepts && !additionalAccepts({ drag, external, point, transfer, zoneId })) return false;
      // A portal zone (body background, column pane) accepts every genuine
      // file‑system drag so the origin folder always "registers" the drag and
      // paints its outline. The drop handler still only moves items that can
      // actually change location.
      if (portal) return true;
      return acceptsFileSystemDrop(readFileSystemDragItems(transfer), destination);
    },
    [additionalAccepts, destination, onExternalDrop, portal],
  );

  const handleDrop = useCallback(
    ({ drag, external, transfer }: DragzoneDropEvent) => {
      // The transfer for an external drop *is* the browser's own `DataTransfer` —
      // the zone hands the event object straight through — which is what lets
      // `onExternalDrop` keep its documented shape. A foreign in-library payload
      // arrives as the readable mirror of one (see `mirrorDragTransfer`), so
      // `getData` answers there too; `files` is empty by construction, since a
      // `<Draggable>` has no way to attach any.
      // biome-ignore lint/plugin: ts/no-as-cast — `DragTransfer` is the deliberate subset of `DataTransfer` (see drag.types.ts), and both paths here are web-only, where the object is the browser's own or a mirror of it
      const asDataTransfer = () => onExternalDrop?.({ dataTransfer: transfer as DataTransfer, destination });
      if (external || isForeignPayload(drag, transfer)) return asDataTransfer();
      const sources = movableFileSystemSources(readFileSystemDragItems(transfer), destination);
      // Re-resolved at the release rather than trusted from the last move: the
      // entries are re-read off the transfer, so a folder that became a child of
      // one of them mid-drag refuses here too.
      if (sources.length > 0) {
        onMove?.({ destination, sources });
        onDropCompleted?.(destination);
      }
    },
    [destination, onDropCompleted, onExternalDrop, onMove],
  );

  // The Dragzone's id is a runtime `useId()`; the hint needs it to resolve
  // `overZoneId` back to this folder, so publish the mapping once the zone has
  // mounted and withdraw it on unmount.
  const zoneRef = useRef<DragzoneHandle | null>(null);
  const handleZoneRef = useCallback(
    (node: DragzoneHandle | null) => {
      zoneRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref !== null && ref !== undefined) ref.current = node;
    },
    [ref],
  );

  // biome-ignore lint/plugin: the zone id is only known after the Dragzone mounts, so the mapping must be published in an effect
  useEffect(() => {
    const zoneId = zoneRef.current?.getId();
    if (zoneId === undefined) return;
    registerZoneDestination(zoneId, destination, portal, background);
    return () => unregisterZoneDestination(zoneId);
  }, [background, destination, portal]);

  return (
    <Dragzone
      accepts={accepts}
      acceptsExternal={onExternalDrop !== undefined}
      className={className}
      disabled={disabled}
      dropEffect="move"
      onDrop={handleDrop}
      priority={priority}
      ref={handleZoneRef}
      skipRectMeasure={skipRectMeasure}
      style={style}
      testID={testID}
    >
      {children}
    </Dragzone>
  );
}

/** The outline drawn over a folder a release would land in. */
export function FileSystemDropOutline() {
  return <View className="pointer-events-none absolute inset-0 z-[3] rounded-md border-[1.5px] border-primary" />;
}
