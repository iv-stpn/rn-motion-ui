// Shared machinery for the Button family. Button and ElevatedButton both drive
// the same tap interaction (press-scale flag + Material ripples + measured pixel
// size) and lay out the same content row (label, optional adornments, loading
// spinner), so those pieces live here rather than being duplicated per sibling.
// Nothing here is variant-aware: each component resolves its own colours/classes
// and passes the results in.
import { Children, isValidElement, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { cn } from '../../../lib/cn';
import { MotiView } from '../../../moti/components/view';
import type { MotiTransitionProp } from '../../../theme/motion';
import { Text } from '../../typography/Text/text';
import { BUTTON_GAP_CLASSNAME } from './button-scale';

// ── module-local types & helpers ────────────────────────────────────────────
// Kept ahead of the exports (useExportsLast). `Ripple` stays local: consumers
// destructure `usePressRipples`' return and never name the type themselves.

type Ripple = { id: number; x: number; y: number; size: number };

type ButtonRipplesProps = { ripples: Ripple[]; filled: boolean; zIndex?: number };

type UsePressRipplesArgs = { ripple: boolean; reduce: boolean; trackDims: boolean };

type BuildContentArgs = {
  loading: boolean | undefined;
  reduce: boolean;
  /** Resolved label class (colour + size), computed by the caller so each button
   *  can fold its own variant/colour/hover override in before it reaches here. */
  labelClass: string;
  /** Resolved label colour, applied inline. For callers whose colour isn't a
   *  static class — GlossyButton derives its label from the face colour, so
   *  there is no `text-*` utility for the scanner to find. Wins over any colour
   *  in `labelClass`/`labelClassName`, since inline style beats className. */
  labelColor?: string;
  children: ReactNode;
  leftAdornment: ReactNode;
  rightAdornment: ReactNode;
  spinnerColor: string;
  labelClassName: string | undefined;
};

function renderChild(child: ReactNode, className: string, labelClassName?: string, color?: string): ReactNode {
  if (typeof child === 'string' || typeof child === 'number')
    return (
      <Text className={cn(className, labelClassName)} style={color === undefined ? undefined : { color }}>
        {child}
      </Text>
    );
  return isValidElement(child) ? child : null;
}

export type PressAnimateOpts = {
  pressed: boolean;
  blocked: boolean;
  pressMode: 'scale' | 'scaleY' | 'scaleX' | 'scaleXFirst' | 'scaleXLast' | 'none';
  pressScale: number;
};

/**
 * Resolves the MotiView `animate` value for the press animation.  Each button
 * component calls this and spreads the result into its own animate object so
 * it can merge additional properties (e.g. GlossyButton's opacity).
 */
// biome-ignore lint/style/useComponentExportOnlyModules: shared press-animation helper consumed by every button component alongside the other machinery already exempted below
export function pressAnimate(opts: PressAnimateOpts) {
  const { pressed, blocked, pressMode, pressScale } = opts;
  if (pressMode === 'none' || blocked) return { scale: 1 };
  if (!pressed) {
    if (pressMode === 'scaleY') return { scaleY: 1, translateY: 0 };
    if (pressMode === 'scaleX' || pressMode === 'scaleXFirst' || pressMode === 'scaleXLast') return { scaleX: 1 };
    return { scale: 1 };
  }
  if (pressMode === 'scaleY') return { scaleY: 0.96, translateY: 2 };
  if (pressMode === 'scaleX') return { scaleX: 0.96 };
  if (pressMode === 'scaleXFirst') return { scaleX: 0.96, translateY: -1 };
  if (pressMode === 'scaleXLast') return { scaleX: 0.96, translateY: 1 };
  return { scale: pressScale };
}

// ── exports ─────────────────────────────────────────────────────────────────

// The size/shape axes and the label ramp live in button-scale.ts, next to the
// box geometry they belong to (and reachable from ActionSwap without pulling in
// this file's SVG/Moti dependencies). Re-exported here so every sibling keeps
// importing its types from one place.
export type { ButtonShape, ButtonSize } from './button-scale';

/**
 * Props shared by every button in the family (Button, ElevatedButton). Each
 * component adds its own visual axis on top — Button its variant table,
 * ElevatedButton its coloured `variant` — but the interaction/layout surface
 * below is identical across all of them.
 */
export type BaseButtonProps = {
  children?: ReactNode;
  /** Node rendered to the left of the button label. */
  leftAdornment?: ReactNode;
  /** Node rendered to the right of the button label. */
  rightAdornment?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Spawn a Material-style ripple from the press point. Off by default. */
  ripple?: boolean;
  /** Scale the button settles to while pressed. */
  pressScale?: number;
  /**
   * Shape of the press animation.
   * - `scale` (default) — uniform pressScale, the current behaviour.
   * - `scaleY` — compresses vertically and nudges down (horizontal segmented controls).
   * - `scaleX` — compresses horizontally (vertical segmented controls, middle buttons).
   * - `scaleXFirst` — compresses horizontally and nudges up (first button in a vertical group).
   * - `scaleXLast` — compresses horizontally and nudges down (last button in a vertical group).
   * - `none` — no press animation at all.
   */
  pressMode?: 'scale' | 'scaleY' | 'scaleX' | 'scaleXFirst' | 'scaleXLast' | 'none';
  /** When true, skip the 0.5 opacity applied to disabled buttons. */
  noDisabledOpacity?: boolean;
  /** Colour shown as an absolutely-positioned overlay behind the button content. */
  backdropColor?: string;
  /**
   * Override the press-scale spring. Partial — only the fields you pass are changed.
   * Default: `MOTION_SNAPPY` (stiffness 500, damping 30, mass 0.6).
   */
  pressTransition?: Partial<MotiTransitionProp>;
  /** Stretch the button to fill its container width. */
  fitWidth?: boolean;
  /** Additional UniWind class names merged onto the outer wrapper. */
  className?: string;
  /** Additional class names merged onto the label Text. */
  labelClassName?: string;
  /** Tailwind classes merged onto the Pressable container. */
  contentClassName?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Material-style press ripples. `filled` picks a white shimmer for dark filled
 * backgrounds vs a dark shimmer for light ones; both are theme-exempt overlays.
 *
 * Renders a single absolutely-positioned container so every ripple MotiView
 * shares the same coordinate origin (the Pressable it sits inside) and the same
 * z-index layer — a bare array of absolutely-positioned siblings would each
 * position relative to its own parent, and a nested wraper (GlossyButton's old
 * approach) shifts the origin to the wrapper rather than to the Pressable whose
 * `locationX`/`locationY` the coordinates came from.
 */
export function ButtonRipples({ ripples, filled, zIndex }: ButtonRipplesProps) {
  if (ripples.length === 0) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, zIndex === undefined ? null : { zIndex }]}>
      {ripples.map((rp) => (
        <MotiView
          key={rp.id}
          from={{ scale: 0, opacity: 0.3 }}
          animate={{ scale: 1, opacity: 0 }}
          transition={{ type: 'timing', duration: 600 }}
          style={{
            position: 'absolute',
            left: rp.x - rp.size / 2,
            top: rp.y - rp.size / 2,
            width: rp.size,
            height: rp.size,
            borderRadius: rp.size / 2,
            backgroundColor: filled
              ? 'rgba(255,255,255,0.35)' /* theme-exempt: white shimmer on filled bg */
              : 'rgba(0,0,0,0.12)' /* theme-exempt: dark shimmer on light bg */,
          }}
        />
      ))}
    </View>
  );
}

