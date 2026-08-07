// An optional coordinator for the drags happening beneath it.
//
// Optional is the important word: `<Draggable>` and `<Dragzone>` register with one
// module-level store, so a pair of them works with no manager anywhere in the tree.
// What a manager adds is the four things that need a *place* in the tree to mean
// anything — a default group for everything under it, a boundary drags cannot cross,
// a frame to draw the ghost in that outlives clipping ancestors, and a vantage point
// to observe every drag in a subtree from.
//
// Nesting works by path rather than by provider: a manager publishes the chain of
// ids from the root down to itself, and the store decides isolation by comparing
// those chains. So an inner board isolates from an outer one without either needing
// to know the other exists, and a zone mounted somewhere else entirely — a portal, a
// different screen — is still reachable as long as no isolating manager sits between.

import { type ReactNode, type Ref, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef } from 'react';
import { View, type ViewProps } from 'react-native';
import type {
  DragDropEffect,
  DragGroups,
  DragManagerConfig,
  DragManagerEvent,
  DragManagerHandle,
  DragRect,
  DragzoneDropEvent,
} from '../drag.types';
import type { DragBehavior } from '../drag-behavior';
import { type DragScope, DragScopeContext, useDragScope } from '../drag-scope';
import { cancelActiveDrag, getActiveDrag, refreshDragzones, registerDragManager } from '../drag-store';
import { useEvent } from '../use-drag-store';
import { DragManagerOverlay } from './drag-manager-overlay';
import { useZoneRemeasure } from './use-zone-remeasure';

export type DragManagerProps = Omit<ViewProps, 'children'> & {
  children?: ReactNode;
  /**
   * Groups every `<Draggable>` and `<Dragzone>` beneath this manager inherits when
   * it names none of its own — the one-line way to keep two boards from mixing.
   * A child that names its own groups overrides this rather than adding to it.
   */
  groups?: DragGroups;
  /**
   * The press timeline every `<Draggable>` beneath this manager inherits when it
   * sets none of its own — arm window, hold delay, and the two slops, each settable
   * per OS. A source that sets its own `behavior` replaces this rather than merging
   * with it.
   *
   * This is the right grain for the setting: a list whose rows are all sources needs
   * one arm window agreed on by every row, because the `ScrollView` underneath them
   * is one gesture competing with all of them at once. See {@link DragBehavior}.
   *
   * ```tsx
   * <DragManager behavior={{ armDelay: 0, android: { slop: 8 }, web: { holdDelay: null } }}>
   * ```
   */
  behavior?: DragBehavior;
  /**
   * Confine drags to this subtree: a source under here reaches only zones under
   * here, and a zone under here is reachable only from inside. Group labels are
   * advisory and easy to get wrong across a large tree; this is structural.
   * @default false
   */
  isolate?: boolean;
  /**
   * Draw the ghost for drags lifted beneath this manager, in this manager's own
   * frame. Which is what you want when a source sits inside something that clips —
   * a scroll view, an `overflow: hidden` card — since a ghost drawn inside the
   * source is cut off at that boundary. Set `false` to hand the job outward to a
   * manager further up. Unused under the HTML5 transport, where the browser draws
   * its own drag image.
   * @default true
   */
  overlay?: boolean;
  /** A drag lifted anywhere beneath this manager, including under nested ones. */
  onDragStart?: (event: DragManagerEvent) => void;
  /** Every move of that drag. Fires at pointer rate — keep it cheap. */
  onDragMove?: (event: DragManagerEvent) => void;
  /** That drag ending, dropped or not. Fires after the zone's own `onDrop`. */
  onDragEnd?: (event: DragManagerEvent & { canceled: boolean; dropEffect: DragDropEffect }) => void;
  /** A drop landing on any zone beneath this manager, after that zone has handled it. */
  onDrop?: (event: DragzoneDropEvent) => void;
  ref?: Ref<DragManagerHandle>;
};

