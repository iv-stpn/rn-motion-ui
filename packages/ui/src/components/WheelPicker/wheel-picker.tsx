// biome-ignore lint/style/noExcessiveLinesPerFile: scroll physics, item layout, and accessibility all share animation values
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

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
const WHEEL_SETTLE = 120; // ms of wheel idle before snapping to a row
const MIN_SCALE = 0.4; // floor so edge rows stay legible on tall windows
// Soft spring for the settle; low stiffness so a flick coasts before it rests.
const SETTLE_SPRING = { stiffness: 100, damping: 18, mass: 1 } as const;
// Minimal web-only DOM types — the RN package tsconfig omits the DOM lib, so the
// browser wheel/keyboard globals aren't declared here.
type WebWheelEvent = { deltaY: number; deltaMode: number; preventDefault: () => void };
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
  onPress?: () => void;
};

// One row on the drum wall. Its angular offset from the front is `θ = (index −
// scroll)·itemAngle`; from that: translateY = R·sinθ bunches it toward the
// horizon, rotateX(−θ) tilts it onto the wall, scale/opacity ≈ cosθ foreshortens
// and fades it. Past the horizon (|offset| > hideBeyond, θ ≥ 90°) it stops
// painting so the back of the drum never bleeds through the front.
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
}: WheelPickerRowProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const offset = index - scroll.value;
    if (Math.abs(offset) > hideBeyond) return { opacity: 0, display: 'none' as const };
    const theta = offset * itemAngle * DEG;
    const cos = Math.cos(theta);
    return {
      display: 'flex' as const,
      opacity: Math.max(0, cos),
      transform: [
        { perspective: 600 },
        { translateY: radius * Math.sin(theta) },
        { rotateX: `${-offset * itemAngle}deg` },
        { scale: Math.max(MIN_SCALE, cos) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        { position: 'absolute', left: 0, right: 0, top: center, height: itemHeight, justifyContent: 'center' },
        animatedStyle,
      ]}
    >
      <Text
        accessibilityRole="button"
        onPress={onPress}
        className="text-center font-medium text-foreground"
        style={{ height: itemHeight, lineHeight: itemHeight }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

function optionValue(option: WheelPickerOption) {
  return typeof option === 'string' ? option : option.value;
}
function optionLabel(option: WheelPickerOption) {
  return typeof option === 'string' ? option : option.label;
}

export type WheelPickerOption = string | { label: string; value: string };

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
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
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
    const r = itemHeight / Math.sin(angle * DEG);
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
  // UI-thread flags read by the reaction: `live` gates whether crossing a row
  // emits (true only while the finger/wheel drives it, not during a settle);
  // `lastEmitted` dedupes so we fire once per row, on the UI thread.
  const live = useSharedValue(false);
  const lastEmitted = useSharedValue(currentIndex);

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

  // Emit the centre row as it crosses, on the UI thread, but only while a
  // gesture is live — the settle spring below runs with `live` off and commits
  // its own final value, so a coast never machine-guns intermediate rows.
  useAnimatedReaction(
    () => scroll.value,
    (s) => {
      if (!live.value) return;
      const idx = Math.round(Math.max(0, Math.min(s, last)));
      if (idx !== lastEmitted.value) {
        lastEmitted.value = idx;
        runOnJS(emit)(idx);
      }
    },
  );

  // Spring to an integer detent and commit it. `live` is off for the duration so
  // the reaction stays quiet; we emit the landing row synchronously (so taps and
  // key steps report immediately) and dedupe handles the rest.
  const glideTo = useCallback(
    (target: number) => {
      const to = clamp(Math.round(target), 0, last);
      live.value = false;
      command.current = to;
      lastEmitted.value = to;
      scroll.value = reduceRef.current ? withTiming(to, { duration: 0 }) : withSpring(to, SETTLE_SPRING);
      emit(to);
    },
    [last, emit, scroll, live, lastEmitted],
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

  // Drag. Taps fall through (onStart returns false) so a row press still selects;
  // only a real vertical move captures the responder and drives the drum. dy is
  // the total travel since grant, so subtracting it from the start position never
  // drifts. Past the ends the delta is damped to 0.3 for a rubber-band pull.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) =>
        !(disabledRef.current || reduceRef.current) && Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        cancelAnimation(scroll);
        draggingRef.current = true;
        interactingRef.current = true;
        startScroll.current = scroll.value;
        live.value = true;
        lastEmitted.value = Math.round(clamp(scroll.value, 0, last));
      },
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        let next = startScroll.current - g.dy / itemHeight;
        if (next < 0) next *= 0.3;
        else if (next > last) next = last + (next - last) * 0.3;
        scroll.value = next;
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
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
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
    },
    [scroll],
  );
  const pad = (height - itemHeight) / 2;

  // Reduced motion: no drum, no physics. A plain snap-scroll list of pressable
  // rows with a centre band — the value is emitted on tap or when the scroll
  // settles on a row.
  if (reduce)
    return (
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: currentValue }}
        testID={testID ?? 'wheel-picker'}
        className="relative overflow-hidden rounded-3xl bg-muted"
        style={[{ height, opacity: disabled ? 0.5 : 1 }, style]}
      >
        <View
          pointerEvents="none"
          className="absolute inset-x-2 z-10 rounded-xl bg-foreground/[0.06]"
          style={{ top: pad, height: itemHeight }}
        />
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
              >
                {optionLabel(option)}
              </Text>
            );
          })}
        </ScrollView>
      </View>
    );

  return (
    <View
      ref={containerRef}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: currentValue }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={handleAccessibilityAction}
      testID={testID ?? 'wheel-picker'}
      className="relative overflow-hidden rounded-3xl bg-muted"
      style={[
        { height, opacity: disabled ? 0.5 : 1 },
        // Web: block page scroll / text selection so the drag drives the drum.
        Platform.OS === 'web' && WEB_CONTAINER_STYLE,
        style,
      ]}
      {...pan.panHandlers}
    >
      {/* Centre band: a rounded, inset selection pill seating the front row. */}
      <View
        pointerEvents="none"
        className="absolute inset-x-2 z-10 rounded-xl bg-foreground/[0.06]"
        style={{ top: pad, height: itemHeight }}
      />
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
        />
      ))}
    </View>
  );
}
