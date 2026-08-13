// biome-ignore-all lint/style/noExcessiveLinesPerFile: scroll physics, item layout, and accessibility all share animation values

import { type Ref, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PanResponder,
  type PanResponderGestureState,
  Platform,
  ScrollView,
  type StyleProp,
  Text,
  Vibration,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import type { SurfaceLevel } from '../../../lib/elevated';
import { Card } from '../../display/Card/card';

// RN vs web: the reference wheel is a CSS 3D drum — rows seated on a cylinder via
// `translateZ`, the whole list spun with `rotateX` — driven by a hand-rolled
// deceleration/rubber-band loop. RN has no `translateZ`, so (like the sibling
// CylinderCarousel) each row is projected onto the drum with the flat transforms
// RN does support: `translateY = R·sinθ` bunches rows toward the horizon,
// `rotateX(-θ)` tilts them onto the wall, `scale/opacity ≈ cosθ` foreshortens and
// fades. A single reanimated `scroll` shared value (a float row index) is the one
// source of truth; drag runs through PanResponder, wheel/keys through native
// listeners on web, and the settle is a spring that snaps to an integer detent
// with a little overshoot. The CSS mask-image edge fade is dropped (no RN mask) —
// the per-row opacity curve stands in for it.

const DEG = Math.PI / 180;
// Physics tuned for an iOS-like flick in whole-row units (mirrors the reference).
const DECELERATION = 0.000_42; // rows/ms², how fast a flick bleeds off
const MAX_VELOCITY = 0.18; // rows/ms, caps a hard fling
const WHEEL_SENS = 0.012; // rows per pixel of wheel delta
// Chromium/WebKit expose a legacy `wheelDelta` (a uniform −120 per mouse detent)
// that `deltaY` in pixel mode does not match — 4px on a macOS mouse, 100px on
// Windows for the same detent. Scale through it so a detent moves the drum the
// same amount everywhere; browsers without it fall back to the deltaY path below.
const WHEEL_PX_PER_NOTCH = 100; // px a Windows-Chromium detent reports, the scale WHEEL_SENS is tuned to
const WHEEL_SETTLE = 120; // ms of wheel idle before snapping to a row
const MIN_SCALE = 0.4; // floor so edge rows stay legible on tall windows
// Finger travel (px) below which a touch still reads as a tap, not a drag.
const TAP_SLOP = 3;
// Soft spring for the settle; low stiffness so a flick coasts before it rests.
const SETTLE_SPRING = { stiffness: 100, damping: 18, mass: 1 } as const;
// Minimal web-only DOM types — the RN package tsconfig omits the DOM lib, so the
// browser wheel/keyboard globals aren't declared here.
type WebWheelEvent = { deltaY: number; deltaMode: number; wheelDelta?: number; preventDefault: () => void };
type WebKeyEvent = { key: string; preventDefault: () => void };
type PassiveListenerOptions = { passive: boolean };
type WebNode = {
  addEventListener: {
    (t: 'wheel', l: (e: WebWheelEvent) => void, o?: PassiveListenerOptions): void;
    (t: 'keydown', l: (e: WebKeyEvent) => void): void;
  };
  removeEventListener: {
    (t: 'wheel', l: (e: WebWheelEvent) => void): void;
    (t: 'keydown', l: (e: WebKeyEvent) => void): void;
  };
  tabIndex: number;
};

// Narrow the row host node to its DOM shape by probing for the listener methods,
// so no cast is needed to reach the web-only wheel/keyboard API.
function isWebNode(node: unknown): node is WebNode {
  return (
    node !== null &&
    typeof node === 'object' &&
    typeof Reflect.get(node, 'addEventListener') === 'function' &&
    typeof Reflect.get(node, 'removeEventListener') === 'function'
  );
}

// Web Audio: a short oscillator burst on each row crossing. The DOM lib is not
// included in the RN tsconfig, so the AudioContext API is narrowed by hand.
type AudioOscLike = {
  connect: (d: unknown) => void;
  frequency: { value: number };
  start: (t: number) => void;
  stop: (t: number) => void;
};
type AudioGainLike = {
  connect: (d: unknown) => void;
  gain: {
    setValueAtTime: (v: number, t: number) => void;
    exponentialRampToValueAtTime: (v: number, t: number) => void;
  };
};
type AudioCtxLike = {
  createOscillator: () => AudioOscLike;
  createGain: () => AudioGainLike;
  destination: unknown;
  currentTime: number;
  close: () => Promise<void>;
};

function tryMakeAudioCtx(): AudioCtxLike | null {
  if (Platform.OS !== 'web') return null;
  const Ctor: unknown = Reflect.get(globalThis, 'AudioContext');
  if (typeof Ctor !== 'function') return null;
  try {
    // biome-ignore lint/plugin: AudioContext is absent from the RN tsconfig DOM lib; narrowed by typeof check above
    return new (Ctor as new () => AudioCtxLike)();
  } catch {
    return null;
  }
}

// Plays a short sine burst — frequency and gain tuned to read as a soft tick
// rather than a harsh click.
function webTick(ctx: AudioCtxLike) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 1100;
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.035);
}

