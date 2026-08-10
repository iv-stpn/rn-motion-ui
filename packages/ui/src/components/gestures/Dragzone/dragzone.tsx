// A region that accepts drags, on every platform and from outside the app.
//
// The zone does not watch the pointer itself. It registers a box with the store
// and the store decides — one hit test, one winner, the same answer on web and
// native. That is deliberate: the browser's own `dragover` targeting and a
// rect-based test disagree about overlapping and clipped boxes, so only one of the
// two can be the authority, and it has to be the one that also exists on native.
//
// The DOM listeners in `use-dragzone-web.ts` are still needed, for the two things
// only the browser can tell us: that a drop is welcome here (without
// `preventDefault` the browser refuses the drop and shows a "no" cursor), and that
// a payload arrived from outside the page entirely.

import { type ReactNode, type Ref, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../../../lib/cn';
import type {
  DragGroups,
  DragRect,
  DragzoneAcceptEvent,
  DragzoneConfig,
  DragzoneDragEvent,
  DragzoneDropEvent,
  DragzoneHandle,
  DragzoneRenderState,
} from '../drag.types';
import { useDragScope } from '../drag-scope';
import { type DragzoneRegistration, registerDragzone } from '../drag-store';
import { useDragSnapshot, useEvent } from '../use-drag-store';
import { useDragzoneWeb } from './use-dragzone-web';

export type DragzoneProps = Omit<ViewProps, 'children'> & {
  /**
   * The zone's content, or a function of its state — `({ isOver }) => …` — for the
   * cases a class name cannot express, like swapping an icon or counting what would
   * land here.
   */
  children?: ReactNode | ((state: DragzoneRenderState) => ReactNode);
  /**
   * Which sources this zone takes: a drag lands here when its groups and these
   * intersect. Omit on either side and everything matches, which is what you want
   * with one kind of drag in the tree. Inherited from an enclosing `<DragManager>`
   * when omitted here.
   */
  groups?: DragGroups;
  /** Refuses every drag; the content still renders and stays interactive. @default false */
  disabled?: boolean;
  /** What this zone claims a drop does with the payload. @default 'copy' */
  dropEffect?: DragzoneConfig['dropEffect'];
  /**
   * The last word on a drag, asked after groups have matched and the pointer is
   * inside — read `event.transfer.getData(mime)` and decide. Called on every move
   * while over the zone, so keep it cheap and free of side effects.
   */
  accepts?: (event: DragzoneAcceptEvent) => boolean;
  /**
   * Take payloads from outside the app — an OS file drag, another tab. Web only,
   * and off by default: a zone that has not asked for files should not swallow the
   * page's own drop handling. Files arrive on {@link DragzoneDropEvent.files}.
   * @default false
   */
  acceptsExternal?: boolean;
  /** Breaks a tie between overlapping zones; higher wins. @default 0 */
  priority?: number;
  /**
   * When true, this zone is never measured and always passes the spatial hit test.
   * Set on zones whose consumer handles hit testing through another mechanism
   * (e.g. arithmetic position calculation in SortableList). @default false
   */
  skipRectMeasure?: boolean;
  /** Applied while a drag this zone would take is in flight, anywhere. */
  eligibleClassName?: string;
  /** Applied while the pointer is inside, so a release now lands here. */
  overClassName?: string;
  onDragEnter?: (event: DragzoneDragEvent) => void;
  onDragOver?: (event: DragzoneDragEvent) => void;
  onDragLeave?: (event: DragzoneDragEvent) => void;
  onDrop?: (event: DragzoneDropEvent) => void;
  ref?: Ref<DragzoneHandle>;
};

/**
 * A drop target for `<Draggable>`, and for the OS.
 *
 * ```tsx
 * <Dragzone
 *   groups={['cards']}
 *   overClassName="border-primary bg-primary/10"
 *   onDrop={({ transfer }) => accept(JSON.parse(transfer.getData('application/x-card')))}
 * >
 *   <Text>Drop a card here</Text>
 * </Dragzone>
 * ```
 *
 * Needs no `<DragManager>`: sources and zones find each other through one
 * module-level store, so a zone works wherever it is mounted — a different screen,
 * a portal, a sibling subtree. Add a manager to scope groups, to isolate one board
 * from another, or to draw the ghost above clipping ancestors.
 *
 * **Which zone wins.** Overlapping zones resolve by explicit `priority`, then by
 * nesting depth (an inner zone beats the one it sits in), then by area (the smaller
 * box), then by mount order. So a trash can inside a board takes the drop without
 * either side declaring anything.
 *
 * **Accessibility.** A zone is a region, not a control: it adds no semantics of its
 * own, and `accessibilityLabel`/`accessibilityRole` forward for when it should be
 * announced. Dropping is pointer-only on every platform, so the outcome a drop
 * produces **must also be reachable without one** — a "Move to…" menu item, a
 * keyboard command. Highlighting on `isOver` is a visual cue only; announce the
 * state change yourself if it carries meaning.
 */
export function Dragzone({
  accepts,
  acceptsExternal = false,
  children,
  className,
  disabled = false,
  dropEffect = 'copy',
  eligibleClassName,
  groups,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  overClassName,
  priority = 0,
  ref,
  skipRectMeasure = false,
  testID,
  ...viewProps
}: DragzoneProps) {
  const id = useId();
  const scope = useDragScope();
  const nodeRef = useRef<View | null>(null);
  const registrationRef = useRef<DragzoneRegistration | null>(null);

  const measure = useCallback(
    () =>
      new Promise<DragRect | null>((resolve) => {
        const node = nodeRef.current;
        if (!node) return resolve(null);
        node.measureInWindow((x, y, width, height) => resolve({ height, width, x, y }));
      }),
    [],
  );

  // Read fresh on every hit test, so a prop change needs no re-registration — and
  // stable in identity, so a re-render never drops the zone out of the store
  // mid-drag.
  const getConfig = useEvent(
    (): DragzoneConfig => ({
      accepts,
      acceptsExternal,
      disabled,
      dropEffect,
      groups: groups ?? scope.groups,
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop,
      priority,
      skipRectMeasure,
      testID,
    }),
  );

  const { managerPath } = scope;
  // biome-ignore lint/plugin: registering with an external store must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    const registration = registerDragzone({ getConfig, id, managerPath, measure });
    registrationRef.current = registration;
    // Skip measure when the consumer handles hit testing through another mechanism
    // (e.g. arithmetic position calculation in SortableList).
    if (!skipRectMeasure) registration.remeasure().catch(() => undefined);
    return () => {
      registrationRef.current = null;
      registration.unregister();
    };
  }, [getConfig, id, managerPath, measure, skipRectMeasure]);

  const remeasure = useCallback(() => {
    if (skipRectMeasure) return Promise.resolve();
    return registrationRef.current?.remeasure() ?? Promise.resolve();
  }, [skipRectMeasure]);
  const handleLayout = useCallback(() => {
    if (skipRectMeasure) return;
    remeasure().catch(() => undefined);
  }, [skipRectMeasure, remeasure]);

  // The snapshot rather than `useDragzoneState`, because the render state names the
  // drag as well as this zone's standing in it — and it is the same subscription.
  const snapshot = useDragSnapshot();
  const isExternalOver = useDragzoneWeb({ acceptsExternal, enabled: !disabled, nodeRef, zoneId: id });

  useImperativeHandle(ref, () => ({ getId: () => id, getNode: () => nodeRef.current, measure, remeasure }), [
    id,
    measure,
    remeasure,
  ]);

  // An external payload is only ever known to be here while it is over the zone —
  // the browser reports a foreign drag at this node and nowhere earlier — so for
  // that case eligibility and hover are one fact, not two.
  const state: DragzoneRenderState = useMemo(() => {
    const isOver = snapshot.overZoneId === id;
    const isEligible = snapshot.drag !== null && snapshot.eligibleZoneIds.includes(id);
    return {
      drag: snapshot.drag,
      external: isExternalOver,
      isEligible: isEligible || isExternalOver,
      isOver: isOver || isExternalOver,
    };
  }, [id, isExternalOver, snapshot]);

  const content = typeof children === 'function' ? children(state) : children;

  return (
    <View
      ref={nodeRef}
      className={cn(className, state.isEligible && eligibleClassName, state.isOver && overClassName)}
      onLayout={handleLayout}
      testID={testID}
      {...viewProps}
    >
      {content}
    </View>
  );
}
