// biome-ignore-all lint/style/noExcessiveLinesPerFile: all loader variants (spinner, dots, helix, …) collocated for consistent import

import { useEffect, useState } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useInterval } from '../../hooks/use-interval';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/cn';
import { EASE_IN_OUT } from '../../lib/ease';
import { MotiView } from '../../moti/components/view';
import { useThemeColor } from '../../theme/use-theme-color';
import { Text } from '../Text/text';

// biome-ignore lint/style/useExportsLast: variant union before frame constants — collocated for readability
export type LoaderVariant =
  | 'spinner'
  | 'dots'
  | 'bars'
  | 'dot-matrix'
  | 'dither'
  | 'ascii'
  | 'ascii-line'
  | 'ascii-braille'
  | 'ascii-blocks'
  | 'ascii-bounce'
  | 'comet'
  | 'scramble'
  | 'newton'
  | 'helix'
  | 'percent';

// Terminal-style frame sets — the loaders CLI AI agents cycle through.
const ASCII_SETS: Record<string, string[]> = {
  ascii: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  'ascii-line': ['|', '/', '-', '\\'],
  'ascii-braille': ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  'ascii-blocks': ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂'],
  'ascii-bounce': ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈'],
};

export type LoaderProps = {
  /** Which animation to render. */
  variant?: LoaderVariant;
  /** Base square size in px. Everything scales from this. */
  size?: number;
  /** Seconds per animation cycle. */
  speed?: number;
  /** Stroke/fill colour for the loader. */
  color?: string;
  /** Accessible label announced to screen readers. */
  label?: string;
  /** Additional NativeWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Loader({
  variant = 'spinner',
  size = 32,
  speed = 1,
  color: colorProp,
  label = 'Loading',
  className,
  style,
  testID,
}: LoaderProps) {
  const reduce = useReducedMotion();
  const defaultColor = useThemeColor('foreground');
  const color = colorProp ?? defaultColor;
  const shared = { size, speed, color, reduce };
  const asciiFrames = ASCII_SETS[variant];
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      testID={testID}
      className={cn('items-center justify-center', className)}
      style={[{ minWidth: size, minHeight: size }, style]}
    >
      {variant === 'spinner' && <Spinner {...shared} />}
      {variant === 'dots' && <Dots {...shared} />}
      {variant === 'bars' && <Bars {...shared} />}
      {variant === 'dot-matrix' && <DotMatrix {...shared} />}
      {variant === 'dither' && <Dither {...shared} />}
      {asciiFrames !== undefined && <Ascii frames={asciiFrames} {...shared} />}
      {variant === 'comet' && <Comet {...shared} />}
      {variant === 'scramble' && <Scramble {...shared} />}
      {variant === 'newton' && <Newton {...shared} />}
      {variant === 'helix' && <Helix {...shared} />}
      {variant === 'percent' && <Percent {...shared} />}
    </View>
  );
}

type PartProps = { size: number; speed: number; color: string; reduce: boolean };

function Spinner({ size, speed, color, reduce }: PartProps) {
  const stroke = Math.max(2, size * 0.09);
  const r = (size - stroke) / 2;
  const dur = speed * 1000;
  return (
    <MotiView
      from={{ rotate: '0deg' }}
      animate={reduce ? { opacity: 0.5 } : { rotate: '360deg' }}
      transition={
        reduce
          ? { type: 'timing', duration: 700, loop: true, repeatReverse: true }
          : { type: 'timing', duration: dur, loop: true, repeatReverse: false, easing: undefined }
      }
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={stroke} />
        <Path
          d={`M ${size / 2} ${size / 2 - r} A ${r} ${r} 0 0 1 ${size / 2 + r} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </Svg>
    </MotiView>
  );
}

function Dot({ size, speed, color, reduce, index }: PartProps & { index: number }) {
  const dim = size * 0.24;
  const top = -size * 0.3;
  const half = speed * 500;
  // Drive the bounce with a raw Reanimated shared value whose `withRepeat` is
  // created ONCE (in this effect) — not via moti's declarative `loop`. moti
  // rebuilds its `withRepeat(withTiming(target))` on every worklet re-run, and
  // the Dot re-renders whenever an ancestor `<AnimatePresence>` churns its
  // presence context (theme toggle, parent state) — which bypasses React.memo,
  // since `useContext` always re-renders consumers. A rebuild that lands while
  // the dot sits at its translateY target leaves the repeat with zero forward
  // distance, freezing the dot at the top of the bounce ("one cycle then
  // stops"). Storing the animation in a shared value created once means
  // re-renders never cancel or rebuild it; the bounce runs indefinitely.
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.5);
  // biome-ignore lint/plugin: the loop animation is an imperative side-effect assigned to a shared value — not expressible as derived state, and must run once per [reduce,size,speed,index] rather than every render
  useEffect(() => {
    if (reduce) {
      translateY.value = 0;
      opacity.value = withRepeat(withTiming(1, { duration: half, easing: EASE_IN_OUT }), -1, true);
      return;
    }
    opacity.value = withTiming(1, { duration: 240 });
    translateY.value = withDelay(
      index * speed * 160,
      withRepeat(withTiming(top, { duration: half, easing: EASE_IN_OUT }), -1, true),
    );
  }, [reduce, top, half, index, speed, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[animatedStyle, { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: color }]} />;
}

function Dots({ size, speed, color, reduce }: PartProps) {
  return (
    <View className="flex-row items-center" style={{ gap: size * 0.14 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} size={size} speed={speed} color={color} reduce={reduce} index={i} />
      ))}
    </View>
  );
}

function Bars({ size, speed, color, reduce }: PartProps) {
  const bar = size * 0.16;
  // Animate height (not scaleY): scaling would also squash the vertical
  // border-radius, flattening the round caps into ellipses. Driving height keeps
  // the caps true half-circles (radius = half width) at every bar height.
  const minH = size * 0.3;
  return (
    <View className="flex-row items-center" style={{ gap: size * 0.1, height: size }}>
      {[0, 1, 2, 3].map((i) => (
        <MotiView
          key={i}
          from={{ height: minH }}
          animate={reduce ? { height: size * 0.6 } : { height: size }}
          transition={{
            type: 'timing',
            duration: speed * 500,
            loop: true,
            repeatReverse: true,
            delay: i * speed * 120,
          }}
          style={{ width: bar, borderRadius: bar / 2, backgroundColor: color }}
        />
      ))}
    </View>
  );
}

function Ascii({ frames, size, speed, color, reduce }: PartProps & { frames: string[] }) {
  const [frame, setFrame] = useState(0);
  const step = ((reduce ? speed * 2.5 : speed) / frames.length) * 1000;
  useInterval(() => setFrame((f) => (f + 1) % frames.length), step);
  return (
    <Text style={{ fontSize: size, lineHeight: size * 1.1, color, fontVariant: ['tabular-nums'] }}>
      {frames[frame % frames.length]}
    </Text>
  );
}

const SCRAMBLE_TARGET = 'LOADING';
const SCRAMBLE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/*#@';

function Scramble({ size, speed, color, reduce }: PartProps) {
  const [text, setText] = useState(SCRAMBLE_TARGET);
  // biome-ignore lint/plugin: looping scramble animation uses setInterval with tick-based state — not expressible without useEffect
  useEffect(() => {
    if (reduce) {
      setText(SCRAMBLE_TARGET);
      return;
    }
    let tick = 0;
    const total = SCRAMBLE_TARGET.length + 4;
    const id = setInterval(
      () => {
        const reveal = tick % total;
        let s = '';
        for (let i = 0; i < SCRAMBLE_TARGET.length; i += 1)
          s += i < reveal ? SCRAMBLE_TARGET[i] : SCRAMBLE_GLYPHS[Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)];
        setText(s);
        tick += 1;
      },
      (speed / SCRAMBLE_TARGET.length) * 1000 * 0.55,
    );
    return () => clearInterval(id);
  }, [speed, reduce]);
  return (
    <Text style={{ fontSize: size * 0.42, letterSpacing: 2, color, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
      {text}
    </Text>
  );
}

function Percent({ size, speed, color, reduce }: PartProps) {
  const [p, setP] = useState(0);
  // biome-ignore lint/plugin: JS-thread percentage counter uses setInterval with internal mutable timing state — not expressible without useEffect
  useEffect(() => {
    const dur = (reduce ? speed * 2 : speed) * 1000;
    const state = { t: 0 };
    const tickMs = 40;
    const id = setInterval(() => {
      state.t += tickMs;
      const next = Math.min(100, Math.round((state.t / dur) * 100));
      setP(next);
      if (next >= 100) state.t = 0;
    }, tickMs);
    return () => clearInterval(id);
  }, [speed, reduce]);
  return (
    <View className="items-center" style={{ gap: size * 0.14, width: size * 1.4 }}>
      <Text style={{ fontSize: size * 0.42, color, fontWeight: '500', fontVariant: ['tabular-nums'] }}>{`${p}%`}</Text>
      <View className="w-full overflow-hidden" style={{ height: Math.max(3, size * 0.1), borderRadius: 999 }}>
        {/* Faint tint of the fill colour for the track. Used to be `${color}26`
            (hex alpha), but `color` now resolves to `rgb(...)` on web (oklch is
            rasterised to sRGB in useThemeColor), and `rgb(…)26` isn't a valid
            colour — so the tint is a sibling layer at 15% opacity instead. */}
        <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: color, opacity: 0.15 }} />
        <View style={{ height: '100%', borderRadius: 999, backgroundColor: color, width: `${p}%` }} />
      </View>
    </View>
  );
}