// Owns the tap interaction: the `pressed` flag (drives the scale spring), the live
// ripple list, and the button's measured pixel size. `size_` is a ref — read
// synchronously on press to size a ripple — while `dims` is state because the
// ElevatedButton rim SVG needs it to re-render; that state write is gated behind
// `trackDims` so no other button pays for a render on layout.
// biome-ignore lint/style/useComponentExportOnlyModules: shared button machinery — the hook and content builder are consumed alongside ButtonRipples by both Button and ElevatedButton; splitting them off would fragment tightly-coupled press/layout logic
// biome-ignore lint/style/useExportsLast: ButtonSpinner (non-export) sits between usePressRipples and other exports; moving it would separate the continuous spinner from the press machinery it belongs with
export function usePressRipples({ ripple, reduce, trackDims }: UsePressRipplesArgs) {
  const [pressed, setPressed] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const nextId = useRef(0);
  const size_ = useRef({ w: 0, h: 0 });

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      size_.current = { w: width, h: height };
      if (trackDims) setDims((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    },
    [trackDims],
  );

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(true);
      if (!ripple || reduce) return;
      const { locationX: x, locationY: y } = e.nativeEvent;
      const r = Math.max(size_.current.w, size_.current.h) * 2;
      const id = nextId.current;
      nextId.current += 1;
      setRipples((prev) => [...prev, { id, x, y, size: r }]);
      setTimeout(() => setRipples((prev) => prev.filter((rp) => rp.id !== id)), 650);
    },
    [ripple, reduce],
  );
  const handlePressOut = useCallback(() => setPressed(false), []);

  return { pressed, ripples, dims, onLayout, handlePressIn, handlePressOut };
}

