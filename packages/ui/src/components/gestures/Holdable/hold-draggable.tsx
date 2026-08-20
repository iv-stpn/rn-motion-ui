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

import { type ReactNode, type Ref, useCallback, useImperativeHandle } from 'react';
import { Animated, View, type ViewProps, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { fireHapticFeedback } from '../../../lib/haptics';
import type { HapticFeedbackVariant } from '../../../lib/haptics-types';
import { type UseDraggableOptions, useDraggable } from '../Draggable/use-draggable';
import type { DraggableHandle } from '../drag.types';
import type { HoldableState } from './holdable';

/**
 * The ghost's cosmetics — matches `<Draggable>` so the two are interchangeable
 * from the drag manager's point of view.
 */
const GHOST_CLASS = 'z-50 opacity-80';

/** Rendered off-screen so it stays in the DOM for HTML5 `setDragImage` but the user never sees it. */
const OFFSCREEN_STYLE: ViewStyle = { left: 0, opacity: 0, pointerEvents: 'none', position: 'absolute', top: 0 };

export type HoldDraggableProps = Omit<ViewProps, 'children' | 'ref'> &
  Omit<UseDraggableOptions, 'trackPhase'> & {
    children?: ReactNode | ((state: HoldableState) => ReactNode);
    ref?: Ref<DraggableHandle>;
    /** Haptic feedback fired when the hold lands. `'None'` or omitted disables it. */
    hapticFeedback?: HapticFeedbackVariant;
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
  hapticFeedback,
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

  // The hold lands once — fire the haptic there, ahead of whatever the consumer's
  // `onHold` puts on screen, so the cue reads as the press, not as its result.
  const handleHold = useCallback(() => {
    if (hapticFeedback !== undefined && hapticFeedback !== 'None') fireHapticFeedback(hapticFeedback);
    onHold?.();
  }, [hapticFeedback, onHold]);

  // A hold exists only when something fires on it — the callback, or a haptic. Passing
  // `undefined` keeps `useDraggable`'s `hasHold` check honest (it nulls the hold
  // deadline otherwise).
  const holdCallback =
    onHold !== undefined || (hapticFeedback !== undefined && hapticFeedback !== 'None') ? handleHold : undefined;

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
    onHold: holdCallback,
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

  // The preview must stay in the DOM even when `showGhost` is false: the HTML5
  // transport reads it for `setDragImage`. When true the ghost follows the pointer;
  // otherwise it sits offscreen.
  const drawsPreview = drag.showGhost || preview !== undefined;

  const root = drag.getRootProps();
  const host = (
    <View
      ref={root.ref}
      className={className}
      collapsable={false}
      onLayout={root.onLayout}
      style={[root.style, style]}
      testID={testID}
      {...viewProps}
    >
      {resolvedChildren}
      {drawsPreview ? (
        <Animated.View
          ref={drag.previewElementRef}
          {...drag.getGhostProps()}
          className={drag.showGhost ? GHOST_CLASS : undefined}
          style={drag.showGhost ? drag.getGhostProps().style : OFFSCREEN_STYLE}
        >
          {resolvedPreview}
        </Animated.View>
      ) : null}
    </View>
  );

  // `collapsable={false}` on the host matches `<Draggable>`: a flattened host on
  // Android strands the pan on a view the renderer removed, and the enclosing
  // ScrollView swallows the drag. The detector wraps the host directly here (there
  // is no handle/provider in the way), but pinning it keeps the gesture attached
  // to a view that is guaranteed to stay in the native hierarchy.
  return drag.gesture === null ? host : <GestureDetector gesture={drag.gesture}>{host}</GestureDetector>;
}