function DotMatrix({ size, speed, color, reduce }: PartProps) {
  const n = 3;
  const gap = size * 0.14;
  const dot = (size - gap * (n - 1)) / n;
  const cells = Array.from({ length: n * n }, (_, idx) => idx);
  return (
    <View className="flex-row flex-wrap" style={{ width: size, gap }}>
      {cells.map((idx) => {
        const x = idx % n;
        const y = Math.floor(idx / n);
        // Diagonal wave: cells light in order of their distance from the corner.
        const delay = ((x + y) / (2 * (n - 1))) * speed * 1000;
        return (
          <MotiView
            key={idx}
            from={{ opacity: 0.2, scale: 0.7 }}
            animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: speed * 500, loop: true, repeatReverse: true, delay }}
            style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }}
          />
        );
      })}
    </View>
  );
}

// Ordered Bayer 4x4 matrix — the classic dithering threshold pattern.
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function Dither({ size, speed, color, reduce }: PartProps) {
  const n = 4;
  const gap = Math.max(1, size * 0.05);
  const cell = (size - gap * (n - 1)) / n;
  return (
    <View className="flex-row flex-wrap" style={{ width: size, gap }}>
      {BAYER_4.map((order, idx) => (
        <MotiView
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed matrix cells, order never changes
          key={idx}
          from={{ opacity: 0.1 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1 }}
          transition={{
            type: 'timing',
            duration: speed * 500,
            loop: true,
            repeatReverse: true,
            delay: (order / BAYER_4.length) * speed * 1000,
          }}
          style={{ width: cell, height: cell, backgroundColor: color }}
        />
      ))}
    </View>
  );
}

