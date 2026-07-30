import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { type Direction, useIsRTL } from '../../hooks/use-direction';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';

// Smooth glide for thumb/fill — critically damped, no overshoot (web SPRING_GLIDE).
const SPRING_GLIDE = { stiffness: 700, damping: 50, mass: 0.5 };
// Bouncy grab feedback for the thumb scale only (web SPRING_BOUNCY).
const SPRING_BOUNCY = { stiffness: 500, damping: 14, mass: 0.7 };

const THUMB_W = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type RangeSliderProps = {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Render a tick dot at each step. */
  showTicks?: boolean;
  disabled?: boolean;
  /** Additional NativeWind class names merged onto the track. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /**
   * Overrides the ambient writing direction, which decides which end of the
   * track holds `min`. Under RTL the slider mirrors — minimum on the right,
   * filling leftwards — the way a native slider does in an RTL locale.
   *
   * Set this to `'ltr'` to opt out: a track whose axis is a *thing* rather than
   * a quantity (a timeline, a waveform, a left-to-right seek bar) should not
   * flip just because the surrounding prose did.
   */
  writingDirection?: Direction;
  testID?: string;
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: dual-thumb gesture math and clamping logic cannot be split without passing excess refs
export function RangeSlider({
  value,
  defaultValue = 0,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  showTicks = true,
  disabled = false,
  className,
  style,
  accessibilityLabel,
  writingDirection,
  testID,
}: RangeSliderProps) {
  const reduce = useReducedMotion();
  // Nothing about this component self-corrects under RTL the way a measured
  // layout does: every anchor is a physical edge and `locationX` is always the
  // distance from the physical left of the track, so the mirroring is explicit.
  const isRTL = useIsRTL(writingDirection);
  const [internal, setInternal] = useState(defaultValue);
  const [active, setActive] = useState(false);
  const trackW = useSharedValue(0);
  const trackWRef = useRef(0);
  const isLayoutDone = useSharedValue(false);

  const controlled = value !== undefined;
  const current = clamp(controlled ? value : internal, min, max);
  const ratio = max > min ? (current - min) / (max - min) : 0;

  const steps = Math.floor((max - min) / step);
  const ticks = useMemo(
    () => (showTicks && steps > 0 && steps <= 50 ? Array.from({ length: steps + 1 }, (_, i) => min + i * step) : []),
    [showTicks, steps, min, step],
  );

  const commit = useCallback(
    (next: number) => {
      const snapped = clamp(Math.round((next - min) / step) * step + min, min, max);
      if (!controlled) setInternal(snapped);
      onValueChange?.(snapped);
    },
    [controlled, onValueChange, min, max, step],
  );

  const valueFromX = useCallback(
    (x: number) => {
      const w = trackWRef.current;
      if (!w) return current;
      // `locationX` is measured from the physical left edge on both platforms,
      // so under RTL — where the left edge is the *maximum* — the fraction is
      // taken from the other end.
      const fraction = clamp(x / w, 0, 1);
      return min + (isRTL ? 1 - fraction : fraction) * (max - min);
    },
    [current, min, max, isRTL],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      trackWRef.current = w;
      trackW.value = w;
      isLayoutDone.value = true;
    },
    [trackW, isLayoutDone],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          if (disabled) return;
          setActive(true);
          commit(valueFromX(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          if (disabled) return;
          commit(valueFromX(e.nativeEvent.locationX));
        },
        onPanResponderRelease: () => setActive(false),
        onPanResponderTerminate: () => setActive(false),
      }),
    [disabled, commit, valueFromX],
  );

  const onAccessibilityAction = useCallback(
    (e: AccessibilityActionEvent) => {
      if (disabled) return;
      if (e.nativeEvent.actionName === 'increment') commit(current + step);
      else if (e.nativeEvent.actionName === 'decrement') commit(current - step);
    },
    [disabled, current, step, commit],
  );

  // One spring-smoothed ratio drives both fill and thumb (the web `smooth` motion
  // value) so they move frame-locked as a single unit — two independent springs
  // over different distances would stagger.
  // Initialized to the correct ratio so there's no spring animation on mount.
  const smooth = useSharedValue(ratio);
  // biome-ignore lint/plugin: syncing an externally-controlled ratio to an Animated shared value requires a side effect
  useEffect(() => {
    smooth.value = reduce ? ratio : withSpring(ratio, SPRING_GLIDE);
  }, [ratio, reduce, smooth]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: smooth.value }] }));
  // Contain the thumb fully inside the track at both ends by mapping the ratio
  // across [0, trackW - THUMB_W] rather than the raw width — no clip, no gap.
  // Thumb is invisible until onLayout provides trackW, preventing a flash at x=0.
  const thumbStyle = useAnimatedStyle(() => {
    // The thumb is anchored to the physical left in both directions and moved by
    // a positive offset; under RTL it is the *complement* of the ratio, so the
    // minimum parks it at the right-hand end.
    const travel = (isRTL ? 1 - smooth.value : smooth.value) * Math.max(trackW.value - THUMB_W, 0);
    return {
      opacity: isLayoutDone.value ? 1 : 0,
      transform: [{ translateX: travel }, { scaleY: withSpring(active && !reduce ? 1.35 : 1, SPRING_BOUNCY) }],
    };
  });

  return (
    <View
      {...responder.panHandlers}
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      aria-disabled={disabled}
      // Both spellings on purpose: react-native-web does not understand React
      // Native's nested `accessibilityValue` object, only the flat `aria-value*`
      // props, so on web the slider was announced without any value at all.
      accessibilityValue={{ min, max, now: current }}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={current}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      testID={testID ?? 'range-slider'}
      className={cn('relative h-10 w-full flex-row items-center overflow-hidden rounded-lg bg-muted', className)}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
    >
      {/* fill — from the minimum end of the track to the thumb. The box is
          full-width either way; `transformOrigin` is what decides which end it
          grows from, so it is the only thing direction changes here. */}
      <Animated.View
        className="absolute top-0 bottom-0 left-0 w-full bg-foreground/15"
        style={[{ pointerEvents: 'none', transformOrigin: isRTL ? 'right' : 'left' }, fillStyle]}
      />

      {/* ticks — slight inset so the end dots don't clip */}
      <View className="pointer-events-none absolute top-0 right-2 bottom-0 left-2">
        {ticks.map((t) => {
          const tp = max > min ? ((t - min) / (max - min)) * 100 : 0;
          // Evenly spaced ticks look identical mirrored, but they are not always
          // even: `steps` floors, so a range that does not divide by `step`
          // leaves a gap at the top end — which belongs on the correct side.
          return (
            <View
              key={t}
              className="absolute top-1/2 h-1 w-1 rounded-full bg-foreground/25"
              style={{ left: `${isRTL ? 100 - tp : tp}%`, marginLeft: -2, marginTop: -2 }}
            />
          );
        })}
      </View>

      {/* vertical bar thumb — contained at both ends via the [0, trackW - THUMB_W] mapping */}
      <Animated.View
        className="absolute h-5 rounded-sm bg-foreground"
        style={[{ pointerEvents: 'none', left: 0, width: THUMB_W, top: 10 }, thumbStyle]}
      />
    </View>
  );
}
