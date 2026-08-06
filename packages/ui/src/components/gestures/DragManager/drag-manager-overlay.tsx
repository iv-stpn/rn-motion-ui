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

import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import type { DragPoint, DragRect } from '../drag.types';
import { ghostOffset } from '../drag-geometry';
import { DragGhost } from '../drag-ghost';
import { getDragPoint, getDragSnapshot } from '../drag-store';
import { useDragMove, useDragSnapshot } from '../use-drag-store';

export type DragManagerOverlayProps = {
  /** This manager's own id — it draws only the previews addressed to it. */
  hostId: string;
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
export function DragManagerOverlay({ hostId, rectRef }: DragManagerOverlayProps) {
  const { drag, preview } = useDragSnapshot();
  const pos = useRef(new Animated.ValueXY()).current;
  const mine = preview !== null && preview.hostId === hostId;

  const place = useCallback(
    (point: DragPoint) => {
      const active = getDragSnapshot().drag;
      if (active === null) return;
      pos.setValue(ghostOffset({ grab: active.origin.grab, host: rectRef.current, origin: active.origin.rect, point }));
    },
    [pos, rectRef],
  );

  useDragMove(place);

  // The lift itself produces no move event, so without this the ghost would spend
  // its first frame at the manager's top-left corner and snap into place on the
  // next pointer sample.
  // biome-ignore lint/plugin: syncing an animated value to store state must run in an effect; no data-fetching or render-driving state
  useEffect(() => {
    if (!mine) return;
    place(getDragPoint() ?? drag?.origin.grab ?? { x: 0, y: 0 });
  }, [drag, mine, place]);

  if (!(mine && preview !== null && drag !== null)) return null;

  return (
    <View className="pointer-events-none absolute inset-0 z-50" pointerEvents="none">
      <DragGhost pos={pos} size={drag.origin.rect}>
        {preview.node}
      </DragGhost>
    </View>
  );
}
