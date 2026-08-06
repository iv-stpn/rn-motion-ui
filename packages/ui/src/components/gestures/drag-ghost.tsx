// The lifted copy of the dragged child, following the pointer.
//
// Shared because two different components draw it, for the same reason in two
// coordinate systems: a `<DragManager>` draws it in its own frame (so the ghost
// escapes clipping ancestors and sits above everything), and a `<Draggable>` with
// no manager above it draws it in its own. Both express position as a translate
// off the top-left corner, so one component covers both — only the values differ.
//
// Never drawn under the HTML5 transport: the browser makes its own drag image
// there, and a second one would double it.

import type { ReactNode } from 'react';
import { Animated } from 'react-native';
import type { DragRect } from './drag.types';

export type DragGhostProps = {
  children: ReactNode;
  pos: Animated.ValueXY;
  /**
   * Pin the ghost to the source's measured size. Worth passing when the ghost is
   * drawn by a manager: lifted out of its original parent, the preview no longer
   * inherits the width that parent gave it, and an unconstrained one would
   * re-lay-out to its content the instant it lifted.
   */
  size?: Pick<DragRect, 'height' | 'width'> | null;
};

export function DragGhost({ children, pos, size = null }: DragGhostProps) {
  const bounds = size === null ? null : { height: size.height, width: size.width };
  return (
    <Animated.View
      className="pointer-events-none absolute top-0 left-0 z-50 opacity-80"
      style={[{ transform: pos.getTranslateTransform() }, bounds]}
    >
      {children}
    </Animated.View>
  );
}