// Web-only style props (userSelect/touchAction and a `grab` cursor) aren't in RN's
// ViewStyle. Typed as `object` so it stays assignable to the ViewStyle style array
// (ViewStyle's props are all optional) without an `as` assertion at the call site.
const WEB_CONTAINER_STYLE: object = { userSelect: 'none', touchAction: 'none', cursor: 'grab' };

type WheelPickerRowProps = {
  label: string;
  index: number;
  scroll: SharedValue<number>;
  itemHeight: number;
  itemAngle: number;
  radius: number;
  hideBeyond: number;
  /** Top of the centre window (px) — where a row with offset 0 seats. */
  center: number;
  /** Render at full opacity regardless of angle (used for the clipped bright centre drum). */
  opaque?: boolean;
  onPress?: () => void;
  /**
   * Left undefined for the bright centre drum, which is an `aria-hidden` second
   * copy of these same rows: naming both would make every option match twice.
   */
  testID?: string;
};

// One row on the drum wall. Its angular offset from the front is `θ = (index −
// scroll)·itemAngle`; from that:
//   translateY = R·sinθ  — places the row's centre on the cylinder surface
//   scaleY     = cosθ    — compresses height, rows thin to a sliver at the horizon
//   opacity    = cos²θ   — fades toward the edge so the drum reads as curved
//
// Crucially, only Y is scaled (not X): the cylinder axis is horizontal, so width
// never foreshortens. Uniform `scale` was the prior bug — it made items shrink in
// both axes and look like they were zooming out rather than wrapping around a drum.
// rotateX+perspective is dropped: per-element perspective creates a different
// vanishing point for every row (wrong), whereas translateY+scaleY naturally
// converges all rows to the same horizon line (correct).
function WheelPickerRow({
  label,
  index,
  scroll,
  itemHeight,
  itemAngle,
  radius,
  hideBeyond,
  center,
  onPress,
  opaque = false,
  testID,
}: WheelPickerRowProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const offset = index - scroll.value;
    if (Math.abs(offset) > hideBeyond) return { opacity: 0, display: 'none' as const };
    const theta = offset * itemAngle * DEG;
    const cos = Math.cos(theta);
    return {
      display: 'flex' as const,
      // opaque rows (bright centre drum) always render at full opacity; the outer
      // drum uses cos² for a steeper falloff so edge rows read as "behind the wall".
      opacity: opaque ? 1 : Math.max(0, cos * cos),
      transform: [{ translateY: radius * Math.sin(theta) }, { scaleY: Math.max(MIN_SCALE, cos) }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          pointerEvents: 'box-none',
          position: 'absolute',
          left: 0,
          right: 0,
          top: center,
          height: itemHeight,
          justifyContent: 'center',
        },
        animatedStyle,
      ]}
    >
      <Text
        accessibilityRole="button"
        onPress={onPress}
        className="text-center font-medium text-foreground"
        style={{ height: itemHeight, lineHeight: itemHeight }}
        testID={testID}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

// Rubber-banded drum position for a finger that has travelled `dy` px from
// `start` (a float row index): the drum follows 1:1 between the ends, and the
// overshoot is damped to 0.3 for a rubber-band pull. Shared by the web pan and
// the native RNGH gesture so the two transports cannot drift apart.
function dragToScroll(start: number, dy: number, itemHeight: number, last: number): number {
  let next = start - dy / itemHeight;
  if (next < 0) next *= 0.3;
  else if (next > last) next = last + (next - last) * 0.3;
  return next;
}

