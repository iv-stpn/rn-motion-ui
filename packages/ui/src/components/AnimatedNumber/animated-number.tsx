import { useInView } from '@rn-motion-ui/hooks/use-in-view';
import { useReducedMotion } from '@rn-motion-ui/hooks/use-reduced-motion';
import { useEffect, useRef, useState } from 'react';
import { type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { EASE_OUT_FN } from '../../lib/ease';

export type AnimatedNumberProps = {
  value: number;
  /** Roll duration in seconds. */
  duration?: number;
  format?: (n: number) => string;
  /** Text styling (size/weight/colour). */
  className?: string;
  /** Only animate once the element has entered the viewport. */
  startOnView?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Counts the displayed value up to the target. The web original drove this with
 * framer's `animate()`; here the interpolation runs on the JS thread via
 * `requestAnimationFrame` (works on web + native) with the shared EASE_OUT curve.
 */
export function AnimatedNumber({
  value,
  duration = 1.2,
  format = (n) => Math.round(n).toLocaleString(),
  className,
  startOnView = true,
  style,
  accessibilityLabel,
  testID,
}: AnimatedNumberProps) {
  const [ref, inView] = useInView({ once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  // biome-ignore lint/plugin: rAF-driven eased counter — requestAnimationFrame loop cannot be expressed without useEffect
  useEffect(() => {
    if (startOnView && !inView) return;
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
  }, [value, duration, inView, startOnView, reduce]);

  return (
    <View
      ref={ref}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? format(value)}
      style={style}
    >
      <Text className={className} style={{ fontVariant: ['tabular-nums'] }}>
        {format(display)}
      </Text>
    </View>
  );
}
