// A grabbable wrapper whose drag means the same thing everywhere.
//
// Three transports, one contract. Each platform gets the one that is actually
// native to it:
//
//  - Web, mouse:  the browser's own HTML5 drag (`use-draggable-html5.ts`). A real
//                 `DataTransfer`, so it drops onto listeners that never heard of
//                 this library — including `<FileSystem onExternalDrop>`.
//  - Web, touch:  a pointer-driven pan armed by a hold (`use-draggable-pointer.ts`).
//                 Mobile browsers fire no HTML5 drag for touch at all, so without
//                 this the component would simply not work on a phone's browser.
//  - Native:      an RNGH pan armed by the same hold.
//
// What is identical across all three: the `data` you attach, the callbacks, the
// groups that decide which `<Dragzone>` will have it, and the handle on the ref.

import { type ReactNode, type Ref, useCallback, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Animated, Platform, View, type ViewProps, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cn } from '../../../lib/cn';
import type {
  DragEffectAllowed,
  DragEndEvent,
  DragGroups,
  DraggableHandle,
  DragMoveEvent,
  DragPoint,
  DragRect,
  DragStartEvent,
  DragTransfer,
} from '../drag.types';
import { DragGhost } from '../drag-ghost';
import { useDragScope } from '../drag-scope';
import { createDragTransfer } from '../drag-transfer';
import { buildSession, DRAG_HOLD_MS, type DraggableLiveProps, type DraggableSession } from './draggable-session';
import { useDraggableHtml5 } from './use-draggable-html5';
import { useDraggablePointer } from './use-draggable-pointer';

// react-native-web honours userSelect at runtime, but it is not in RN's ViewStyle.
type WebViewStyle = ViewStyle & { userSelect?: 'none' };

/** Without this a web drag starting on text selects the text instead of lifting. */
const WEB_HOST_STYLE: WebViewStyle = { userSelect: 'none' };

/** Only the fields the pan handlers read — RNGH's own event type varies by version. */
type PanEvent = { absoluteX: number; absoluteY: number };

type PanGestureParams = { effectAllowed: DragEffectAllowed; session: DraggableSession };

/**
 * The native transport: an RNGH pan armed by a hold.
 *
 * `runOnJS(true)` because every handler reaches the store, which is plain JS state —
 * there is no worklet half to this, and the pointer stream is well under the rate
 * where that would matter.
 */
function buildPanGesture({ effectAllowed, session }: PanGestureParams) {
  return Gesture.Pan()
    .activateAfterLongPress(DRAG_HOLD_MS)
    .runOnJS(true)
    .onStart(({ absoluteX, absoluteY }: PanEvent) =>
      session.begin({ point: { x: absoluteX, y: absoluteY }, transfer: createDragTransfer(effectAllowed), transport: 'pan' }),
    )
    .onUpdate(({ absoluteX, absoluteY }: PanEvent) => session.move({ x: absoluteX, y: absoluteY }))
    .onEnd(({ absoluteX, absoluteY }: PanEvent) => session.finish({ commit: true, point: { x: absoluteX, y: absoluteY } }))
    .onFinalize(({ absoluteX, absoluteY }: PanEvent) => {
      // A gesture the system took away (a scroll won, the view unmounted) ends
      // here and nowhere else — `onEnd` does not fire for it, so it is a cancel.
      if (session.isDragging()) session.finish({ commit: false, point: { x: absoluteX, y: absoluteY } });
    });
}

/** Which transports may run. `'auto'` is the right answer unless you are working around one. */
export type DraggableTransports = 'auto' | 'html5' | 'pan';

