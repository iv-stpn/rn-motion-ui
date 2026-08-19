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
 * Enter/exit are a fade, tuned to the old ~240 ms-in / ~200 ms-out feel.
 * `LinearTransition` slides position changes over ~250 ms so the reflow reads as
 * one shared motion rather than a snap.
 *
 * Enter/exit must stay *predefined* builders, never a custom `Keyframe`: on web
 * Reanimated's custom-keyframe cleanup (`scheduleAnimationCleanup`) re-homes the
 * entering node with `position: absolute` once the keyframe is retired, which
 * yanks it out of flex-wrap flow so the grid stops pushing the tiles behind it —
 * the added tile lands on top of its neighbour and later adds look like they never
 * arrive. Predefined `FadeIn`/`FadeOut` are keyframes Reanimated already knows, so
 * that cleanup path never runs.
 */

import type { ReactNode } from 'react';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useReducedMotion } from '../../../../hooks/use-reduced-motion';

// Module-level builders so every tile gets a stable instance — Reanimated treats
// a changed builder as a changed animation and would restart it each render.
const TILE_ENTER = FadeIn.duration(240);
const TILE_EXIT = FadeOut.duration(200);
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
 * fade the tile itself on mount/unmount.
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
