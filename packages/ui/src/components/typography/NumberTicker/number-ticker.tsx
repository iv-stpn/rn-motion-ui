import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import { useArmOnView } from '../../../hooks/use-arm-on-view';
import { useInView } from '../../../hooks/use-in-view';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_OUT } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { Text } from '../Text/text';
import { formatNumber, isDigit } from './number-ticker.logic';

const DIGITS = Array.from({ length: 10 }, (_, n) => n);
const MEASURE_GLYPH = '0';

export type NumberTickerProps = {
  value: number;
  /** Minimum digit count, left-padded with zeros. Counts digits, not characters,
   *  so group separators land around the zeros ("000,042") and the column count
   *  holds steady as the value grows. */
  pad?: number;
  /** Per-digit roll duration in seconds. */
  duration?: number;
  /** Stagger between digits, in seconds. */
  stagger?: number;
  /** Render only after the element enters the viewport. */
  startOnView?: boolean;
  prefix?: string;
  suffix?: string;
  /**
   * Web added a small blur during digit rolls; RN has no text blur, so this is
   * accepted for API parity but has no visual effect (documented fallback).
   */
  blur?: boolean;
  /** Text styling for glyphs (size/weight/colour). */
  className?: string;
  /** Extra styling for each digit column. */
  digitClassName?: string;
  /** Insert locale group separators (commas). */
  locale?: boolean;
  /** Custom formatter. */
  format?: (value: number) => string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

// biome-ignore lint/style/useExportsLast: component exported before internal Digit helper — collocated for readability
export function NumberTicker({
  value,
  pad,
  duration = 0.9,
  stagger = 0.04,
  startOnView = true,
  prefix,
  suffix,
  // `blur` is accepted for web API parity but has no effect on RN (no text blur).
  className,
  digitClassName,
  locale,
  format,
  style,
  accessibilityLabel,
  testID,
}: NumberTickerProps) {
  const [ref, inView] = useInView({ once: true, amount: 0.6 });
  const armed = useArmOnView(startOnView, inView);
  // Measured "0" glyph box — the roll needs concrete px, not the web's `1ch`/`em`.
  const [box, setBox] = useState({ w: 0, h: 0 });

  const text = useMemo(() => formatNumber(Math.round(value), pad, format, locale), [value, pad, format, locale]);

  const glyphs = useMemo(() => {
    const chars = text.split('');
    // Key by place value (position from the right) so a changing digit rolls
    // instead of remounting, and growth adds glyphs on the left.
    return chars.map((char, i) => ({ char, id: `g-${chars.length - 1 - i}` }));
  }, [text]);

  const readableText = `${prefix ?? ''}${text}${suffix ?? ''}`;

  // Stagger is an entrance flourish; once revealed, live updates roll at once.
  const [entered, setEntered] = useState(false);
  // biome-ignore lint/plugin: entrance stagger requires a setTimeout that fires after the animation completes — not derivable from render-time state
  useEffect(() => {
    if (!armed || entered) return;
    const total = (duration + glyphs.length * stagger) * 1000;
    const t = setTimeout(() => setEntered(true), total);
    return () => clearTimeout(t);
  }, [armed, entered, duration, stagger, glyphs.length]);

  const onMeasure = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width && height && (width !== box.w || height !== box.h)) setBox({ w: width, h: height });
    },
    [box.w, box.h],
  );

  const measured = box.h > 0;

  return (
    <View
      ref={ref}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? readableText}
      style={[{ flexDirection: 'row', alignItems: 'center' }, style]}
    >
      {/* Hidden measurer sets the per-digit box before columns render. */}
      <Text onLayout={onMeasure} importantForAccessibility="no" className={cn('absolute opacity-0', className)}>
        {MEASURE_GLYPH}
      </Text>
      {prefix ? <Text className={className}>{prefix}</Text> : null}
      {measured
        ? glyphs.map(({ char, id }, i) => {
            if (!isDigit(char))
              return (
                <Text key={id} className={className}>
                  {char}
                </Text>
              );
            return (
              <Digit
                key={id}
                digit={armed ? Number(char) : 0}
                delay={entered ? 0 : i * stagger}
                duration={duration}
                box={box}
                className={className}
                digitClassName={digitClassName}
              />
            );
          })
        : null}
      {suffix ? <Text className={className}>{suffix}</Text> : null}
    </View>
  );
}

type DigitProps = {
  digit: number;
  delay: number;
  duration: number;
  box: { w: number; h: number };
  className?: string;
  digitClassName?: string;
};

function Digit({ digit, delay, duration, box, className, digitClassName }: DigitProps) {
  const reduce = useReducedMotion();
  return (
    <View className={digitClassName} style={{ width: box.w, height: box.h, overflow: 'hidden' }} importantForAccessibility="no">
      <MotiView
        from={{ translateY: 0 }}
        animate={{ translateY: -digit * box.h }}
        transition={
          reduce
            ? { type: 'timing', duration: 0 }
            : { type: 'timing', duration: duration * 1000, delay: delay * 1000, easing: EASE_OUT }
        }
      >
        {DIGITS.map((n) => (
          <View key={n} className="items-center justify-center" style={{ height: box.h }}>
            <Text className={className} style={{ fontVariant: ['tabular-nums'] }}>
              {n}
            </Text>
          </View>
        ))}
      </MotiView>
    </View>
  );
}