export type DraggableProps = Omit<ViewProps, 'children'> & {
  children?: ReactNode;
  /**
   * The payload, MIME key to string — `{ 'application/json': JSON.stringify(x) }`.
   * Read back with `transfer.getData(mime)` in any of the callbacks, from a
   * `<Dragzone onDrop>`, or from `event.dataTransfer` in a plain HTML5 drop listener
   * when the HTML5 transport ran.
   */
  data?: Record<string, string>;
  /**
   * Labels deciding which `<Dragzone>`s will have this drag: a zone takes it when
   * their groups intersect. Omit — on both sides — and everything matches
   * everything, which is the right default for a tree with one kind of drag in it.
   * Inherited from an enclosing `<DragManager>` when not given here.
   */
  groups?: DragGroups;
  /** What a drop may do with the payload. @default 'copy' */
  effectAllowed?: DragEffectAllowed;
  /** Turns the drag off; the child still renders and stays interactive. @default false */
  disabled?: boolean;
  /**
   * What the ghost shows, when a pan transport draws one. Defaults to the child —
   * give something smaller for a row whose full-width copy would swamp the screen.
   * Unused under HTML5, where the browser draws its own drag image.
   */
  preview?: ReactNode;
  /**
   * Which transports may run. `'auto'` picks per pointer: HTML5 for a mouse, a pan
   * for touch. Pin it to `'pan'` to keep a drag inside the library — a uniform ghost,
   * no OS drag session — or to `'html5'` to opt a component out of touch dragging.
   * @default 'auto'
   */
  transports?: DraggableTransports;
  onDragStart?: (event: DragStartEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  ref?: Ref<DraggableHandle>;
};

/**
 * Makes its child draggable, the same way on web and native.
 *
 * ```tsx
 * <DragManager>
 *   <Draggable data={{ 'application/x-item': JSON.stringify(item) }} groups={['cards']}>
 *     <Chip label={item.name} />
 *   </Draggable>
 *   <Dragzone groups={['cards']} onDrop={({ transfer }) => accept(transfer)} />
 * </DragManager>
 * ```
 *
 * A `<DragManager>` is optional — without one, a drag still reaches every
 * `<Dragzone>` in the tree, because all three register with one module-level store
 * rather than a context. Add a manager to draw the ghost above clipping ancestors,
 * to observe every drag under a subtree, or to isolate one board from another.
 *
 * **Transports.** Mouse on web rides the browser's own HTML5 drag, so the payload
 * crosses to code that never heard of this library — a bare `dragover`/`drop` pair,
 * `<FileSystem onExternalDrop>`, another window. Touch on web has no such API, so it
 * gets a pointer-driven pan after a {@link DRAG_HOLD_MS} hold; native gets an RNGH
 * pan on the same timing, which matches the context-menu hold so the two never both
 * fire. Which one ran is on `transport` in the store's `ActiveDrag`.
 *
 * **Accessibility.** This is a wrapper: it adds no semantics, and the child's own
 * role and name are what a screen reader announces. `accessibilityLabel`,
 * `accessibilityRole` and the rest of `ViewProps` forward here for the case where
 * the wrapper itself is the control. A drag is pointer-only on every platform and
 * cannot be offered to assistive tech, so **every `Draggable` needs a second,
 * non-pointer path to the same outcome** — a context-menu "Move to…", a keyboard
 * shortcut — or the action simply does not exist for part of your users. Announce
 * the drag yourself if it matters: there is no live region of its own here.
 */
export function Draggable({
  children,
  className,
  data,
  disabled = false,
  effectAllowed = 'copy',
  groups,
  onDragEnd,
  onDragMove,
  onDragStart,
  preview,
  ref,
  style,
  testID,
  transports = 'auto',
  ...viewProps
}: DraggableProps) {
  const id = useId();
  const scope = useDragScope();
  const nodeRef = useRef<View | null>(null);
  const draggingRef = useRef(false);
  const transferRef = useRef<DragTransfer | null>(null);
  const grabRef = useRef<DragPoint>({ x: 0, y: 0 });
  const rectRef = useRef<DragRect | null>(null);
  const ghostPos = useRef(new Animated.ValueXY()).current;
  const [ghost, setGhost] = useState(false);

  // Live props for the session, which is built once: a callback identity that
  // changes every render must not tear down a drag in flight.
  //
  // `groups` is resolved here rather than in the session, and the same way `<Dragzone>`
  // resolves its own: the manager's groups are a default this source may override, and
  // neither side can inherit at registration time without asking React where it sits.
  const propsRef = useRef<DraggableLiveProps>({});
  propsRef.current = { data, effectAllowed, groups: groups ?? scope.groups, onDragEnd, onDragMove, onDragStart, testID };

  const previewNode = preview ?? children;
  const previewRef = useRef<ReactNode>(previewNode);
  previewRef.current = previewNode;

  const { managerId, managerPath, overlayHostId } = scope;
  const session = useMemo(
    () =>
      buildSession({
        draggingRef,
        ghostPos,
        grabRef,
        id,
        managerId,
        managerPath,
        overlayHostId,
        previewRef,
        propsRef,
        rectRef,
        setGhost,
        transferRef,
      }),
    [ghostPos, id, managerId, managerPath, overlayHostId],
  );

  const measure = useCallback(
    () =>
      new Promise<DragRect | null>((resolve) => {
        const node = nodeRef.current;
        if (!node) return resolve(null);
        node.measureInWindow((x, y, width, height) => resolve({ height, width, x, y }));
      }),
    [],
  );

  // The rect the ghost is anchored and sized to. Kept on a ref through layout so
  // `begin` has it synchronously — a lift cannot wait a microtask for a measure.
  const handleLayout = useCallback(() => {
    measure()
      .then((rect) => {
        rectRef.current = rect;
      })
      .catch(() => undefined);
  }, [measure]);

  useImperativeHandle(
    ref,
    () => ({
      cancel: () => session.finish({ commit: false, point: grabRef.current }),
      getNode: () => nodeRef.current,
      getTransfer: () => transferRef.current,
      isDragging: () => draggingRef.current,
      measure,
    }),
    [measure, session],
  );

  const enabled = !disabled;
  const html5 = enabled && transports !== 'pan';
  const pointerPan = enabled && transports !== 'html5';
  useDraggableHtml5({ enabled: html5, nodeRef, session });
  useDraggablePointer({ effectAllowed, enabled: pointerPan, nodeRef, session });

  const gesture = useMemo(
    () => (Platform.OS === 'web' || !pointerPan ? null : buildPanGesture({ effectAllowed, session })),
    [effectAllowed, pointerPan, session],
  );

  const host = (
    <View
      ref={nodeRef}
      className={cn(enabled && (ghost ? 'cursor-grabbing' : 'cursor-grab'), className)}
      onLayout={handleLayout}
      // Without this a web drag starting on text selects the text instead of lifting.
      style={[enabled && Platform.OS === 'web' ? WEB_HOST_STYLE : null, style]}
      testID={testID}
      {...viewProps}
    >
      {children}
      {ghost ? <DragGhost pos={ghostPos}>{previewNode}</DragGhost> : null}
    </View>
  );

  return gesture === null ? host : <GestureDetector gesture={gesture}>{host}</GestureDetector>;
}
