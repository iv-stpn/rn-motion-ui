import { MotiView } from '@rn-motion-ui/moti/view';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

// Smooth glide for thumb/fill — critically damped, no overshoot (web SPRING_GLIDE).
const SPRING_GLIDE = { type: 'spring' as const, stiffness: 700, damping: 50, mass: 0.5 };
// Bouncy grab feedback for the thumb scale only (web SPRING_BOUNCY).
const SPRING_BOUNCY = { type: 'spring' as const, stiffness: 500, damping: 14, mass: 0.7 };

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
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
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
  style,
  accessibilityLabel,
  testID,
}: RangeSliderProps) {
  const reduce = useReducedMotion();
  const [internal, setInternal] = useState(defaultValue);
  const [active, setActive] = useState(false);
  const [trackW, setTrackW] = useState(0);
  const trackWRef = useRef(0);

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
      return min + clamp(x / w, 0, 1) * (max - min);
    },
    [current, min, max],
  );

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWRef.current = w;
    setTrackW(w);
  }, []);

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

  // Contain the thumb fully inside the track at both ends by mapping the ratio
  // across [0, trackW - THUMB_W] rather than the raw width — no clip, no gap.
  const glide = reduce ? { type: 'timing' as const, duration: 0 } : SPRING_GLIDE;
  const fillW = ratio * trackW;
  const thumbX = ratio * Math.max(trackW - THUMB_W, 0);

  return (
    <View
      {...responder.panHandlers}
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      aria-disabled={disabled}
      accessibilityValue={{ min, max, now: current }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      testID={testID ?? 'range-slider'}
      className="relative h-10 w-full flex-row items-center overflow-hidden rounded-lg bg-muted"
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
    >
      {/* fill — from the left edge to the thumb */}
      <MotiView
        pointerEvents="none"
        className="absolute top-0 bottom-0 left-0 bg-foreground/15"
        animate={{ width: fillW }}
        transition={glide}
      />

      {/* ticks — slight inset so the end dots don't clip */}
      <View pointerEvents="none" className="absolute top-0 right-2 bottom-0 left-2">
        {ticks.map((t) => {
          const tp = max > min ? ((t - min) / (max - min)) * 100 : 0;
          return (
            <View
              key={t}
              className="absolute top-1/2 h-1 w-1 rounded-full bg-foreground/25"
              style={{ left: `${tp}%`, marginLeft: -2, marginTop: -2 }}
            />
          );
        })}
      </View>

      {/* vertical bar thumb — contained at both ends via thumbX */}
      <MotiView
        pointerEvents="none"
        className="absolute h-5 rounded-sm bg-foreground"
        animate={{ translateX: thumbX, scaleY: active && !reduce ? 1.35 : 1 }}
        transition={{ translateX: glide, scaleY: SPRING_BOUNCY }}
        style={{ left: 0, width: THUMB_W, top: 10 }}
      />
    </View>
  );
}
