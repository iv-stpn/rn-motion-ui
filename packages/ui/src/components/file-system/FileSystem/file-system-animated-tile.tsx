/**
 * Width-based animation wrapper for file-system grid tiles.
 *
 * Pattern mirrors `FileSystemAnimatedRow` but animates the *width* of a tile
 * rather than a row's height: an entering tile expands from 0 to its natural
 * width, and an exiting tile collapses back to 0 before reporting completion.
 *
 * The outer `Animated.View` has `overflow: hidden` — it clips the content so
 * the tile appears to grow or shrink inside its flex-row slot. The inner View
 * always measures the full `tileWidth`, so sibling tiles never reflow.
 */

import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';

// Mirrors EASE_OUT / EASE_IN from FileSystemAnimatedRow (same bezier constants).
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1); // fast start, smooth landing
const EASE_IN = Easing.bezier(0.4, 0, 1, 1); // slow start, sharp end

export type FileSystemAnimatedTileProps = {
  children: ReactNode;
  /** The tile's natural width (from `gridMetrics`). */
  width: number;
  /** `true` when this tile just appeared — animates width 0 → full. */
  isEntering: boolean;
  /** `true` when this tile is about to be removed — animates width full → 0. */
  isExiting: boolean;
  /** Called when the exit animation completes so the entry can be dropped from data. */
  onExitComplete: () => void;
};

/**
 * Wraps a grid tile in enter/exit width animations.
 *
 * The row's `flex-row` layout gives each tile its intrinsic width; this wrapper
 * constrains the rendered width without changing the tile's measured width, so
 * sibling tiles hold their positions while one tile collapses or expands.
 */
export function FileSystemAnimatedTile({ children, width, isEntering, isExiting, onExitComplete }: FileSystemAnimatedTileProps) {
  const reduce = useReducedMotion();

  const containerWidth = useSharedValue(isEntering ? 0 : width);
  const opacity = useSharedValue(isEntering ? 0 : 1);

  // Keep latest onExitComplete in a ref so the animation callback doesn't stale.
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;

  const isMeasured = useRef(false);

  const containerStyle = useAnimatedStyle(() => ({
    width: containerWidth.value,
    overflow: 'hidden' as const,
  }));
  // The content always measures at the full tile width so Yoga doesn't collapse
  // it to zero — only the outer container clips.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    width,
  }));

  // biome-ignore lint/correctness/useExhaustiveDependencies: shared values are stable references; onExitComplete captured via ref
  // biome-ignore lint/plugin: exit animation must fire the moment isExiting flips true — not derivable from render state
  useEffect(() => {
    if (isExiting) {
      const dur = (full: number) => (reduce ? 80 : full);
      const easeIn = reduce ? Easing.linear : EASE_IN;
      containerWidth.value = withTiming(0, { duration: dur(240), easing: easeIn }, (finished) => {
        if (!finished) return;
        runOnJS(onExitCompleteRef.current)();
      });
      opacity.value = withTiming(0, { duration: dur(200), easing: easeIn });
    }
  }, [isExiting, reduce]);

  const onContentLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      // onLayout fires when the inner View renders at full width regardless of
      // the outer container's animated clip, so entering tiles always measure
      // their natural size.
      if (isMeasured.current) return;
      isMeasured.current = true;
      const dur = (full: number) => (reduce ? 80 : full);
      const easeOut = reduce ? Easing.linear : EASE_OUT;
      containerWidth.value = withTiming(width, { duration: dur(280), easing: easeOut });
      opacity.value = withTiming(1, { duration: dur(240), easing: easeOut });
    },
    [containerWidth, width, opacity, reduce],
  );

  return (
    <Animated.View style={containerStyle}>
      <Animated.View onLayout={onContentLayout} style={contentStyle}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}
