// The manager's ghost layer.
//
// Why a manager draws the ghost at all: a `<Draggable>` draws its own inside
// itself, which is the right default and wrong the moment the source sits in
// anything that clips — a scroll view, a card with `overflow: hidden`, a list row.
// The ghost is then cut off at the very edge the drag is trying to cross. Hoisting
// it to a manager puts it in a frame that contains the whole board instead.
//
// Positioning is a single `ValueXY` driven from the store's move channel, so the
// pointer stream never reaches React: this component re-renders when a drag starts
// and when it ends, and in between the ghost moves on the animated value alone.

import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import type { DragPoint, DragRect } from '../drag.types';
import { ghostOffset } from '../drag-geometry';
import { DragGhost } from '../drag-ghost';
import { getDragPoint, getDragSnapshot } from '../drag-store';
import { useActiveDrag, useDragMove, useDragPreview } from '../use-drag-store';

export type DragManagerOverlayProps = {
  /** This manager's own id — it draws only the previews addressed to it. */
  hostId: string;
  /**
   * Re-reads the manager's own window box now. Called at lift: the box `rectRef`
   * holds is from the manager's last layout, and a page scroll since then leaves
   * it stale while the pointer is fresh.
   */
  measure: () => Promise<DragRect | null>;
  /**
   * The manager's window rect, live off a ref rather than passed by value: the
   * ghost has to be placed on the frame the lift happened on, and a prop would be
   * one render behind.
   */
  rectRef: RefObject<DragRect | null>;
};

/**
 * Draws the ghost for drags lifted under this manager, in the manager's own frame.
 *
 * Renders nothing at all unless the store has a preview addressed to this host,
 * which is the case only for a pan-driven drag — under the HTML5 transport the
 * browser makes its own drag image and a second one would double it.
 */
export function DragManagerOverlay({ hostId, measure, rectRef }: DragManagerOverlayProps) {
  // Both on the lifecycle channel: the ghost is fixed at the lift and cleared at the
  // release, so reading them off the whole snapshot re-rendered this overlay on every
  // zone crossing only to learn that neither had changed.
  const drag = useActiveDrag();
  const preview = useDragPreview();
  const pos = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [settling, setSettling] = useState(false);

  // Cache the last drag & its preview so the ghost can fade out after the store
  // has already cleared them. Both are cached together, and only while a drag is
  // live: a drag that carries no preview for this host — an HTML5 chip lifted
  // outside this manager — must clear the stale preview, or its drop would briefly
  // re-show the ghost of the previous drag during the fade-out.
  const lastDragRef = useRef(drag);
  const lastPreviewRef = useRef(preview);
  if (drag !== null) {
    lastDragRef.current = drag;
    lastPreviewRef.current = preview;
  }

  const prevDragRef = useRef<typeof drag>(null);

  // When the drag transitions from active to null, fade out the ghost instead
  // of hiding it instantly — the ghost smoothly settles into the item's new position.
  // biome-ignore lint/plugin: subscribing to drag-store transitions across renders
  useEffect(() => {
    const wasDragging = prevDragRef.current !== null;
    const isDragging = drag !== null;
    prevDragRef.current = drag;

    if (wasDragging && !isDragging) {
      setSettling(true);
      opacity.setValue(1);
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => setSettling(false));
    } else if (isDragging) {
      setSettling(false);
      opacity.setValue(1);
    }
  }, [drag, opacity]);

  // Use the cached values during settle so the ghost renders until fade-out ends.
  const active = settling ? lastDragRef.current : drag;
  const activePreview = settling ? lastPreviewRef.current : preview;
  const mine = activePreview !== null && activePreview.hostId === hostId;

  const place = useCallback(
    (point: DragPoint) => {
      const activeDrag = getDragSnapshot().drag;
      if (activeDrag === null) return;
      const frame = rectRef.current ?? { x: 0, y: 0, height: 0, width: 0 };
      if (activeDrag.transport === 'html5') {
        // Under HTML5 the browser positions its native drag image with the
        // top-left corner at the cursor.  When we hide that image and draw our
        // own overlay ghost, we match the browser's vertical placement (top at
        // cursor y) but anchor horizontally to the source's left edge — so the
        // ghost stays aligned with the div the user lifted rather than jumping
        // to wherever inside it the cursor happened to land.
        const sourceX = activeDrag.origin.rect?.x ?? activeDrag.origin.grab.x;
        pos.setValue({ x: sourceX - frame.x + (point.x - activeDrag.origin.grab.x), y: point.y - frame.y });
      } else
        pos.setValue(ghostOffset({ grab: activeDrag.origin.grab, host: rectRef.current, origin: activeDrag.origin.rect, point }));
    },
    [pos, rectRef],
  );

  useDragMove(place);

  // The lift itself produces no move event, so without this the ghost would spend
  // its first frame at the manager's top-left corner and snap into place on the
  // next pointer sample. `useLayoutEffect` runs synchronously after mutations but
  // before the screen paints, so the ghost lands at the right spot on its very
  // first frame instead of flickering at (0,0).
  useLayoutEffect(() => {
    if (!mine) return;
    const point = getDragPoint() ?? drag?.origin.grab ?? { x: 0, y: 0 };
    place(point);
    // Re-anchor the host's own frame, the way the source re-anchors its rect at
    // lift: `rectRef` is from the manager's last layout, and a scroll since then
    // leaves it stale while `point` is fresh. Re-place once it lands — the lift
    // produces no move, so without this the ghost would hold the stale offset
    // until the pointer next moves (or forever, if the pointer stays still).
    measure()
      .then((rect) => {
        if (rect === null) return;
        rectRef.current = rect;
        place(getDragPoint() ?? point);
      })
      .catch(() => undefined);
  }, [drag, mine, measure, place, rectRef]);

  if (!(mine && activePreview !== null && active !== null)) return null;

  return (
    <Animated.View className="pointer-events-none absolute inset-0 z-50" pointerEvents="none" style={{ opacity }}>
      <DragGhost pos={pos} size={active.origin.rect}>
        {activePreview.node}
      </DragGhost>
    </Animated.View>
  );
}
