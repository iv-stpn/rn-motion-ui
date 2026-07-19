// biome-ignore lint/style/noExcessiveLinesPerFile: carousel geometry, item render, and auto-rotate logic are tightly coupled
import { useReducedMotion } from '@rn-motion-ui/hooks/use-reduced-motion';
import { Children, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  PanResponder,
  type PanResponderGestureState,
  Platform,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// Soft settle spring for the snap/glide (mirrors the web GLIDE feel).
const GLIDE_SPRING = { stiffness: 90, damping: 18, mass: 1 };

// Flick / momentum constants (mirror the reference implementation).
const FLICK_MOMENTUM = 0.45;
const MAX_FLICK_ITEMS = 6;

// Cylinder projection angles (radians). THETA_EDGE is the wall angle of the
// last visible slot; THETA_CLAMP caps how far off-front an item can swing.
const THETA_EDGE = (72 * Math.PI) / 180;
const THETA_CLAMP = (95 * Math.PI) / 180;

// Minimal web-only wheel types — the RN package tsconfig omits the DOM lib, so
// the browser `WheelEvent`/`addEventListener` globals aren't available here.
type WebWheelEvent = { deltaX: number; deltaY: number; preventDefault: () => void };
type PassiveListenerOptions = { passive: boolean };
type WebWheelTarget = {
  addEventListener: (type: 'wheel', listener: (e: WebWheelEvent) => void, opts?: PassiveListenerOptions) => void;
  removeEventListener: (type: 'wheel', listener: (e: WebWheelEvent) => void) => void;
};

// On web the host node exposes DOM wheel listeners; narrow to that shape by
// probing for the methods at runtime instead of asserting with a cast.
function isWheelTarget(node: unknown): node is WebWheelTarget {
  return (
    node !== null &&
    typeof node === 'object' &&
    typeof Reflect.get(node, 'addEventListener') === 'function' &&
    typeof Reflect.get(node, 'removeEventListener') === 'function'
  );
}

// Web-only style props (userSelect/touchAction) aren't in RN's ViewStyle; type
// the constant once so usage sites stay cast-free.
type WebViewStyle = ViewStyle & { userSelect?: string; touchAction?: string };
const WEB_STAGE_STYLE: WebViewStyle = { userSelect: 'none', touchAction: 'pan-y' };

export type CylinderCarouselVariant = 'concave' | 'convex';

export type CylinderCarouselProps = {
  /** Each top-level child becomes one item on the cylinder wall. */
  children: ReactNode;
  /** Item box size in px (square). */
  itemSize?: number;
  /** How many item slots span the visible arc (controls angular spacing). */
  visibleItems?: number;
  /**
   * "convex" (default): outside of the cylinder — front item biggest/raised.
   * "concave": inside — front item smallest/dipped, edges larger.
   */
  variant?: CylinderCarouselVariant;
  /** Scale of the smallest item; the biggest reaches 1. */
  minScale?: number;
  /** Items rolled per item-width dragged. >1 reads lighter/freer. */
  dragSpeed?: number;
  /** Curve depth in px between the center item and the edges. Defaults to 35% of itemSize. */
  arc?: number;
  /** Snap to the nearest item when the roll settles. */
  snap?: boolean;
  /** Roll on its own until interacted with. */
  autoRotate?: boolean;
  /** Auto-roll speed in items per second. */
  autoRotateSpeed?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Stage height in px. Defaults to `itemSize`. */
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A rotating cylinder carousel.
 *
 * Each item is projected onto a cylinder wall as a flat 2D transform
 * (translateX + translateY + scale) — no `rotateY`. `concave` (inside of the
 * cylinder) puts the smallest item at the center and grows toward the edges;
 * `convex` (outside) puts the biggest item at the center. The horizontal
 * position uses a perspective projection `sin(θ)/(cos(θ)+k)` for concave and
 * linear spacing for convex; the vertical offset is a parabola (`arc`). Items
 * are scaled between `minScale` and 1 by their distance from center. Interaction
 * is drag (PanResponder) + wheel on web — there is no hover on touch. `snap`,
 * `autoRotate`, `variant`, `minScale`, `arc` and `onIndexChange` are preserved.
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: 3-D geometry, gesture, and layout logic integrated in one component
// biome-ignore lint/style/useExportsLast: component exported before internal CylinderItem helper — collocated for readability
export function CylinderCarousel({
  children,
  itemSize = 200,
  visibleItems = 5,
  variant = 'convex',
  minScale = 0.55,
  dragSpeed = 1,
  arc: arcProp,
  snap = true,
  autoRotate = false,
  autoRotateSpeed = 0.4,
  defaultIndex = 0,
  onIndexChange,
  height,
  style,
  testID,
}: CylinderCarouselProps) {
  const reduce = useReducedMotion();
  const items = useMemo(() => Children.toArray(children), [children]);
  const count = items.length;

  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  const scroll = useSharedValue(defaultIndex);
  const draggingRef = useRef(false);
  const indexRef = useRef(defaultIndex);

  const convex = variant === 'convex';
  const stageWidth = width || 800;
  const halfWidth = stageWidth / 2;
  // Half the number of item slots + 1 — controls how fast items shrink/spread.
  const edgeOffset = (visibleItems + 1) / 2;

  // Fit the item box to the stage: sum the scales of the visible slots and
  // shrink so the whole spread stays inside ~65% of the width.
  let scaleSum = 0;
  for (let i = 0; i < visibleItems; i += 1) {
    const t = Math.abs(i - (visibleItems - 1) / 2) / edgeOffset;
    scaleSum += convex ? 1 - (1 - minScale) * t : minScale + (1 - minScale) * t;
  }
  const size = Math.min(itemSize, (stageWidth * 0.65) / scaleSum);

  // px per item slot — the drag/wheel unit and the convex linear spacing.
  const gap = stageWidth / (visibleItems + 1);
  const arc = arcProp ?? size * 0.35;

  // Concave perspective projection params: map an item's angular offset θ to a
  // screen x via sin(θ)/(cos(θ)+k), fitting the edge item to the stage width.
  const alpha = THETA_EDGE / edgeOffset;
  const kConst = Math.max(0.2, (minScale - Math.cos(THETA_EDGE)) / (1 - minScale));
  const projection = (halfWidth * (Math.cos(THETA_EDGE) + kConst)) / Math.sin(THETA_EDGE);

  const stageHeight = height ?? size + arc;

  // Fire onIndexChange on the UI thread via animated reaction (replaces setInterval).
  useAnimatedReaction(
    () => scroll.value,
    (v: number) => {
      if (count === 0) return;
      const idx = ((Math.round(v) % count) + count) % count;
      if (idx !== indexRef.current) {
        indexRef.current = idx;
        onIndexChange?.(idx);
      }
    },
  );

  // Live params ref — updated every render so PanResponder (created once) sees
  // current values without being recreated.
  const paramsRef = useRef({ gap, dragSpeed, snap, reduce });
  paramsRef.current = { gap, dragSpeed, snap, reduce };

  // startScroll: scroll position at the moment the gesture began.
  const startScrollRef = useRef(0);

  const settle = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e: GestureResponderEvent, g: PanResponderGestureState) => Math.abs(g.dx) > 2,

      // Capture scroll position at gesture start — critical for correct drag math.
      onPanResponderGrant: () => {
        draggingRef.current = true;
        startScrollRef.current = scroll.value;
      },

      // gestureState.dx is total x translation from gesture start (px).
      // Subtract from the *start* position so there is no drift or overshoot.
      onPanResponderMove: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        const { gap: pg, dragSpeed: ds } = paramsRef.current;
        scroll.value = startScrollRef.current - (g.dx * ds) / pg;
      },

      // gestureState.vx: instantaneous velocity in px/ms at release.
      onPanResponderRelease: (_e: GestureResponderEvent, g: PanResponderGestureState) => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        const { gap: pg, dragSpeed: ds, snap: sn, reduce: rm } = paramsRef.current;
        // Convert px/ms → items/s; negate because dragging right scrolls back.
        const velocity = (-g.vx * ds * 1000) / pg;
        const projected = scroll.value + Math.max(-MAX_FLICK_ITEMS, Math.min(MAX_FLICK_ITEMS, velocity * FLICK_MOMENTUM));
        const target = sn ? Math.round(projected) : projected;
        if (rm) scroll.value = target;
        else scroll.value = withSpring(target, { ...GLIDE_SPRING, velocity });
      },

      // Release dragging lock if another responder takes over.
      onPanResponderTerminate: () => {
        draggingRef.current = false;
      },
    }),
  ).current;

  // Web: wheel/trackpad scroll support. The RN package tsconfig omits the DOM
  // lib, so type the handle/event minimally rather than reaching for globals.
  const viewRef = useRef<View>(null);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // biome-ignore lint/plugin: non-passive DOM wheel listener must be attached imperatively as a side effect — the RN synthetic handler is passive and can't prevent page scroll
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node: unknown = viewRef.current;
    if (!isWheelTarget(node)) return;

    const onWheel = (e: WebWheelEvent) => {
      e.preventDefault();
      const { gap: pg, dragSpeed: ds, snap: sn, reduce: rm } = paramsRef.current;
      // Prefer horizontal delta; fall back to vertical (trackpad two-finger scroll).
      const rawDelta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      scroll.value += (rawDelta * ds) / pg;

      // Debounce snap: wait for wheel events to stop before snapping.
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
      if (sn)
        wheelTimeoutRef.current = setTimeout(() => {
          const target = Math.round(scroll.value);
          if (rm) scroll.value = target;
          else scroll.value = withSpring(target, GLIDE_SPRING);
        }, 150);
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
  }, [scroll]);

  // Auto-roll: increment the shared value each frame while idle.
  // biome-ignore lint/plugin: requestAnimationFrame loop driving the auto-rotate cannot be expressed without useEffect
  useEffect(() => {
    if (!autoRotate || reduce || count === 0) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!draggingRef.current) scroll.value += autoRotateSpeed * dt;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate, autoRotateSpeed, reduce, count, scroll]);

  return (
    <View
      ref={viewRef}
      testID={testID}
      onLayout={onLayout}
      className="relative w-full overflow-hidden"
      style={[
        { height: stageHeight },
        style,
        // Web: prevent text selection and yield horizontal pointer events to
        // PanResponder so drag gestures aren't cancelled by the browser.
        Platform.OS === 'web' && WEB_STAGE_STYLE,
      ]}
      {...settle.panHandlers}
    >
      {items.map((item, i) => (
        <CylinderItem
          // biome-ignore lint/suspicious/noArrayIndexKey: items are positional and stable
          key={i}
          scroll={scroll}
          index={i}
          count={count}
          alpha={alpha}
          k={kConst}
          projection={projection}
          gap={gap}
          edgeOffset={edgeOffset}
          minScale={minScale}
          convex={convex}
          arc={arc}
          halfWidth={halfWidth}
          itemSize={size}
        >
          {item}
        </CylinderItem>
      ))}
    </View>
  );
}

