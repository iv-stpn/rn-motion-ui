/**
 * StarRating
 *
 * An animated star-rating input. Tapping commits a rating with a squash-and-
 * stretch pop and an amber sparkle burst; tapping the committed star clears it
 * (allowClear). An optional rolling value label tracks the current rating.
 * Works controlled or uncontrolled, supports fractional read-only display, and
 * honours prefers-reduced-motion. Exposes radiogroup / radio semantics with
 * increment / decrement accessibility actions.
 *
 * Dependencies: react-native-reanimated, react-native-svg
 */
/** biome-ignore-all lint/style/noExcessiveLinesPerFile: complex logic */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type AccessibilityActionEvent, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { SPRING_PRESS } from '../../lib/ease';
import { MotiView } from '../../moti/components/view';
import { AnimatePresence } from '../../moti/presence/animate-presence';

// ─── Types ───────────────────────────────────────────────────────────────────

// biome-ignore lint/style/useExportsLast: props type before internal constants — collocated for readability
export type StarRatingProps = {
  /** Controlled rating value. Leave undefined for uncontrolled usage. */
  value?: number;
  /** Initial rating when uncontrolled. Default 0 */
  defaultValue?: number;
  /** Fires with the next rating on every commit. */
  onValueChange?: (value: number) => void;
  /** Number of stars rendered. Default 5 */
  max?: number;
  /** Visual size of the stars. Default "md" */
  size?: 'sm' | 'md' | 'lg';
  /** Tapping the committed star clears the rating to 0. Default true */
  allowClear?: boolean;
  /** Display-only; supports fractional values like 4.3. Default false */
  readOnly?: boolean;
  /** Show a rolling "4 / 5" value label next to the stars. Default false */
  showValue?: boolean;
  /** Accessible name of the rating group. Default "Rating" */
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const SPARKLE_COUNT = 5;
const BURST_DURATION_MS = 500;

/** Snappy spring for star fills and press feedback. */
const FILL_SPRING = { type: 'spring' as const, stiffness: 500, damping: 30 };
/** Quick tween for un-fills so the amber overlay never overshoots back. */
const UNFILL_TIMING = { type: 'timing' as const, duration: 150 };
/** Spring for the rolling value-label digits. */
const VALUE_SPRING = { type: 'spring' as const, stiffness: 400, damping: 30 };

const SIZES = {
  sm: {
    icon: 16,
    pad: 'p-1',
    valueGap: 'ml-1.5',
    lineH: 16,
    valueLabel: 'text-xs font-medium tabular-nums text-neutral-500 dark:text-neutral-400',
  },
  md: {
    icon: 22,
    pad: 'p-0.5',
    valueGap: 'ml-2',
    lineH: 20,
    valueLabel: 'text-sm font-medium tabular-nums text-neutral-500 dark:text-neutral-400',
  },
  lg: {
    icon: 28,
    pad: 'p-0.5',
    valueGap: 'ml-2.5',
    lineH: 20,
    valueLabel: 'text-sm font-medium tabular-nums text-neutral-500 dark:text-neutral-400',
  },
} as const;

const STAR_PATH = 'M12 2L14.65 8.36L21.51 8.91L16.28 13.39L17.88 20.09L12 16.5L6.12 20.09L7.72 13.39L2.49 8.91L9.35 8.36Z';

const AMBER = '#fbbf24';
const MUTED_STAR = '#d1d5db';

// Pre-computed per-sparkle configs — angles are stable identifiers so the map
// never needs to touch the array index, keeping the key free of index values.
const SPARKLES = Array.from({ length: SPARKLE_COUNT }, (_, i) => {
  const angle = (i / SPARKLE_COUNT) * Math.PI * 2 - Math.PI / 2;
  return { angle, key: `a${angle.toFixed(4)}` };
});

function formatValue(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// ─── StarSvg ─────────────────────────────────────────────────────────────────

type StarSvgProps = { size: number; color: string; filled?: boolean };

export function StarSvg({ size, color, filled }: StarSvgProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={STAR_PATH}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── SparklesBurst ───────────────────────────────────────────────────────────

type SparklesBurstProps = { icon: number; burstKey: number };

export function SparklesBurst({ icon, burstKey }: SparklesBurstProps) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {SPARKLES.map(({ angle, key }) => {
        const dist = icon * 1.2;
        const dotSize = Math.max(2, Math.round(icon * 0.16));
        return (
          <MotiView
            key={`${burstKey}-${key}`}
            from={{ translateX: 0, translateY: 0, scale: 0, opacity: 1 }}
            animate={{ translateX: Math.cos(angle) * dist, translateY: Math.sin(angle) * dist, scale: 1, opacity: 0 }}
            transition={{ type: 'timing', duration: BURST_DURATION_MS }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: dotSize,
              height: dotSize,
              marginTop: -dotSize / 2,
              marginLeft: -dotSize / 2,
              borderRadius: dotSize / 2,
              backgroundColor: AMBER,
            }}
          />
        );
      })}
    </View>
  );
}

// ─── StarButton ──────────────────────────────────────────────────────────────

type StarButtonProps = {
  starValue: number;
  filled: boolean;
  isBursting: boolean;
  burstKey: number;
  isSelected: boolean;
  icon: number;
  padClass: string;
  reduce: boolean;
  onSelect: (starValue: number) => void;
};

