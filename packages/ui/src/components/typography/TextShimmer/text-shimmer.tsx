import { type ReactNode, useEffect } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useThemeColor } from '../../../theme/use-theme-color';
import { Text } from '../Text/text';

const HEADER_REGEX = /^h[1-6]$/;

/**
 * Half-width of the bright band, in phase units (the string spans 0→1). The web
 * original sized its gradient window as a fraction of the string too, so short
 * and long strings both get a proportional glint rather than a fixed-width one.
 */
const BAND = 0.22;

type ShimmerCharProps = {
  char: string;
  className: string | undefined;
  /** Resting colour, away from the band. */
  color: string;
  /** Colour at the centre of the band. */
  highlightColor: string;
  /** Where this character sits along the string, 0 (first) → 1 (last). */
  phase: number;
  progress: SharedValue<number>;
};

function ShimmerChar({ char, className, color, highlightColor, phase, progress }: ShimmerCharProps) {
  const animatedStyle = useAnimatedStyle(() => {
    // The band centre starts one half-width off the left edge and ends one off
    // the right, so it enters and leaves cleanly and the sawtooth's wrap back to
    // 0 happens out of sight — no visible jump at the loop seam.
    const center = -BAND + progress.value * (1 + 2 * BAND);
    const distance = Math.abs(phase - center) / BAND;
    // Raised cosine: 1 at the band centre, easing to 0 at its edges. Smoother
    // than a linear ramp, so the glint has no hard shoulder.
    const lift = distance >= 1 ? 0 : (1 + Math.cos(Math.PI * distance)) / 2;
    return { color: interpolateColor(lift, [0, 1], [color, highlightColor]) };
  });

  return (
    <Animated.Text className={className} style={animatedStyle}>
      {/* Each character is its own element, so a plain space would be a
          collapsible whitespace node between flex items; NBSP holds its width. */}
      {/* biome-ignore lint/suspicious/noLeakedRender: both branches are string literals — no numeric leak */}
      {char === ' ' ? ' ' : char}
    </Animated.Text>
  );
}

export type TextShimmerProps = {
  /** A plain string shimmers per character; anything else renders statically. */
  children: ReactNode;
  /**
   * Web accepted any element tag. On RN there is no DOM element; an `h1`–`h6`
   * string maps to an accessibility header role.
   */
  as?: string;
  /** Seconds for one full sweep across the text. */
  duration?: number;
  /**
   * Resting colour of the text, away from the sweep. Defaults to the
   * `muted-foreground` token.
   */
  color?: string;
  /**
   * Colour at the crest of the sweep. Defaults to the `foreground` token.
   */
  highlightColor?: string;
  /**
   * Text styling — size, weight, tracking. Colour is driven by `color` /
   * `highlightColor`, not by a `text-*` class here: the shimmer writes colour
   * as an animated style, which wins over the class on both platforms.
   */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * RN adaptation: the web original clipped a moving linear-gradient to the text
 * (`bg-clip-text` + `mask`), which RN cannot do without a masked SVG. Instead
 * each character interpolates between `color` and `highlightColor`, and a narrow
 * band of highlighted characters sweeps left→right — the same shimmer read,
 * RN-native. Colour (not opacity) carries the effect, so the text stays fully
 * legible while it shimmers.
 */
export function TextShimmer({
  children,
  as,
  duration = 2.5,
  color,
  highlightColor,
  className,
  style,
  accessibilityLabel,
  testID,
}: TextShimmerProps) {
  const reduce = useReducedMotion();
  const mutedForeground = useThemeColor('muted-foreground');
  const foreground = useThemeColor('foreground');
  const dim = color ?? mutedForeground;
  const bright = highlightColor ?? foreground;
  const isHeader = typeof as === 'string' && HEADER_REGEX.test(as);
  const role = isHeader ? 'header' : 'text';
  const animating = typeof children === 'string' && !reduce;

  // One sawtooth shared value drives every character, and its `withRepeat` is
  // built ONCE here — not via moti's declarative `loop`. moti rebuilds
  // `withRepeat(withTiming(target))` inside its worklet on every re-run, so any
  // re-render (a theme toggle, a parent state change) landing while a character
  // sits at its animation target leaves the repeat with almost no distance left
  // to travel: the string sticks at the target and the shimmer flattens to
  // imperceptible. Owning the loop in a shared value means re-renders can't
  // cancel or rebuild it — they only re-read `progress`.
  const progress = useSharedValue(0);
  // biome-ignore lint/plugin: the sweep is an imperative animation assigned to a shared value — not expressible as derived state, and must be built once per [animating, duration] rather than on every render
  useEffect(() => {
    if (!animating) return;
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: duration * 1000, easing: Easing.linear }), -1, false);
  }, [animating, duration, progress]);

  // Non-string content (or reduced motion) can't be split per character, so it
  // renders static at the legible end of the sweep.
  if (typeof children !== 'string' || reduce)
    return (
      <View testID={testID} accessibilityRole={role} accessibilityLabel={accessibilityLabel} style={style}>
        <Text className={className} style={{ color: bright }}>
          {children}
        </Text>
      </View>
    );

  const chars = Array.from(children);
  const lastIndex = Math.max(chars.length - 1, 1);
  const label = accessibilityLabel ?? children;

  return (
    <View
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      style={[{ flexDirection: 'row', flexWrap: 'wrap' }, style]}
    >
      {chars.map((char, i) => (
        <ShimmerChar
          char={char}
          className={className}
          color={dim}
          highlightColor={bright}
          // biome-ignore lint/suspicious/noArrayIndexKey: position is the shimmer slot — each index lights up at its own point in the sweep.
          key={i}
          phase={i / lastIndex}
          progress={progress}
        />
      ))}
    </View>
  );
}