function Comet({ size, speed, color, reduce }: PartProps) {
  const head = size * 0.2;
  const r = size / 2 - head / 2;
  const trail = [0, 1, 2, 3, 4, 5];
  return (
    <MotiView
      from={{ rotate: '0deg' }}
      animate={reduce ? { opacity: 0.5 } : { rotate: '360deg' }}
      transition={
        reduce
          ? { type: 'timing', duration: 700, loop: true, repeatReverse: true }
          : { type: 'timing', duration: speed * 1000, loop: true, repeatReverse: false }
      }
      style={{ width: size, height: size }}
    >
      {trail.map((i) => {
        const scale = 1 - i * 0.13;
        const sz = head * scale;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: sz,
              height: sz,
              marginLeft: -sz / 2,
              marginTop: -sz / 2,
              borderRadius: sz / 2,
              backgroundColor: color,
              opacity: 1 - i * 0.16,
              transform: [{ rotate: `${-i * 15}deg` }, { translateY: -r }],
            }}
          />
        );
      })}
    </MotiView>
  );
}

function Newton({ size, speed, color, reduce }: PartProps) {
  const d = size * 0.2;
  const out = d * 1.1;
  const balls = [0, 1, 2, 3, 4];
  // Only the end balls move: left slides out and back, then right — the impact
  // appears to jump the three still middle balls.
  const moves: Record<number, number[]> = { 0: [0, -out, 0, 0], 4: [0, 0, out, 0] };
  return (
    <View className="flex-row items-center justify-center" style={{ height: d }}>
      {balls.map((i) => {
        const move = moves[i];
        return (
          <MotiView
            key={i}
            from={{ translateX: 0 }}
            animate={reduce || !move ? { translateX: 0 } : { translateX: move }}
            transition={{ type: 'timing', duration: speed * 1500, loop: true, repeatReverse: false }}
            style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: color }}
          />
        );
      })}
    </View>
  );
}

function Helix({ size, speed, color, reduce }: PartProps) {
  const rows = 7;
  const dot = size * 0.14;
  const amp = size * 0.32;
  return (
    <View style={{ width: size, height: size }}>
      {Array.from({ length: rows }, (_, r) => {
        const top = (r / (rows - 1)) * (size - dot);
        const delay = (r / rows) * speed * 1000;
        return (
          <MotiView
            key={`row-${top}`}
            from={{ translateX: amp, scale: 1, opacity: 1 }}
            animate={reduce ? { opacity: 0.6, translateX: 0, scale: 1 } : { translateX: -amp, scale: 0.5, opacity: 0.45 }}
            transition={{ type: 'timing', duration: speed * 500, loop: true, repeatReverse: true, delay }}
            style={{
              position: 'absolute',
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: color,
              left: size / 2 - dot / 2,
              top,
            }}
          />
        );
      })}
    </View>
  );
}
