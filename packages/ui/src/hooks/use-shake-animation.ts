import { useEffect } from 'react';
import { Animated } from 'react-native';

// Default 6-step shake (Input / OtpInput amplitude). Callers that need a
// different sequence define their own constant at module scope and pass it in.
const DEFAULT_STEPS = [-6, 6, -4, 4, -2, 0] as const;
const DEFAULT_DURATION_MS = 65;

type UseShakeAnimationOptions = {
  trigger: boolean;
  reduce: boolean;
  shakeX: Animated.Value;
  /** Travel distances in px; last entry should return to 0. Pass a module-level constant so the reference is stable. */
  steps?: readonly number[];
  /** Per-step duration in ms. */
  duration?: number;
};

/**
 * Runs an `Animated.sequence` horizontal shake on `shakeX` whenever `trigger`
 * flips to true (and `reduce` is false).
 */
export function useShakeAnimation({
  trigger,
  reduce,
  shakeX,
  steps = DEFAULT_STEPS,
  duration = DEFAULT_DURATION_MS,
}: UseShakeAnimationOptions): void {
  // biome-ignore lint/plugin: shake must fire imperatively when `trigger` changes — this is genuinely event-driven animation that can't be expressed as derived state
  useEffect(() => {
    if (reduce || !trigger) return;
    Animated.sequence(
      // steps is a stable module-level const at every call site, so the array
      // reference never changes between renders — no stale-closure risk.
      steps.map((toValue) => Animated.timing(shakeX, { toValue, duration, useNativeDriver: true })),
    ).start();
  }, [trigger, reduce, shakeX, steps, duration]);
}