// Pixel delta of a wheel event, normalised to one unit across browsers. Pixel
// mode (`deltaMode` 0) is not directly comparable — see WHEEL_PX_PER_NOTCH — so
// prefer the legacy `wheelDelta` when present; lines fall back to a px estimate.
function wheelPixels(e: WebWheelEvent): number {
  if (typeof e.wheelDelta === 'number') return (-e.wheelDelta / 120) * WHEEL_PX_PER_NOTCH;
  if (e.deltaMode === 1) return e.deltaY * 16;
  return e.deltaY;
}

function optionValue(option: WheelPickerOption) {
  return typeof option === 'string' ? option : option.value;
}
function optionLabel(option: WheelPickerOption) {
  return typeof option === 'string' ? option : option.label;
}

// Centre selection band. Rounded in both variants — the pill is what marks the
// selected row, so it survives dropping the container. Only the inset differs:
// `card` pulls in from the surface edge (inset-x-2), `plain` uses a tighter
// inset-x-1 so a narrow wheel (a 56px day column) still gets a band wide enough
// to read, and two wheels butted together leave a small gutter between pills
// instead of fusing into one bar. Static literals (never composed at runtime) so
// the Tailwind/uniwind scanner sees every class.
const BAND_CLASS: Record<WheelPickerVariant, string> = {
  card: 'absolute inset-x-2 rounded-xl bg-foreground/[0.06]',
  plain: 'absolute inset-x-1 rounded-xl bg-foreground/[0.06]',
};
const REDUCED_BAND_CLASS: Record<WheelPickerVariant, string> = {
  card: 'absolute inset-x-2 z-10 rounded-xl bg-surface-selected',
  plain: 'absolute inset-x-1 z-10 rounded-xl bg-surface-selected',
};

type WheelPickerFrameProps = ViewProps & { variant: WheelPickerVariant; elevation: SurfaceLevel; ref?: Ref<View> };

// The outer shell. `card` is an elevated Card surface; `plain` is a bare
// transparent View — no fill, no shadow, no radius — so a parent can frame
// several wheels as one control. Both keep `overflow-hidden` (rows near the
// horizon would otherwise paint past the window) and no padding (rows are
// absolutely positioned against the container box, so padding offsets the drum).
function WheelPickerFrame({ variant, elevation, className, ...props }: WheelPickerFrameProps) {
  if (variant === 'plain') return <View className={cn('relative overflow-hidden bg-transparent', className)} {...props} />;
  return <Card className={cn('relative overflow-hidden p-0', className)} elevation={elevation} {...props} />;
}

export type WheelPickerOption = string | { label: string; value: string };

/**
 * `card` — self-contained control: elevated Card surface, inset rounded centre pill.
 * `plain` — no container: transparent, no surface, no shadow, no radius of its own.
 * The rounded centre pill stays (it's what marks the selection), just on a tighter
 * inset. Use this for each wheel when composing several into one control — a date
 * picker, say — and let the parent supply the single frame.
 */
export type WheelPickerVariant = 'card' | 'plain';