export function StarButton({
  starValue,
  filled,
  isBursting,
  burstKey,
  isSelected,
  icon,
  padClass,
  reduce,
  onSelect,
}: StarButtonProps) {
  const [pressed, setPressed] = useState(false);
  const popScale = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: popScale.value }] }));

  const prevBurstKeyRef = useRef(-1);

  // biome-ignore lint/plugin: triggering a Reanimated withSequence on a shared value in response to a prop change requires a side effect
  useEffect(() => {
    if (isBursting && !reduce && burstKey !== prevBurstKeyRef.current) {
      prevBurstKeyRef.current = burstKey;
      popScale.value = withSequence(withTiming(0.7, { duration: 110 }), withSpring(1.0, { stiffness: 500, damping: 14 }));
    }
  }, [isBursting, burstKey, reduce, popScale]);

  const handlePressIn = useCallback(() => setPressed(true), []);
  const handlePressOut = useCallback(() => setPressed(false), []);
  const handlePress = useCallback(() => onSelect(starValue), [onSelect, starValue]);

  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={isSelected}
      accessibilityLabel={`${starValue} ${starValue === 1 ? 'star' : 'stars'}`}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      className={padClass}
    >
      <MotiView animate={{ scale: pressed && !reduce ? 0.9 : 1 }} transition={SPRING_PRESS}>
        <Animated.View style={[{ width: icon, height: icon, position: 'relative' }, popStyle]}>
          {/* Unfilled base star */}
          <StarSvg size={icon} color={MUTED_STAR} />
          {/* Filled amber overlay */}
          <MotiView
            animate={{ scale: filled ? 1 : 0, opacity: filled ? 1 : 0 }}
            transition={filled ? FILL_SPRING : UNFILL_TIMING}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            <StarSvg size={icon} color={AMBER} filled={true} />
          </MotiView>
          {/* Sparkle burst */}
          {isBursting && !reduce ? <SparklesBurst icon={icon} burstKey={burstKey} /> : null}
        </Animated.View>
      </MotiView>
    </Pressable>
  );
}

// ─── StarRating ───────────────────────────────────────────────────────────────

export function StarRating({
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  max = 5,
  size = 'md',
  allowClear = true,
  readOnly = false,
  showValue = false,
  label = 'Rating',
  style,
  testID,
}: StarRatingProps) {
  const reduce = useReducedMotion();
  const [internal, setInternal] = useState(defaultValue);
  const [burst, setBurst] = useState<{ key: number; index: number } | null>(null);

  const value = valueProp ?? internal;
  const { icon, pad, valueGap, lineH, valueLabel } = SIZES[size];

  // Build a stable array of star values (1…max) so map() never exposes an index.
  const starValues = useMemo(() => Array.from({ length: max }, (_, i) => i + 1), [max]);

  // Track scroll direction for the rolling value label — computed during render
  // so both the entering and exiting digit animate in the same direction.
  const prevValueRef = useRef(value);
  const direction = value >= prevValueRef.current ? 1 : -1;
  // biome-ignore lint/plugin: storing previous value in a ref for direction tracking requires a post-render side effect
  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  const commitValue = useCallback(
    (next: number) => {
      if (valueProp === undefined) setInternal(next);
      onValueChange?.(next);
    },
    [valueProp, onValueChange],
  );

  const handleSelect = useCallback(
    (starValue: number) => {
      const next = allowClear && starValue === value ? 0 : starValue;
      commitValue(next);
      if (next > 0 && !reduce) setBurst((prev) => ({ key: (prev?.key ?? 0) + 1, index: starValue - 1 }));
    },
    [allowClear, value, commitValue, reduce],
  );

  const handleAccessibilityAction = useCallback(
    (e: AccessibilityActionEvent) => {
      const { actionName } = e.nativeEvent;
      if (actionName === 'increment') commitValue(Math.min(value + 1, max));
      else if (actionName === 'decrement') commitValue(Math.max(value - 1, 0));
    },
    [value, max, commitValue],
  );

  if (readOnly)
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={`${label}: ${formatValue(value)} out of ${max}`}
        style={style}
        testID={testID}
        className="flex-row items-center"
      >
        {starValues.map((starValue) => {
          const fillPercent = Math.max(0, Math.min(1, value - (starValue - 1))) * 100;
          return (
            <View key={starValue} className={pad}>
              <View style={{ width: icon, height: icon, position: 'relative' }}>
                <StarSvg size={icon} color={MUTED_STAR} />
                {fillPercent > 0 ? (
                  <View
                    style={{ position: 'absolute', top: 0, left: 0, width: `${fillPercent}%`, height: icon, overflow: 'hidden' }}
                  >
                    <StarSvg size={icon} color={AMBER} filled={true} />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={handleAccessibilityAction}
      style={style}
      testID={testID}
      className="flex-row items-center"
    >
      <View className="flex-row items-center">
        {starValues.map((starValue) => (
          <StarButton
            key={starValue}
            starValue={starValue}
            filled={starValue <= value}
            isBursting={burst?.index === starValue - 1}
            burstKey={burst?.key ?? 0}
            isSelected={starValue === value}
            icon={icon}
            padClass={pad}
            reduce={reduce}
            onSelect={handleSelect}
          />
        ))}
      </View>

      {showValue ? (
        <View
          accessible={false}
          importantForAccessibility="no"
          style={{ height: lineH, overflow: 'hidden' }}
          className={`flex-row items-center ${valueGap}`}
        >
          <AnimatePresence>
            <MotiView
              key={formatValue(value)}
              from={{ translateY: direction * 12, opacity: 0 }}
              animate={{ translateY: 0, opacity: 1 }}
              exit={{ translateY: direction * -12, opacity: 0 }}
              transition={reduce ? { type: 'timing', duration: 0 } : VALUE_SPRING}
            >
              <Text className={valueLabel}>{formatValue(value)}</Text>
            </MotiView>
          </AnimatePresence>
          <Text className={valueLabel}>{`/${max}`}</Text>
        </View>
      ) : null}
    </View>
  );
}
