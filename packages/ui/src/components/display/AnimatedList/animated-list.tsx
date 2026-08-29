import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, ViewProps } from 'react-native';
import { View } from 'react-native';
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { usePresenceContext } from '../../../moti/presence/animate-presence-context';

// Bottom gap is internal to each item so it collapses with the item on exit.
// Callers should NOT add gap/margin to AnimatedList itself.

// Easings
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1); // fast start, smooth landing
const EASE_IN = Easing.bezier(0.4, 0, 1, 1); // slow start, sharp end

// Fabric-safe layout transitions for the item height. On the new architecture an
// animated `height` (via useAnimatedStyle) is dropped by Yoga and the item
// collapses to 0, so the height stays static and its change rides `layout` instead.
const ITEM_LAYOUT = LinearTransition.duration(280).easing(EASE_OUT);
const ITEM_EXIT_LAYOUT = LinearTransition.duration(240).easing(EASE_IN);

/** The Fabric-safe layout transition for the current phase; undefined snaps under reduced motion. */
function itemLayout(reduced: boolean, isPresent: boolean) {
  if (reduced) return;
  return isPresent ? ITEM_LAYOUT : ITEM_EXIT_LAYOUT;
}

export type AnimatedListProps = PropsWithChildren<ViewProps>;

/**
 * Wraps `AnimatedListItem` children in an `AnimatePresence` context.
 * Do NOT add gap/margin here — spacing between items is handled internally
 * by each `AnimatedListItem` so it can collapse smoothly with the item.
 *
 * **Accessibility:** the list adds no semantics of its own — it is a layout and
 * animation wrapper, and the roles belong on whatever you render inside each
 * item. Two things are worth knowing when items come and go:
 *
 * - *Focus.* An item stays mounted through its exit animation and unmounts
 *   afterwards. If focus was inside it — the row's own delete button is the
 *   usual case — it is lost at unmount and returns to the document body, which
 *   on web sends a keyboard user back to the top of the page. Move focus
 *   somewhere deliberate (the next row, or the control that triggered the
 *   removal) in the same handler that removes the item.
 * - *Announcements.* Additions and removals are silent. If the change is the
 *   result of something the user did elsewhere, mark the list region
 *   `accessibilityLiveRegion="polite"` (or announce the outcome yourself) so it
 *   is not a purely visual event.
 */
export function AnimatedList({ children, ...props }: AnimatedListProps) {
  return (
    <View {...props}>
      <AnimatePresence>{children}</AnimatePresence>
    </View>
  );
}

export type AnimatedListItemProps = PropsWithChildren;

/**
 * Two-layer animated list item:
 *  - Outer Animated.View: holds the item height (0 → content → 0). The height is
 *    a static style whose change rides a `layout` transition, so siblings reflow
 *    naturally as it grows/shrinks — animating `height` through `useAnimatedStyle`
 *    is dropped by Yoga on Fabric and the item collapses to nothing.
 *  - Inner Animated.View: visual polish (opacity, translateY, scale), laid out
 *    absolutely so `onLayout` can measure it even while the outer is collapsed.
 *
 * Also handles card grow/collapse automatically: when inner content changes
 * height (e.g. subtasks expand), `onLayout` fires and the outer height follows
 * via the layout transition, pushing siblings out of the way.
 *
 * Give each item a stable `key` inside `AnimatedList`.
 */
export function AnimatedListItem({ children }: AnimatedListItemProps) {
  const [isPresent, safeToUnmount] = usePresenceContext();
  const reduced = useReducedMotion();

  // Keep latest safeToUnmount in a ref — it changes identity each render
  const safeToUnmountRef = useRef(safeToUnmount);
  safeToUnmountRef.current = safeToUnmount;

  // Keep latest isPresent in a ref for use inside onLayout callback
  const isPresentRef = useRef(isPresent);
  isPresentRef.current = isPresent;

  // Natural content height from the latest layout pass. The item's height is a
  // *static* style driven by this state — not an animated `height` — because an
  // animated height is dropped by Yoga on Fabric and the item collapses to 0.
  const [contentHeight, setContentHeight] = useState(0);
  const hasEntered = useRef(false);

  // Visual polish (opacity, translateY, scale) — style props, safe on Fabric.
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-10);
  const scale = useSharedValue(0.97);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  // biome-ignore lint/correctness/useExhaustiveDependencies: shared values are stable references; safeToUnmount captured via ref
  // biome-ignore lint/plugin: exit animation must fire the moment isPresent flips false — not derivable from render state, not mount-only (useMountEffect doesn't apply)
  useEffect(() => {
    if (!isPresent) {
      const dur = (full: number) => (reduced ? 80 : full);
      const easeIn = reduced ? Easing.linear : EASE_IN;
      // Visual exit: fade + drop (inspired by framer-motion recipe's y:8 on exit).
      // Positive translateY (downward) is safe under overflow:hidden — content
      // sinks into the shrinking container and is clipped from below. Only a
      // negative (upward) translation would escape above the container's top edge.
      // The height collapse rides the `layout` transition (no completion
      // callback), so release the item on a timer matched to its duration.
      opacity.value = withTiming(0, { duration: dur(220), easing: easeIn });
      scale.value = withTiming(0.97, { duration: dur(220) });
      translateY.value = withTiming(8, { duration: dur(220), easing: easeIn });
      const id = setTimeout(() => {
        const done = safeToUnmountRef.current;
        if (done) done();
      }, dur(240));
      return () => clearTimeout(id);
    }
  }, [isPresent, reduced]);

  // Enter polish: the first layout pass reports a height, then fade/settle in.
  // The height grow itself rides the `layout` transition (a static-style change),
  // so this effect only drives the style props that pair with it.
  // biome-ignore lint/plugin: enter polish is an imperative side effect on shared values, fired when the measured height first lands — not derivable from render state, not mount-only (useMountEffect doesn't apply)
  useEffect(() => {
    if (contentHeight <= 0 || !isPresent || hasEntered.current) return;
    hasEntered.current = true;

    const dur = (full: number) => (reduced ? 80 : full);
    const easeOut = reduced ? Easing.linear : EASE_OUT;
    opacity.value = withTiming(1, { duration: dur(240), easing: easeOut });
    translateY.value = withTiming(0, { duration: dur(280), easing: easeOut });
    scale.value = withTiming(1, { duration: dur(280), easing: easeOut });
  }, [contentHeight, isPresent, reduced, opacity, translateY, scale]);

  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height <= 0 || !isPresentRef.current) return;
    setContentHeight(height);
  }, []);

  // Present and measured → full height; entering or exiting → 0.
  const height = isPresent && contentHeight > 0 ? contentHeight : 0;

  return (
    <Animated.View layout={itemLayout(reduced, isPresent)} className="overflow-hidden" style={{ height }}>
      {/*
       * Absolute so the content is laid out (and measured) independently of the
       * outer height. A normal-flow child inside a height-0 container reports 0
       * on Android, which is how the list rendered empty.
       */}
      <Animated.View onLayout={onContentLayout} style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, contentStyle]}>
        {/* pb-3 (12px) so the gap collapses with the item */}
        <View className="pb-3">{children}</View>
      </Animated.View>
    </Animated.View>
  );
}