function CylinderItem({
  scroll,
  index,
  count,
  alpha,
  k,
  projection,
  gap,
  edgeOffset,
  minScale,
  convex,
  arc,
  halfWidth,
  itemSize,
  children,
}: {
  scroll: SharedValue<number>;
  index: number;
  count: number;
  alpha: number;
  k: number;
  projection: number;
  gap: number;
  edgeOffset: number;
  minScale: number;
  convex: boolean;
  arc: number;
  halfWidth: number;
  itemSize: number;
  children: ReactNode;
}) {
  // Signed offset from the front slot, wrapped into [-count/2, count/2] so items
  // loop continuously around the cylinder.
  const offset = useSharedValue(index);
  useAnimatedReaction(
    () => scroll.value,
    (v: number) => {
      let o = index - v;
      o -= Math.round(o / count) * count;
      offset.value = o;
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    const o = offset.value;

    // Horizontal position.
    // Concave: perspective projection through the inside of the cylinder wall.
    // Convex: linear spacing (outside of the cylinder).
    let x: number;
    if (convex) x = o * gap;
    else {
      const th = Math.max(-THETA_CLAMP, Math.min(THETA_CLAMP, o * alpha));
      x = (projection * Math.sin(th)) / (Math.cos(th) + k);
    }

    // Scale: convex shrinks toward the edges, concave grows toward the edges.
    const t = Math.min(Math.abs(o) / edgeOffset, THETA_CLAMP / THETA_EDGE);
    const scale = convex ? 1 - (1 - minScale) * t : minScale + (1 - minScale) * t;

    // Vertical parabola: arc*0.5 at the extremes, 0 at center. Concave dips down,
    // convex arches up.
    const tNorm = x / halfWidth;
    const valley = arc * (0.5 - tNorm * tNorm);
    const y = convex ? -valley : valley;

    // Fully off-stage items stop painting.
    const display = Math.abs(x) > halfWidth + itemSize ? ('none' as const) : ('flex' as const);

    return {
      position: 'absolute' as const,
      top: '50%',
      left: '50%',
      width: itemSize,
      height: itemSize,
      marginLeft: -itemSize / 2,
      marginTop: -itemSize / 2,
      zIndex: Math.round(scale * 100),
      transform: [{ translateX: x }, { translateY: y }, { scale }],
      display,
    };
  });

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
