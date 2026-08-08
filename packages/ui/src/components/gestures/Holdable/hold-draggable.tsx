// A hold + drag in one gesture, with the phase always tracked.
//
// `<Draggable>` with `trackPhase` is all this is: the press runs the same four-
// phase timeline (pending → active → hold → drag) on the same resolved tuning,
// the ghost and session are the same, and the child just gains render-prop access
// to the current phase without an extra state lift.
//
//   <HoldDraggable
//     data={{ 'application/x-item': id }}
//     onHold={openContextMenu}
//     onHoldEscape={closeContextMenu}
//   >
//     {({ isHeld, isPressed }) => (
//       <Chip label={name} pressed={isPressed} lifted={isHeld} />
//     )}
//   </HoldDraggable>
//
// For a hold with *no* drag, use `<Holdable>` instead.

import { type ReactNode, type Ref, useImperativeHandle } from 'react';
import { Animated, View, type ViewProps } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { type UseDraggableOptions, useDraggable } from '../Draggable/use-draggable';
import type { DraggableHandle } from '../drag.types';
import type { HoldableState } from './holdable';

/**
 * The ghost's cosmetics — matches `<Draggable>` so the two are interchangeable
 * from the drag manager's point of view.
 */
const GHOST_CLASS = 'z-50 opacity-80';

export type HoldDraggableProps = Omit<ViewProps, 'children' | 'ref'> &
  Omit<UseDraggableOptions, 'trackPhase'> & {
    children?: ReactNode | ((state: HoldableState) => ReactNode);
    ref?: Ref<DraggableHandle>;
  };

/**
 * A draggable element whose press phase is always visible to its child.
 *
 * ```tsx
 * <HoldDraggable
 *   data={{ 'application/x-item': item.id }}
 *   onHold={() => openMenu(item)}
 *   onHoldEscape={closeMenu}
 * >
 *   {({ isPressed, isHeld }) => (
 *     <Row row={item} pressed={isPressed} selected={isHeld} />
 *   )}
 * </HoldDraggable>
 * ```
 *
 * Identical to `<Draggable trackPhase>` in every other way — same transports,
 * same ghost, same `onHold` / `onHoldEscape`, same `<DragManager>` integration.
 * `trackPhase` is always on here so the render-prop child always gets a live
 * phase; use `<Draggable trackPhase>` directly if you do not need the render-prop.
 *
 * **Hold defaults.** Web's drag transport defaults to `holdDelay: null`, so `onHold`
 * on web needs `behavior={{ web: { holdDelay: 300 } }}` to fire. Touch on web and
 * all native platforms hold by default.
 */
export function HoldDraggable({
  behavior,
  children,
  className,
  cursorMode = false,
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
  transports = 'auto',
  ...viewProps
}: HoldDraggableProps) {
  const previewNode = typeof children === 'function' ? undefined : (preview ?? children);

  const drag = useDraggable({
    behavior,
    cursorMode,
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
    trackPhase: true,
    transports,
  });

  useImperativeHandle(ref, () => drag.handle, [drag.handle]);

  const state: HoldableState = { isHeld: drag.isHeld, isPressed: drag.isActive, phase: drag.phase };
  const resolvedChildren = typeof children === 'function' ? children(state) : children;
  const resolvedPreview = typeof children === 'function' ? (preview ?? resolvedChildren) : previewNode;

  // Keep the session's previewRef in sync so the DragManager ghost shows what this
  // component renders right now — both branches (render-prop and plain children).
  drag.previewRef.current = resolvedPreview;

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
      {resolvedChildren}
      {drag.showGhost ? (
        <Animated.View {...drag.getGhostProps()} className={GHOST_CLASS}>
          {resolvedPreview}
        </Animated.View>
      ) : null}
    </View>
  );

  return drag.gesture === null ? host : <GestureDetector gesture={drag.gesture}>{host}</GestureDetector>;
}
