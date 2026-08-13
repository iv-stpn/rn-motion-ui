/**
 * Layout-transition wrapper for file-system grid tiles.
 *
 * The old wrapper animated a single tile's *width* (enter 0 → full, exit full →
 * 0), so only the added or removed tile moved and every other tile jumped when the
 * grid re-chunked. Reanimated layout transitions give the "in unison" reflow for
 * free: every tile carries a `layout` transition, so when a sibling is added or
 * removed each remaining tile slides to its new slot while the added tile fades in
 * and the removed one fades out.
 *
 * Enter/exit are a fade plus a slight scale, tuned to the old ~240 ms-in /
 * ~200 ms-out feel. `LinearTransition` slides position changes over ~250 ms so the
 * reflow reads as one shared motion rather than a snap.
 */

import type { ReactNode } from 'react';
import Animated, { Keyframe, LinearTransition } from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';

// Module-level builders so every tile gets a stable instance — Reanimated treats
// a changed builder as a changed animation and would restart it each render.
const TILE_ENTER = new Keyframe({
  from: { opacity: 0, transform: [{ scale: 0.9 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(240);

const TILE_EXIT = new Keyframe({
  from: { opacity: 1, transform: [{ scale: 1 }] },
  to: { opacity: 0, transform: [{ scale: 0.9 }] },
}).duration(200);

const TILE_LAYOUT = LinearTransition.duration(250);

export type FileSystemAnimatedTileProps = {
  children: ReactNode;
  /** `false` during wholesale swaps — initial mount, folder nav, a filter — no animation. */
  animated: boolean;
  /** The tile's natural width (from `gridMetrics`) — the flex-wrap slot must hold it. */
  width: number;
};

/**
 * Wraps a grid tile in a shared layout transition. The wrapper is the flex-wrap
 * item, pinned to `width`, so its content never collapses the row mid-animation;
 * `layout` slides it when a sibling enters or leaves, and `entering`/`exiting`
 * fade/scale the tile itself on mount/unmount.
 */
export function FileSystemAnimatedTile({ children, animated, width }: FileSystemAnimatedTileProps) {
  const reduce = useReducedMotion();
  const animate = animated && !reduce;

  return (
    <Animated.View
      className="overflow-hidden"
      entering={animate ? TILE_ENTER : undefined}
      exiting={animate ? TILE_EXIT : undefined}
      layout={animate ? TILE_LAYOUT : undefined}
      style={{ width }}
    >
      {children}
    </Animated.View>
  );
}
