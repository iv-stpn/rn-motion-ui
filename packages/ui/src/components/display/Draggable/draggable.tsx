// A grabbable wrapper whose drag means the same thing on web and native.
//
// The two platforms have nothing in common underneath, so each gets the
// transport that is actually native to it:
//
//  - Web:    the browser's own HTML5 drag (use-draggable-web.ts). Real
//            `DataTransfer`, so it drops onto listeners that never heard of this
//            component — including `<FileSystem onExternalDrop>`.
//  - Native: an RNGH pan armed by a long press, with a ghost of the child
//            following the finger. There is no OS drag session off the web, so
//            the payload is published to a module registry instead, and a drop
//            zone reads it from `getActiveDrag`.
//
// What is identical either way: the `data` you attach, the three callbacks, and
// the {@link DraggableHandle} on the ref. That is the whole point of the
// component — a consumer writes one drag, not two.

import {
  type MutableRefObject,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Platform, View, type ViewProps, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cn } from '../../../lib/cn';
import type {
  DragEffectAllowed,
  DragEndEvent,
  DraggableHandle,
  DragMoveEvent,
  DragPoint,
  DragRect,
  DragStartEvent,
  DragTransfer,
} from './draggable.types';
import { clearActiveDrag, createDragTransfer, setActiveDrag, writeTransferData } from './draggable-transfer';
import { type DraggableSession, useDraggableWeb } from './use-draggable-web';

/** Matches the hold that opens a context menu, so the two never both fire. */
const LONG_PRESS_MS = 300;

// react-native-web honours userSelect at runtime, but it is not in RN's ViewStyle.
type WebViewStyle = ViewStyle & { userSelect?: 'none' };

/** Without this a web drag starting on text selects the text instead of lifting. */
const WEB_HOST_STYLE: WebViewStyle = { userSelect: 'none' };

/** Only the fields the pan handlers read — RNGH's own event type varies by version. */
type PanEvent = { absoluteX: number; absoluteY: number };

type SessionRefs = {
  draggingRef: MutableRefObject<boolean>;
  ghostPos: Animated.ValueXY;
  id: string;
  originRef: MutableRefObject<DragPoint>;
  propsRef: RefObject<DraggableProps>;
  setDragging: (next: boolean) => void;
  transferRef: MutableRefObject<DragTransfer | null>;
};

/**
 * The transport-agnostic drag. Both platforms call exactly these three, which is
 * why the callbacks a consumer sees cannot drift apart between them: the web
 * hook passes the browser's `DataTransfer` to `begin`, native passes the
 * stand-in, and everything after that is shared.
 */
function buildSession(refs: SessionRefs): DraggableSession {
  const { draggingRef, ghostPos, id, originRef, propsRef, setDragging, transferRef } = refs;

  return {
    begin(x, y, transfer) {
      transfer.effectAllowed = propsRef.current?.effectAllowed ?? 'copy';
      writeTransferData(transfer, propsRef.current?.data);
      transferRef.current = transfer;
      originRef.current = { x, y };
      draggingRef.current = true;
      setActiveDrag({ id, transfer });
      ghostPos.setValue({ x: 0, y: 0 });
      setDragging(true);
      propsRef.current?.onDragStart?.({ point: { x, y }, transfer });
    },
    move(x, y) {
      const transfer = transferRef.current;
      if (!(draggingRef.current && transfer)) return;
      const origin = originRef.current;
      const translation = { x: x - origin.x, y: y - origin.y };
      ghostPos.setValue(translation);
      propsRef.current?.onDragMove?.({ point: { x, y }, transfer, translation });
    },
    finish(dropEffect, x, y) {
      const transfer = transferRef.current;
      if (!(draggingRef.current && transfer)) return;
      draggingRef.current = false;
      transferRef.current = null;
      // Guarded by owner: a drag started elsewhere must survive this one ending.
      clearActiveDrag(id);
      ghostPos.setValue({ x: 0, y: 0 });
      setDragging(false);
      // One rule on both platforms: `'none'` means nothing took the payload, so
      // that is what "canceled" means — no target, or the user backed out.
      propsRef.current?.onDragEnd?.({ canceled: dropEffect === 'none', dropEffect, point: { x, y }, transfer });
    },
    isDragging: () => draggingRef.current,
  };
}

type GhostProps = { children: ViewProps['children']; pos: Animated.ValueXY };

/**
 * The lifted copy of the child, tracking the finger. Native only — on web the
 * browser draws its own drag image, and a second one would double it.
 */
function DragGhost({ children, pos }: GhostProps) {
  return (
    <Animated.View
      className="pointer-events-none absolute top-0 left-0 z-50 opacity-80"
      style={{ transform: pos.getTranslateTransform() }}
    >
      {children}
    </Animated.View>
  );
}

