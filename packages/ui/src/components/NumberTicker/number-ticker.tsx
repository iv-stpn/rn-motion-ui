import { MotiView } from 'moti';
import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useInView } from '../../hooks/use-in-view';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { EASE_OUT } from '../../lib/ease';

export interface NumberTickerProps {
  value: number;
  /** Digits to pad to (left). */
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
}

const DIGITS = Array.from({ length: 10 }, (_, n) => n);

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
  const [armed, setArmed] = useState(!startOnView);
  // Measured "0" glyph box — the roll needs concrete px, not the web's `1ch`/`em`.
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (startOnView && inView) setArmed(true);
  }, [startOnView, inView]);

  const text = useMemo(() => {
    const rounded = Math.round(value);
    const formatted = format ? format(rounded) : locale ? rounded.toLocaleString() : rounded.toString();
    return pad ? formatted.padStart(pad, '0') : formatted;
  }, [value, pad, format, locale]);

  const glyphs = useMemo(() => {
    const chars = text.split('');
    // Key by place value (position from the right) so a changing digit rolls
    // instead of remounting, and growth adds glyphs on the left.
    return chars.map((char, i) => ({ char, id: `g-${chars.length - 1 - i}` }));
  }, [text]);

  const readableText = `${prefix ?? ''}${text}${suffix ?? ''}`;

  // Stagger is an entrance flourish; once revealed, live updates roll at once.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!armed || entered) return;
    const total = (duration + glyphs.length * stagger) * 1000;
    const t = setTimeout(() => setEntered(true), total);
    return () => clearTimeout(t);
  }, [armed, entered, duration, stagger, glyphs.length]);

  const onMeasure = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height && (width !== box.w || height !== box.h)) setBox({ w: width, h: height });
  };

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
      <Text
        className={className}
        onLayout={onMeasure}
        importantForAccessibility="no"
        style={{ position: 'absolute', opacity: 0 }}
      >
        0
      </Text>
      {prefix ? <Text className={className}>{prefix}</Text> : null}
      {measured
        ? glyphs.map(({ char, id }, i) => {
            if (!/\d/.test(char)) {
              return (
                <Text key={id} className={className}>
                  {char}
                </Text>
              );
            }
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

interface DigitProps {
  digit: number;
  delay: number;
  duration: number;
  box: { w: number; h: number };
  className?: string;
  digitClassName?: string;
}

function Digit({ digit, delay, duration, box, className, digitClassName }: DigitProps) {
  const reduce = useReducedMotion();
  return (
    <View
      className={digitClassName}
      style={{ width: box.w, height: box.h, overflow: 'hidden' }}
      importantForAccessibility="no"
    >
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
          <View key={n} style={{ height: box.h, alignItems: 'center', justifyContent: 'center' }}>
            <Text className={className} style={{ fontVariant: ['tabular-nums'] }}>
              {n}
            </Text>
          </View>
        ))}
      </MotiView>
    </View>
  );
}
