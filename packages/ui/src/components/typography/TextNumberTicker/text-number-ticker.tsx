import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, type TextStyle, View, type ViewStyle } from 'react-native';
import { useArmOnView } from '../../../hooks/use-arm-on-view';
import { useInView } from '../../../hooks/use-in-view';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { EASE_OUT, EASE_OUT_FN } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { Text } from '../Text/text';
import { formatNumber, isDigit } from './text-number-ticker.logic';

const DIGITS = Array.from({ length: 10 }, (_, n) => n);
const MEASURE_GLYPH = '0';
const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };
const ROW: ViewStyle = { flexDirection: 'row', alignItems: 'center' };
/** Animation duration defaults, per mode (seconds). */
const DEFAULT_DURATION = { roll: 0.9, count: 1.2 } as const;

export type TextNumberTickerMode =
  /** Every digit is its own column, rolling to its target. Default. */
  | 'roll'
  /** One label whose value counts up to the target along an eased curve. */
  | 'count';

export type TextNumberTickerProps = {
  value: number;
  /**
   * How the number animates. `'roll'` (default) gives each digit its own rolling
   * column; `'count'` interpolates a single label up to the value.
   */
  mode?: TextNumberTickerMode;
  /** Animation duration in seconds — per digit in `'roll'`, total in `'count'`.
   *  Defaults to 0.9 (`'roll'`) / 1.2 (`'count'`). */
  duration?: number;
  /** Stagger between digit columns, in seconds. `'roll'` only. */
  stagger?: number;
  /** Minimum digit count, left-padded with zeros. Counts digits, not characters,
   *  so group separators land around the zeros ("000,042") and the column count
   *  holds steady as the value grows. */
  pad?: number;
  /** Insert locale group separators (commas). */
  locale?: boolean;
  /** Custom formatter. In `'count'` it receives the in-flight fractional value
   *  and owns any rounding; without one the value is rounded for display. */
  format?: (value: number) => string;
  prefix?: string;
  suffix?: string;
  /** Only animate once the element has entered the viewport. */
  startOnView?: boolean;
  /** Text styling for glyphs (size/weight/colour). */
  className?: string;
  /** Extra styling for each digit column. `'roll'` only. */
  digitClassName?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Animates a number into place, either as rolling per-digit columns (`'roll'`)
 * or as a single counting label (`'count'`).
 *
 * `'roll'` measures a hidden "0" to get a concrete glyph box — the columns need
 * px, not the web's `1ch`/`em` — then translates each column to its digit, with
 * an optional entrance stagger. `'count'` interpolates on the JS thread via
 * `requestAnimationFrame` (works on web + native) along the shared EASE_OUT curve.
 *
 * Both modes expose the settled value as the accessible label, so the animation
 * is never something a screen reader has to sit through.
 */
// biome-ignore lint/style/useExportsLast: component exported before its internal helpers — collocated for readability
export function TextNumberTicker({
  value,
  mode = 'roll',
  duration = DEFAULT_DURATION[mode],
  stagger = 0.04,
  pad,
  locale,
  format,
  prefix,
  suffix,
  startOnView = true,
  className,
  digitClassName,
  style,
  accessibilityLabel,
  testID,
}: TextNumberTickerProps) {
  const [ref, inView] = useInView({ once: true, amount: 0.6 });
  const armed = useArmOnView(startOnView, inView);

  // A custom formatter owns its own rounding, so `'count'` can hand it the
  // in-flight fractional value ("1.2k"); without one, round before formatting.
  const formatValue = useCallback(
    (n: number) => formatNumber(format ? n : Math.round(n), pad, format, locale),
    [format, pad, locale],
  );

  // The settled text: what `'roll'` lays out columns for, and what both modes read out.
  const text = useMemo(() => formatValue(Math.round(value)), [formatValue, value]);
  const readableText = `${prefix ?? ''}${text}${suffix ?? ''}`;

  return (
    <View
      ref={ref}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? readableText}
      style={mode === 'roll' ? [ROW, style] : style}
    >
      {mode === 'roll' ? (
        <RollingDigits
          armed={armed}
          className={className}
          digitClassName={digitClassName}
          duration={duration}
          prefix={prefix}
          stagger={stagger}
          suffix={suffix}
          text={text}
        />
      ) : (
        <CountingLabel
          armed={armed}
          className={className}
          duration={duration}
          format={formatValue}
          prefix={prefix}
          suffix={suffix}
          value={value}
        />
      )}
    </View>
  );
}

type RollingDigitsProps = {
  text: string;
  armed: boolean;
  duration: number;
  stagger: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  digitClassName?: string;
};

function RollingDigits({ text, armed, duration, stagger, prefix, suffix, className, digitClassName }: RollingDigitsProps) {
  // Measured "0" glyph box — the roll needs concrete px, not the web's `1ch`/`em`.
  const [box, setBox] = useState({ w: 0, h: 0 });

  const glyphs = useMemo(() => {
    const chars = text.split('');
    // Key by place value (position from the right) so a changing digit rolls
    // instead of remounting, and growth adds glyphs on the left.
    return chars.map((char, i) => ({ char, id: `g-${chars.length - 1 - i}` }));
  }, [text]);

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
    <>
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
    </>
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
            <Text className={className} style={TABULAR}>
              {n}
            </Text>
          </View>
        ))}
      </MotiView>
    </View>
  );
}

type CountingLabelProps = {
  value: number;
  armed: boolean;
  duration: number;
  format: (value: number) => string;
  prefix?: string;
  suffix?: string;
  className?: string;
};

function CountingLabel({ value, armed, duration, format, prefix, suffix, className }: CountingLabelProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  // biome-ignore lint/plugin: rAF-driven eased counter — requestAnimationFrame loop cannot be expressed without useEffect
  useEffect(() => {
    if (!armed) return;
    if (reduce) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const delta = value - from;
    const durMs = Math.max(1, duration * 1000);
    let raf = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / durMs);
      setDisplay(from + delta * EASE_OUT_FN(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    fromRef.current = value;

    return () => cancelAnimationFrame(raf);
  }, [value, duration, armed, reduce]);

  return (
    <Text className={className} style={TABULAR}>
      {`${prefix ?? ''}${format(display)}${suffix ?? ''}`}
    </Text>
  );
}
