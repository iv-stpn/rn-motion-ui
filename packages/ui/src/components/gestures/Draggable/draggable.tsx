// A grabbable wrapper whose drag means the same thing everywhere.
//
// Thin on purpose: `useDraggable` is the whole of the drag, and this is that hook
// plus the three elements it needs — a host `View`, the ghost, and the
// `GestureDetector` a hook cannot render. Anything this does, the hook does; reach
// for the hook when the host has to be something other than a `View`.
//
// Three transports, one contract. Each platform gets the one that is actually
// native to it:
//
//  - Web, mouse:  the browser's own HTML5 drag (`use-draggable-html5.ts`). A real
//                 `DataTransfer`, so it drops onto listeners that never heard of
//                 this library — including `<FileSystem onExternalDrop>`.
//  - Web, touch:  a pointer-driven pan (`use-draggable-pointer.ts`). Mobile
//                 browsers fire no HTML5 drag for touch at all, so without this the
//                 component would simply not work on a phone's browser.
//  - Native:      an RNGH pan, on the same phases and the same resolved tuning.
//
// Both pans read a press in phases — the scroll's window, then the drag's, then the
// hold's where the platform has one — and both lift on a *move*, never on a still
// finger. Which is what leaves a bare hold to `onHold`, and to whatever the child
// does with one. See the diagram in `drag-behavior.ts`.
//
// What is identical across all three: the `data` you attach, the callbacks, the
// groups that decide which `<Dragzone>` will have it, and the handle on the ref.

import { type ReactNode, type Ref, useImperativeHandle } from 'react';
import { Animated, View, type ViewProps } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import type { DraggableHandle } from '../drag.types';
import { type UseDraggableOptions, useDraggable } from './use-draggable';

/**
 * The ghost's cosmetics, which the hook deliberately does not supply — it gives
 * position and nothing else. Held here so a `<Draggable>` still looks like one, and
 * matched to `DragGhost` so a drag looks the same whether this component draws the
 * ghost or a `<DragManager>` does.
 */
const GHOST_CLASS = 'z-50 opacity-80';

export type DraggableProps = Omit<ViewProps, 'children'> &
  UseDraggableOptions & {
    children?: ReactNode;
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
 * to observe every drag under a subtree, to isolate one board from another, or to
 * set one press timeline for everything beneath it.
 *
 * **Transports.** Mouse on web rides the browser's own HTML5 drag, so the payload
 * crosses to code that never heard of this library — a bare `dragover`/`drop` pair,
 * `<FileSystem onExternalDrop>`, another window. Touch on web has no such API, so it
 * gets a pointer-driven pan; native gets an RNGH pan on the same timings. Which one
 * ran is on `transport` in the store's `ActiveDrag`.
 *
 * **A hold alone never drags.** Both pans read a press in phases: movement before
 * `armDelay` belongs to whatever is scrolling underneath, movement after it lifts a
 * drag, and — where the platform has a hold at all — a press that reaches `holdDelay`
 * without moving is a hold, {@link UseDraggableOptions.onHold}, which is where a
 * context menu or a selection toggle goes. So a drag and a hold are exclusive by
 * construction rather than by two timers agreeing: hold still and the hold has it,
 * move and the drag does. A move past `escapeSlop` still escapes a hold that fired.
 *
 * **Per-OS.** Those four numbers default per platform and are overridable per
 * platform — `behavior={{ android: { slop: 12 } }}`, or once for a subtree on
 * `<DragManager behavior>`. Web defaults to *no* hold, since a long press in a
 * browser already means the context menu or a text selection.
 *
 * **Styling.** This wrapper draws nothing of its own: no cursor, no dimming, no
 * lifted state. `className` and `style` land on the host, and
 * `useDraggable().isDragging` is the flag to drive the rest from — `className={cn(
 * 'cursor-grab', isDragging && 'cursor-grabbing opacity-50')}` on your own child.
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
  behavior,
  children,
  className,
  data,
  disabled = false,
  effectAllowed = 'copy',
  groups,
  onDragEnd,
  onDragMove,
  onDragStart,
  onHold,
  onHoldEscape,
  onPhaseChange,
  preview,
  ref,
  style,
  testID,
  trackPhase,
  transports = 'auto',
  ...viewProps
}: DraggableProps) {
  // The child is the ghost unless told otherwise — a row whose full-width copy would
  // swamp the screen is exactly when to pass something smaller.
  const previewNode = preview ?? children;

  const drag = useDraggable({
    behavior,
    data,
    disabled,
    effectAllowed,
    groups,
    onDragEnd,
    onDragMove,
    onDragStart,
    onHold,
    onHoldEscape,
    onPhaseChange,
    preview: previewNode,
    testID,
    trackPhase,
    transports,
  });

  useImperativeHandle(ref, () => drag.handle, [drag.handle]);

  const root = drag.getRootProps();
  const host = (
    <View
      ref={root.ref}
      className={className}
      onLayout={root.onLayout}
      style={[root.style, style]}
      testID={testID}
      {...viewProps}
    >
      {children}
      {drag.showGhost ? (
        <Animated.View {...drag.getGhostProps()} className={GHOST_CLASS}>
          {previewNode}
        </Animated.View>
      ) : null}
    </View>
  );

  return drag.gesture === null ? host : <GestureDetector gesture={drag.gesture}>{host}</GestureDetector>;
}

// Declared with the hook now, since that is where it is read. Re-exported so this
// subpath still carries every name it used to.
export type { DraggableTransports } from './use-draggable';