export type WheelPickerProps = {
  options: WheelPickerOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Rows visible through the window, odd. More = taller window / flatter curve. Default 5. */
  visibleCount?: number;
  /** Row height in px. Default 36. */
  itemHeight?: number;
  disabled?: boolean;
  /** Play a short tick sound on each row crossing while dragging. Default false. */
  sound?: boolean;
  /** Container treatment. Default `card`. See {@link WheelPickerVariant}. */
  variant?: WheelPickerVariant;
  /** Surface elevation of the outer Card container (1–8). Default 3. Ignored when `variant="plain"`. */
  elevation?: SurfaceLevel;
  /** Additional UniWind class names forwarded to the container. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /**
   * Base testID. Each row takes `-option-<value>`, under either variant and under
   * reduced motion, so one selector works everywhere.
   *
   * Only the interactive rows are named. The drum paints a second, `aria-hidden`
   * copy of every row for the bright centre band, and naming those would leave
   * each option matching twice.
   *
   * @default 'wheel-picker'
   */
  testID?: string;
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: scroll physics, snapping, and accessibility require shared animation refs
export function WheelPicker({
  options,
  value,
  defaultValue,
  onValueChange,
  visibleCount = 5,
  itemHeight = 36,
  disabled = false,
  sound = false,
  variant = 'card',
  elevation = 3,
  className,
  style,
  accessibilityLabel,
  testID,
}: WheelPickerProps) {
  const reduce = useReducedMotion();
  const controlled = value !== undefined;
  const last = options.length - 1;

  const indexOf = useCallback(
    (v: string | undefined) => {
      const i = options.findIndex((o) => optionValue(o) === v);
      return i < 0 ? 0 : i;
    },
    [options],
  );

  const [internal, setInternal] = useState(() => defaultValue ?? value);
  const currentValue = controlled ? value : internal;
  const currentIndex = indexOf(currentValue);

  // Cylinder geometry. Each row spans `itemAngle`; rows past `hideBeyond` sit
  // behind the horizon (θ ≥ 90°) and stop painting. RN has no translateZ, so the
  // drum is faked flat: seat row i at translateY = radius·sin(θ). Radius is set
  // from sinθ (not the reference's tanθ) so the centre rows land ~itemHeight
  // apart without the perspective magnification the CSS version leans on.
  const { itemAngle, radius, height, hideBeyond } = useMemo(() => {
    const rowsEachSide = Math.max(1, Math.floor(visibleCount / 2));
    const cutoff = rowsEachSide + 1;
    const angle = 90 / cutoff;
    // tan formula (mirrors the CSS-3D reference): each row face is tangent to the
    // drum circle, so consecutive rows' screen-Y positions differ by
    // radius·sin(angle) = itemHeight·cos(angle) < itemHeight — the foreshortening
    // that makes it look like a real cylinder.  sin formula gave equal spacing at
    // every angle, which reads as a flat infinite list.
    const r = itemHeight / Math.tan(angle * DEG);
    return {
      itemAngle: angle,
      radius: r,
      hideBeyond: cutoff,
      height: Math.round(2 * r * Math.sin(rowsEachSide * angle * DEG) + itemHeight),
    };
  }, [visibleCount, itemHeight]);

  // The one source of truth: scroll position as a float row index. Drag/wheel
  // write it directly; the settle springs it to an integer detent.
  const scroll = useSharedValue(currentIndex);
  // UI-thread flag read by the reaction: `live` is true only while the
  // finger/wheel drives the drum (never during a settle), and gates the tick.
  const live = useSharedValue(false);

  // JS-thread mirrors. `emitted` dedupes onValueChange; `interacting` gates the
  // external-value sync effect so it never fights a gesture; `command` is the
  // last index we told the spring to settle on, so the sync effect doesn't
  // re-glide to a target already in flight.
  const emitted = useRef(currentValue);
  const interactingRef = useRef(false);
  const command = useRef(currentIndex);
  const draggingRef = useRef(false);
  const startScroll = useRef(currentIndex);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  // Sound: mirror prop to a ref so the worklet-scheduled tick can read it
  // without a stale capture, and lazily create the AudioContext on first use
  // (browsers require a user gesture before audio can play).
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const audioCtxRef = useRef<AudioCtxLike | null>(null);
  // UI-thread dedup: only fire one tick per row crossed.
  const lastTicked = useSharedValue(currentIndex);

  const emit = useCallback(
    (i: number) => {
      const opt = options[clamp(i, 0, last)];
      if (!opt) return;
      const v = optionValue(opt);
      if (v === emitted.current) return;
      emitted.current = v;
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [options, last, controlled, onValueChange],
  );

  // Fires on the RN JS thread each time a new row crosses the centre while the
  // user is actively dragging. Web uses a short Web Audio sine burst; native
  // falls back to a brief Vibration pulse (audible on Android, silent on iOS
  // without expo-haptics).
  const playTickOnRN = useCallback(() => {
    if (!soundRef.current) return;
    if (Platform.OS === 'web') {
      if (!audioCtxRef.current) audioCtxRef.current = tryMakeAudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx) webTick(ctx);
      return;
    }
    Vibration.vibrate(10);
  }, []);

  // Tick on the UI thread as each row crosses the centre while a gesture is
  // live. The value itself is never emitted here — it is committed once, when
  // the gesture ends and `glideTo` locks in the landing row — so a drag or
  // coast never machine-guns intermediate rows through onValueChange.
  useAnimatedReaction(
    () => scroll.value,
    (s) => {
      if (!live.value) return;
      const idx = Math.round(Math.max(0, Math.min(s, last)));
      if (idx !== lastTicked.value) {
        lastTicked.value = idx;
        scheduleOnRN(playTickOnRN);
      }
    },
  );

  // Commit the value the moment a gesture ends and the landing row is locked,
  // then spring the drum to it. The value is `Math.round`ed here, so it can no
  // longer change with the spring's remaining motion — committing at this point
  // (rather than on the spring's completion callback) keeps the value snappy
  // instead of waiting out the settle's long mathematical tail.
  const glideTo = useCallback(
    (target: number) => {
      const to = clamp(Math.round(target), 0, last);
      live.value = false;
      command.current = to;
      emit(to);
      scroll.value = reduceRef.current ? withTiming(to, { duration: 0 }) : withSpring(to, SETTLE_SPRING);
    },
    [last, emit, scroll, live],
  );

  // Project where a flick coasts to under constant deceleration, then settle.
  const fling = useCallback(
    (velocity: number) => {
      const from = scroll.value;
      if (from < 0 || from > last) {
        glideTo(clamp(Math.round(from), 0, last)); // rubber-band back in
        return;
      }
      const v = clamp(velocity, -MAX_VELOCITY, MAX_VELOCITY);
      const coast = (Math.sign(v) * (v * v)) / (2 * DECELERATION);
      glideTo(from + coast);
    },
    [glideTo, last, scroll],
  );

  const step = useCallback((by: number) => glideTo(Math.round(scroll.value) + by), [glideTo, scroll]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => emit(Math.round(e.nativeEvent.contentOffset.y / itemHeight)),
    [emit, itemHeight],
  );

  const handleAccessibilityAction = useCallback(
    (e: AccessibilityActionEvent) => {
      if (disabled) return;
      if (e.nativeEvent.actionName === 'increment') step(1);
      else if (e.nativeEvent.actionName === 'decrement') step(-1);
    },
    [disabled, step],
  );

  // Drag, on two transports.
  //
  // Web keeps the PanResponder: react-native-web's responder system lets a view
  // claim the touch in the start capture phase and beat an enclosing ScrollView,
  // and a row press still fires (react-native-web dispatches `onPress` from the
  // DOM click, independent of the responder). Native uses an RNGH pan instead —
  // on New Architecture iOS a JS PanResponder cannot beat a native ScrollView
  // (the scroll view cancels the child's touch and scrolls anyway, RN #51970),
  // but RNGH rides native gesture recognizers, so its pan activates and blocks
  // the scroll the way a real picker would. A tap never activates the native pan,
  // so it falls through to the row's own `onPress`; the web PanResponder keeps a
  // small slop so a tap there doesn't nudge the drum either.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => !(disabledRef.current || reduceRef.current),
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) =>
        !(disabledRef.current || reduceRef.current) && Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        cancelAnimation(scroll);
        draggingRef.current = false;
        interactingRef.current = true;
        startScroll.current = scroll.value;
        live.value = true;
      },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        if (!draggingRef.current && Math.abs(g.dy) < TAP_SLOP) return;
        draggingRef.current = true;
        // dy is the total travel since grant, so subtracting it from the start
        // position never drifts.
        scroll.value = dragToScroll(startScroll.current, g.dy, itemHeight, last);
      },
      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        draggingRef.current = false;
        interactingRef.current = false;
        // vy is px/ms; a downward drag (vy > 0) rolls to earlier rows, so negate.
        fling(-g.vy / itemHeight);
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        interactingRef.current = false;
        fling(0);
      },
    }),
  ).current;

  // Native RNGH pan (see above). `.runOnJS(true)` keeps the drag on the JS thread,
  // matching the PanResponder path and leaving `fling`/`glideTo` callable directly.
  // `disabled`/`reduce` return `null` so no gesture is attached and the enclosing
  // ScrollView scrolls freely.
  //
  // RNGH maps the four callbacks differently from a PanResponder: `onBegin` is the
  // touch down (before the pan has proven itself a drag), `onStart` is when the pan
  // *activates* (the finger moved past the slop), and `onUpdate` is movement after
  // that. `draggingRef` therefore flips on `onStart`, not `onBegin`, so a tap that
  // never activates is never mistaken for a cancelled drag.
  const nativePan = useMemo(
    () =>
      Platform.OS === 'web' || disabled || reduce
        ? null
        : Gesture.Pan()
            .runOnJS(true)
            .onBegin(() => {
              cancelAnimation(scroll);
              draggingRef.current = false;
              interactingRef.current = true;
              startScroll.current = scroll.value;
              live.value = true;
            })
            .onStart(() => {
              draggingRef.current = true;
            })
            .onUpdate((e) => {
              scroll.value = dragToScroll(startScroll.current, e.translationY, itemHeight, last);
            })
            .onEnd((e) => {
              draggingRef.current = false;
              interactingRef.current = false;
              // RNGH reports velocity in points/second, the web PanResponder in
              // px/ms — divide by 1000 to land on the same rows/ms scale the fling
              // is tuned against, then negate (a downward drag rolls to earlier rows).
              fling(-e.velocityY / 1000 / itemHeight);
            })
            .onFinalize(() => {
              // Every path out of the gesture lands here, including a tap (which
              // never reached `onEnd`) and a drag the system cut short (a scroll
              // won, the view unmounted) — so always release the interaction flag.
              // Only a drag that was cut short needs settling: `onEnd` already
              // handled the normal release, and settling a tap would revert the
              // row's own `glideTo`.
              if (draggingRef.current) fling(0);
              draggingRef.current = false;
              interactingRef.current = false;
            }),
    [disabled, reduce, scroll, live, last, itemHeight, fling],
  );

  // Web wheel + keyboard. The RN synthetic wheel handler is passive (can't block
  // page scroll), so bind natively and non-passive on the container node.
  const containerRef = useRef<View>(null);
  const wheelSettle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // biome-ignore lint/plugin: non-passive DOM wheel/keyboard listener must be attached imperatively as a side effect — the RN synthetic handler is passive and can't block scroll
  useEffect(() => {
    if (Platform.OS !== 'web' || disabled || reduce) return;
    const node = containerRef.current;
    if (!isWebNode(node)) return;
    node.tabIndex = 0;

    const onWheel = (e: WebWheelEvent) => {
      e.preventDefault();
      cancelAnimation(scroll);
      interactingRef.current = true;
      live.value = true;
      const px = wheelPixels(e);
      scroll.value = clamp(scroll.value + px * WHEEL_SENS, 0, last);
      if (wheelSettle.current) clearTimeout(wheelSettle.current);
      wheelSettle.current = setTimeout(() => {
        interactingRef.current = false;
        glideTo(Math.round(scroll.value));
      }, WHEEL_SETTLE);
    };
    const onKey = (e: WebKeyEvent) => {
      const at = Math.round(scroll.value);
      const map: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, Home: -at, End: last - at };
      const by = map[e.key];
      if (by !== undefined) {
        e.preventDefault();
        step(by);
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('keydown', onKey);
      if (wheelSettle.current) clearTimeout(wheelSettle.current);
    };
  }, [disabled, reduce, last, scroll, live, glideTo, step]);

  // Follow controlled/value changes from outside — but never mid-gesture, and not
  // when the spring is already settling on that same row.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sync only on external value change
  // biome-ignore lint/plugin: syncing an externally-controlled value to an Animated shared value requires a side effect
  useEffect(() => {
    if (interactingRef.current) return;
    emitted.current = currentValue;
    const target = indexOf(currentValue);
    if (command.current === target && Math.abs(scroll.value - target) < 0.001) return;
    glideTo(target);
  }, [currentValue]);

  // biome-ignore lint/plugin: cleanup-only effect — cancels in-flight Reanimated animation and pending timeout on unmount
  useEffect(
    () => () => {
      cancelAnimation(scroll);
      if (wheelSettle.current) clearTimeout(wheelSettle.current);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: AudioContext.close() may reject on immediate close; swallow errors on unmount
      audioCtxRef.current?.close().catch(() => {});
    },
    [scroll],
  );
  const pad = (height - itemHeight) / 2;

  // Reduced motion: no drum, no physics. A plain snap-scroll list of pressable
  // rows with a centre band — the value is emitted on tap or when the scroll
  // settles on a row.
  if (reduce)
    return (
      <WheelPickerFrame
        variant={variant}
        elevation={elevation}
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: currentValue }}
        testID={testID ?? 'wheel-picker'}
        className={cn(className, disabled && 'opacity-50')}
        style={[{ height }, style]}
      >
        <View className={cn(REDUCED_BAND_CLASS[variant], 'pointer-events-none z-10')} style={{ top: pad, height: itemHeight }} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          scrollEnabled={!disabled}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          contentOffset={{ x: 0, y: currentIndex * itemHeight }}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          contentContainerStyle={{ paddingTop: pad, paddingBottom: pad }}
        >
          {options.map((option) => {
            const v = optionValue(option);
            return (
              <Text
                key={v}
                accessibilityRole="button"
                onPress={disabled ? undefined : () => emit(options.indexOf(option))}
                className={
                  v === currentValue ? 'text-center font-medium text-foreground' : 'text-center font-medium text-muted-foreground'
                }
                style={{ height: itemHeight, lineHeight: itemHeight }}
                testID={`${testID ?? 'wheel-picker'}-option-${v}`}
              >
                {optionLabel(option)}
              </Text>
            );
          })}
        </ScrollView>
      </WheelPickerFrame>
    );

  // The drum itself. `collapsable={false}` keeps the host from being flattened
  // away, which is what strands the gesture and lets an enclosing ScrollView
  // swallow the drag — the same reason Draggable pins it. Pan handlers attach
  // only on web; native gets the RNGH pan wrapped around this below.
  const drum = (
    <WheelPickerFrame
      ref={containerRef}
      variant={variant}
      elevation={elevation}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: currentValue }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={handleAccessibilityAction}
      testID={testID ?? 'wheel-picker'}
      className={className}
      collapsable={false}
      style={[
        { height, opacity: disabled ? 0.5 : 1 },
        // Web: block page scroll / text selection so the drag drives the drum.
        Platform.OS === 'web' && WEB_CONTAINER_STYLE,
        style,
      ]}
      {...(Platform.OS === 'web' ? pan.panHandlers : {})}
    >
      {/* Centre band: borderless rounded selection pill, tighter inset under
          `plain` so butted-together wheels each keep a distinct pill. */}
      <View className={cn(BAND_CLASS[variant], 'pointer-events-none z-10')} style={{ top: pad, height: itemHeight }} />
      {options.map((option, i) => (
        <WheelPickerRow
          key={optionValue(option)}
          label={optionLabel(option)}
          index={i}
          scroll={scroll}
          itemHeight={itemHeight}
          itemAngle={itemAngle}
          radius={radius}
          hideBeyond={hideBeyond}
          center={pad}
          onPress={disabled ? undefined : () => glideTo(i)}
          testID={`${testID ?? 'wheel-picker'}-option-${optionValue(option)}`}
        />
      ))}
      {/* Bright centre drum — same rows, clipped to one row height and drawn at
          full opacity so the selected label stands out against the dimmed drum.
          `center={0}` seats row 0 at the top of this clip view, which itself
          sits at `top: pad` — identical to the outer drum's centre.
          aria-hidden: purely decorative duplicate; outer drum rows are the
          interactive/accessible ones. */}
      <View
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 z-[8] overflow-hidden"
        style={{ top: pad, height: itemHeight }}
      >
        {options.map((option, i) => (
          <WheelPickerRow
            key={`b${optionValue(option)}`}
            label={optionLabel(option)}
            index={i}
            scroll={scroll}
            itemHeight={itemHeight}
            itemAngle={itemAngle}
            radius={radius}
            hideBeyond={hideBeyond}
            center={0}
            opaque={true}
          />
        ))}
      </View>
    </WheelPickerFrame>
  );

  // Native wraps the drum in an RNGH GestureDetector so the pan blocks an
  // enclosing ScrollView; web keeps the PanResponder's handlers on the drum.
  return Platform.OS !== 'web' && nativePan ? <GestureDetector gesture={nativePan}>{drum}</GestureDetector> : drum;
}
