import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent, ViewProps } from 'react-native';
import { View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { AnimatePresence } from '../../moti/presence/animate-presence';
import { usePresenceContext } from '../../moti/presence/animate-presence-context';

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

  const isMeasured = useRef(false);

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

  const onContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      if (height <= 0 || !isPresentRef.current) return;

      const dur = (full: number) => (reduced ? 80 : full);
      const easeOut = reduced ? Easing.linear : EASE_OUT;

      if (isMeasured.current) {
        // Content changed height (expand / collapse)
        containerHeight.value = withTiming(height, { duration: dur(260), easing: easeOut });
      } else {
        // First measurement — animate the item into view
        isMeasured.current = true;
        containerHeight.value = withTiming(height, { duration: dur(280), easing: easeOut });
        opacity.value = withTiming(1, { duration: dur(240), easing: easeOut });
        translateY.value = withTiming(0, { duration: dur(280), easing: easeOut });
        scale.value = withTiming(1, { duration: dur(280), easing: easeOut });
      }
    },
    [containerHeight, opacity, translateY, scale, reduced],
  );

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