/**
 * Continuous 0°→360° rotation for the loading spinner. Imperative
 * (shared value + withRepeat) for the same reason as BadgeSpinner —
 * MotiView's declarative `loop` re-issues the animation on every
 * parent re-render, restarting mid-revolution, and default easing
 * pauses at the repeat boundary.
 */
type ButtonSpinnerProps = { color: string; reduce: boolean /** Diameter in px. @default 16 */; size?: number };

export function ButtonSpinner({ color, reduce, size = 16 }: ButtonSpinnerProps) {
  const rotation = useSharedValue(0);
  const r = size * 0.375; // proportional radius (6/16 = 0.375)
  const sw = size * 0.125; // proportional stroke width (2/16 = 0.125)
  const c = size / 2;
  const circumference = Math.PI * 2 * r;

  // biome-ignore lint/plugin: Reanimated withRepeat loop must be started and cancelled as a side effect — not expressible as derived state
  useEffect(() => {
    if (reduce) {
      rotation.value = 0;
      return;
    }
    rotation.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotation);
  }, [reduce, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={c} cy={c} r={r} stroke={color} strokeOpacity={0.25} strokeWidth={sw} fill="none" />
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * 0.5} ${circumference}`}
        />
      </Svg>
    </Animated.View>
  );
}

// biome-ignore lint/style/useComponentExportOnlyModules: see usePressRipples — buildButtonContent is the layout half of the same shared press/content machinery
export function buildButtonContent({
  loading,
  reduce,
  labelClass,
  labelColor,
  children,
  leftAdornment,
  rightAdornment,
  spinnerColor,
  labelClassName,
}: BuildContentArgs): ReactNode {
  if (loading) return <ButtonSpinner color={spinnerColor} reduce={reduce} />;

  const hasAdornments = leftAdornment !== undefined || rightAdornment !== undefined;
  const isLeaf = typeof children === 'string' || typeof children === 'number';
  const mergedLabelClass = cn(labelClass, labelClassName);
  const labelStyle = labelColor === undefined ? undefined : { color: labelColor };

  if (isLeaf && !hasAdornments)
    return (
      <Text className={mergedLabelClass} style={labelStyle}>
        {children}
      </Text>
    );

  return (
    <View className={cn('flex-row items-center justify-center', BUTTON_GAP_CLASSNAME)}>
      {leftAdornment}
      {isLeaf ? (
        <Text className={mergedLabelClass} style={labelStyle}>
          {children}
        </Text>
      ) : (
        Children.map(children, (child) => renderChild(child, labelClass, labelClassName, labelColor))
      )}
      {rightAdornment}
    </View>
  );
}