export type DraggableProps = Omit<ViewProps, 'children'> & {
  children?: ReactNode;
  /**
   * The payload, MIME key to string — `{ 'application/json': JSON.stringify(x) }`.
   * Read back with `transfer.getData(mime)` in any of the callbacks, or from
   * `event.dataTransfer` in a plain HTML5 drop listener on web.
   */
  data?: Record<string, string>;
  /** What a drop may do with the payload. @default 'copy' */
  effectAllowed?: DragEffectAllowed;
  /** Turns the drag off; the child still renders and stays interactive. @default false */
  disabled?: boolean;
  onDragStart?: (event: DragStartEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  ref?: Ref<DraggableHandle>;
};

/**
 * Makes its child draggable, the same way on web and native.
 *
 * ```tsx
 * <Draggable data={{ 'application/x-item': JSON.stringify(item) }} onDragEnd={report}>
 *   <Chip label={item.name} />
 * </Draggable>
 * ```
 *
 * Web starts a real HTML5 drag, so any `dragover`/`drop` listener can receive it
 * unmodified. Native arms a pan after a {@link LONG_PRESS_MS} hold and publishes
 * the payload to the registry (`getActiveDrag`) for a drop zone to read, since
 * there is no OS drag session to consult.
 *
 * **Accessibility.** This is a wrapper: it adds no semantics, and the child's own
 * role and name are what a screen reader announces. `accessibilityLabel`,
 * `accessibilityRole` and the rest of `ViewProps` forward here for the case where
 * the wrapper itself is the control. A drag is pointer-only on both platforms and
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
  onDragEnd,
  onDragMove,
  onDragStart,
  ref,
  style,
  ...viewProps
}: DraggableProps) {
  const id = useId();
  const nodeRef = useRef<View | null>(null);
  const draggingRef = useRef(false);
  const transferRef = useRef<DragTransfer | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const ghostPos = useRef(new Animated.ValueXY()).current;
  const [dragging, setDragging] = useState(false);

  // Live props for the session, which is built once: a callback identity that
  // changes every render must not tear down a drag in flight.
  const propsRef = useRef<DraggableProps>({});
  propsRef.current = { data, effectAllowed, onDragEnd, onDragMove, onDragStart };

  const session = useMemo(
    () => buildSession({ draggingRef, ghostPos, id, originRef, propsRef, setDragging, transferRef }),
    [ghostPos, id],
  );

  const enabled = !disabled;
  useDraggableWeb({ enabled, nodeRef, session });

  const measure = useCallback(
    () =>
      new Promise<DragRect | null>((resolve) => {
        const node = nodeRef.current;
        if (!node) return resolve(null);
        node.measureInWindow((x, y, width, height) => resolve({ height, width, x, y }));
      }),
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      cancel: () => session.finish('none', originRef.current.x, originRef.current.y),
      getNode: () => nodeRef.current,
      getTransfer: () => transferRef.current,
      isDragging: () => draggingRef.current,
      measure,
    }),
    [measure, session],
  );

  const gesture = useMemo(() => {
    if (Platform.OS === 'web' || !enabled) return null;
    return (
      Gesture.Pan()
        .activateAfterLongPress(LONG_PRESS_MS)
        .runOnJS(true)
        .onStart(({ absoluteX, absoluteY }: PanEvent) => session.begin(absoluteX, absoluteY, createDragTransfer(effectAllowed)))
        .onUpdate(({ absoluteX, absoluteY }: PanEvent) => session.move(absoluteX, absoluteY))
        // Released. Whatever a drop zone wrote onto the transfer is the verdict, and
        // an untouched one still reads 'none' — the same rule the browser applies.
        .onEnd(({ absoluteX, absoluteY }: PanEvent) => {
          session.finish(transferRef.current?.dropEffect ?? 'none', absoluteX, absoluteY);
        })
        .onFinalize(({ absoluteX, absoluteY }: PanEvent) => {
          // A gesture the system took away (a scroll won, the view unmounted) ends
          // here and nowhere else — onEnd does not fire for it, so it is a cancel.
          if (session.isDragging()) session.finish('none', absoluteX, absoluteY);
        })
    );
  }, [effectAllowed, enabled, session]);

  const host = (
    <View
      ref={nodeRef}
      className={cn(enabled && (dragging ? 'cursor-grabbing' : 'cursor-grab'), className)}
      // Without this a web drag starting on text selects it instead of lifting.
      style={[enabled && Platform.OS === 'web' ? WEB_HOST_STYLE : null, style]}
      {...viewProps}
    >
      {children}
      {dragging && Platform.OS !== 'web' ? <DragGhost pos={ghostPos}>{children}</DragGhost> : null}
    </View>
  );

  return gesture === null ? host : <GestureDetector gesture={gesture}>{host}</GestureDetector>;
}