/**
 * Scopes and observes the drags beneath it. Nestable.
 *
 * ```tsx
 * <DragManager groups={['cards']} isolate onDrop={({ zoneId }) => log(zoneId)}>
 *   <Board />
 * </DragManager>
 * ```
 *
 * Add one when you want a default group for a subtree, a boundary drags cannot
 * cross, a ghost that escapes a clipping ancestor, or a single place to watch every
 * drag in a subtree from. A `<Draggable>`/`<Dragzone>` pair needs none of that to
 * work, so reach for this when one of those four is the thing you are after.
 *
 * **Nesting.** The nearest manager wins for groups and for the ghost; isolation is
 * the deepest isolating ancestor the two sides share. Two isolating managers side by
 * side are therefore two independent systems, and an isolating manager inside another
 * one is a board whose cards cannot leave it while the outer board's still move
 * freely among their own zones.
 *
 * **Accessibility.** Renders a plain `View` and adds no semantics. It is also the
 * natural place to put the non-pointer path a drag system owes its users: a manager
 * sees every drop, so the command that performs the same move from a menu or the
 * keyboard belongs at this level, next to the handler that performs it on drop.
 */
export function DragManager({
  behavior,
  children,
  groups,
  isolate = false,
  onDragEnd,
  onDragMove,
  onDragStart,
  onDrop,
  overlay = true,
  ref,
  ...viewProps
}: DragManagerProps) {
  const id = useId();
  const parent = useDragScope();
  const rectRef = useRef<DragRect | null>(null);
  const nodeRef = useRef<View | null>(null);

  const measure = useCallback(
    () =>
      new Promise<DragRect | null>((resolve) => {
        const node = nodeRef.current;
        if (!node) return resolve(null);
        node.measureInWindow((x, y, width, height) => resolve({ height, width, x, y }));
      }),
    [],
  );

  // The manager's own box, kept on a ref: it is read by the overlay on every
  // pointer move to convert window coordinates into this manager's frame, and a
  // re-render per move is exactly what the move channel exists to avoid.
  const handleLayout = useCallback(() => {
    measure()
      .then((rect) => {
        rectRef.current = rect;
      })
      .catch(() => undefined);
    // A manager moving usually means the zones inside it moved too.
    refreshDragzones().catch(() => undefined);
  }, [measure]);

  const inheritedGroups = groups ?? parent.groups;
  const getConfig = useEvent(
    (): DragManagerConfig => ({
      groups: inheritedGroups,
      hostsOverlay: overlay,
      isolate,
      onDragEnd,
      onDragMove,
      onDragStart,
      onDrop,
    }),
  );

  const { managerPath: parentPath } = parent;
  const path = useMemo(() => [...parentPath, id], [id, parentPath]);
  const parentId = parent.managerId;

  // biome-ignore lint/plugin: registering with an external store must run in an effect; no data-fetching or render-driving state
  useEffect(() => registerDragManager({ getConfig, id, parentId, path }), [getConfig, id, parentId, path]);

  // Only the outermost manager listens: the refresh measures every zone in the
  // store regardless of who asked, so a nested manager doing it too would mean
  // three managers racing to re-measure the same boxes off one scroll.
  useZoneRemeasure(parentId === null);

  // Annotated rather than inferred, so a field added to `DragScope` fails here
  // instead of silently not being provided to the subtree.
  const scope = useMemo<DragScope>(
    () => ({
      // Same rule as `groups`: the nearest manager that names one wins, and a source
      // naming its own overrides rather than merging into it.
      behavior: behavior ?? parent.behavior,
      groups: inheritedGroups,
      managerId: id,
      managerPath: path,
      // The nearest manager that will have the job, searching outward — so
      // `overlay={false}` hands it up rather than dropping it.
      overlayHostId: overlay ? id : parent.overlayHostId,
    }),
    [behavior, id, inheritedGroups, overlay, parent.behavior, parent.overlayHostId, path],
  );

  useImperativeHandle(ref, () => ({ cancelDrag: cancelActiveDrag, getActiveDrag, refreshZones: refreshDragzones }), []);

  return (
    <DragScopeContext.Provider value={scope}>
      <View ref={nodeRef} onLayout={handleLayout} {...viewProps}>
        {children}
        {overlay ? <DragManagerOverlay hostId={id} rectRef={rectRef} /> : null}
      </View>
    </DragScopeContext.Provider>
  );
}
