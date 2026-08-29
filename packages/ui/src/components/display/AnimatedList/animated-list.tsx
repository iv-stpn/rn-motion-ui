import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, ViewProps } from 'react-native';
import { View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { usePresenceContext } from '../../../moti/presence/animate-presence-context';

// Bottom gap is internal to each item so it collapses with the item on exit.
// Callers should NOT add gap/margin to AnimatedList itself.

// Easings
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1); // fast start, smooth landing
const EASE_IN = Easing.bezier(0.4, 0, 1, 1); // slow start, sharp end

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
 *  - Outer Animated.View: animates `height` 0 → content → 0.
 *    This is what drives layout reflow for siblings — no Reanimated `layout`
 *    prop needed; siblings move naturally as the height changes.
 *  - Inner Animated.View: visual polish (opacity, translateY, scale).
 *
 * Also handles card grow/collapse automatically: when inner content changes
 * height (e.g. subtasks expand), `onLayout` fires and `containerHeight`
 * springs to the new value, pushing siblings out of the way.
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

  // Outer: height controls how much layout space the item occupies
  const containerHeight = useSharedValue(0);

  // Inner: visual style
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-10);
  const scale = useSharedValue(0.97);

  // Natural content height from the latest layout pass. `onLayout` only records
  // it; the tween below consumes it post-commit (see FileSystemAnimatedRow).
  const [contentHeight, setContentHeight] = useState(0);
  const hasEntered = useRef(false);

  const containerStyle = useAnimatedStyle(() => ({
    height: containerHeight.value,
  }));

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
      // Height collapse drives the sibling reflow — runs slightly longer so
      // the space is fully gone before unmount.
      containerHeight.value = withTiming(0, { duration: dur(240), easing: easeIn }, (finished) => {
        // safeToUnmount is null while the item is still present; read via ref
        // so the latest bound callback fires once the collapse completes.
        if (!finished) return;
        const done = safeToUnmountRef.current;
        if (done) runOnJS(done)();
      });
      // Visual exit: fade + drop (inspired by framer-motion recipe's y:8 on exit).
      // Positive translateY (downward) is safe under overflow:hidden — content
      // sinks into the shrinking container and is clipped from below. Only a
      // negative (upward) translation would escape above the container's top edge.
      opacity.value = withTiming(0, { duration: dur(220), easing: easeIn });
      scale.value = withTiming(0.97, { duration: dur(220) });
      translateY.value = withTiming(8, { duration: dur(220), easing: easeIn });
    }
  }, [isPresent, reduced]);

  // Enter + expand/collapse, driven from a post-commit effect rather than the
  // `onLayout` callback. On native `onLayout` can fire in the same commit that
  // first applies the animated zero height — before Reanimated has registered the
  // shared value's starting point — so a `withTiming` issued inside the callback
  // starts from the full height instead of zero and the item lands already-open
  // with no animation. A `useEffect` runs after that commit, so the timing always
  // starts from the shared value's real current value.
  // biome-ignore lint/plugin: enter animation is an imperative side effect on shared values, fired when the measured height or presence changes — not derivable from render state, not mount-only (useMountEffect doesn't apply)
  useEffect(() => {
    if (contentHeight <= 0 || !isPresent) return;

    const dur = (full: number) => (reduced ? 80 : full);
    const easeOut = reduced ? Easing.linear : EASE_OUT;

    if (hasEntered.current) {
      // Content changed height (expand / collapse)
      containerHeight.value = withTiming(contentHeight, { duration: dur(260), easing: easeOut });
    } else {
      // First measurement — animate the item into view
      hasEntered.current = true;
      containerHeight.value = withTiming(contentHeight, { duration: dur(280), easing: easeOut });
      opacity.value = withTiming(1, { duration: dur(240), easing: easeOut });
      translateY.value = withTiming(0, { duration: dur(280), easing: easeOut });
      scale.value = withTiming(1, { duration: dur(280), easing: easeOut });
    }
  }, [contentHeight, isPresent, reduced, containerHeight, opacity, translateY, scale]);

  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height <= 0 || !isPresentRef.current) return;
    setContentHeight(height);
  }, []);

  return (
    <Animated.View className="overflow-hidden" style={containerStyle}>
      {/*
       * onLayout on this view reports the natural content height regardless of
       * the outer's height: 0, because RN's yoga computes child dimensions
       * independently of the parent's explicit height.
       */}
      <Animated.View onLayout={onContentLayout} style={contentStyle}>
        {/* pb-3 (12px) so the gap collapses with the item */}
        <View className="pb-3">{children}</View>
      </Animated.View>
    </Animated.View>
  );
}
