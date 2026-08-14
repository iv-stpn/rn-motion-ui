/**
 * Visual height animation wrapper for file-system rows in both list and columns
 * views. The FlatList's `getItemLayout` always allocates the full row height for
 * every row (current or exiting), so siblings never reflow — this component
 * animates the content inside that fixed slot.
 *
 * Pattern mirrors `AnimatedListItem` (see packages/ui/src/components/display/
 * AnimatedList/animated-list.tsx) but adapted for fixed-height rows where the
 * layout slot is managed by the FlatList rather than the component itself.
 */

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../../../../hooks/use-reduced-motion';

// Mirrors EASE_OUT / EASE_IN from AnimatedList (same bezier constants).
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1); // fast start, smooth landing
const EASE_IN = Easing.bezier(0.4, 0, 1, 1); // slow start, sharp end

export type FileSystemAnimatedRowProps = {
  children: ReactNode;
  /** The row's full layout height (FS_ROW_HEIGHT or COLUMN_ROW_HEIGHT). */
  height: number;
  /** `true` when this row just appeared — animates height 0 → full. */
  isEntering: boolean;
  /** `true` when this row is about to be removed — animates height full → 0. */
  isExiting: boolean;
  /** Called when the exit animation completes so the row can be dropped from data. */
  onExitComplete: () => void;
};

/**
 * Wraps a file-system row in enter/exit height animations.
 *
 * The outer `View` has `overflow: hidden` — it clips the animating content so the
 * row appears to grow/shrink within its fixed layout slot. The `getItemLayout` and
 * hover/marquee geometry remain unchanged because every row's slot is always the
 * full `height`.
 */
export function FileSystemAnimatedRow({ children, height, isEntering, isExiting, onExitComplete }: FileSystemAnimatedRowProps) {
  const reduce = useReducedMotion();

  const containerHeight = useSharedValue(isEntering ? 0 : height);
  const opacity = useSharedValue(isEntering ? 0 : 1);

  // Keep latest onExitComplete in a ref so the animation callback doesn't stale.
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;

  const containerStyle = useAnimatedStyle(() => ({ height: containerHeight.value }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Enter: animate height 0 → full. Driven by `isEntering` rather than a first-layout
  // callback. On native, `onLayout` on the inner content can fire in the same commit
  // that first applies the animated zero height — before Reanimated has registered the
  // shared value's starting point — and the `withTiming` that follows starts from the
  // full height instead of zero, so the row lands already-open with no animation.
  // A `useEffect` runs after that commit, so the timing always starts from zero.
  // biome-ignore lint/correctness/useExhaustiveDependencies: shared values are stable references; height is constant per row
  // biome-ignore lint/plugin: enter animation must fire the moment isEntering is true — not derivable from render state
  useEffect(() => {
    if (!isEntering) return;
    const dur = (full: number) => (reduce ? 80 : full);
    const easeOut = reduce ? Easing.linear : EASE_OUT;
    containerHeight.value = withTiming(height, { duration: dur(280), easing: easeOut });
    opacity.value = withTiming(1, { duration: dur(240), easing: easeOut });
  }, [isEntering, reduce]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: shared values are stable references; onExitComplete captured via ref
  // biome-ignore lint/plugin: exit animation must fire the moment isExiting flips true — not derivable from render state
  useEffect(() => {
    if (isExiting) {
      const dur = (full: number) => (reduce ? 80 : full);
      const easeIn = reduce ? Easing.linear : EASE_IN;
      containerHeight.value = withTiming(0, { duration: dur(240), easing: easeIn }, (finished) => {
        if (!finished) return;
        runOnJS(onExitCompleteRef.current)();
      });
      opacity.value = withTiming(0, { duration: dur(200), easing: easeIn });
    }
  }, [isExiting, reduce]);

  return (
    <Animated.View className="overflow-hidden" style={containerStyle}>
      <Animated.View style={contentStyle}>{children}</Animated.View>
    </Animated.View>
  );
}
