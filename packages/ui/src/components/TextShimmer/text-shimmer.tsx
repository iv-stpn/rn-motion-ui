import { MotiText } from 'moti';
import type { ReactNode } from 'react';
import { type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

export interface TextShimmerProps {
  /** A plain string shimmers per character; anything else renders statically. */
  children: ReactNode;
  /**
   * Web accepted any element tag. On RN there is no DOM element; an `h1`–`h6`
   * string maps to an accessibility header role.
   */
  as?: string;
  /** Seconds for one full sweep across the text. */
  duration?: number;
  /** Text styling (size/weight). Colour is driven by the shimmer, not this. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * RN fallback: the web original clipped a moving linear-gradient to the text
 * (`bg-clip-text` + `mask`), which RN cannot do without a masked SVG. Instead
 * each character animates its opacity in a staggered dim→bright→dim loop, so a
 * band of brightness sweeps left→right — the same shimmer read, RN-native.
 */
export function TextShimmer({ children, as, duration = 2.5, className, style, accessibilityLabel, testID }: TextShimmerProps) {
  const reduce = useReducedMotion();
  const isHeader = typeof as === 'string' && /^h[1-6]$/.test(as);
  const role = isHeader ? 'header' : 'text';

  // Non-string content (or reduced motion) can't be split per character.
  if (typeof children !== 'string' || reduce)
    return (
      <View testID={testID} accessibilityRole={role} accessibilityLabel={accessibilityLabel} style={style}>
        <Text className={className}>{children}</Text>
      </View>
    );

  const chars = Array.from(children);
  const perChar = (duration * 1000) / Math.max(chars.length, 1);
  const label = accessibilityLabel ?? children;

  return (
    <View
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      style={[{ flexDirection: 'row', flexWrap: 'wrap' }, style]}
    >
      {chars.map((char, i) => (
        <MotiText
          // biome-ignore lint/suspicious/noArrayIndexKey: position is the shimmer slot — each index pulses at its own staggered delay.
          key={i}
          className={className}
          from={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{
            type: 'timing',
            duration: duration * 500,
            loop: true,
            repeatReverse: true,
            delay: i * perChar,
          }}
        >
          {char === ' ' ? ' ' : char}
        </MotiText>
      ))}
    </View>
  );
}
