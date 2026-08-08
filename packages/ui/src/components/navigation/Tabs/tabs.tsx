// biome-ignore-all lint/style/noExcessiveLinesPerFile: one compound component — root, list, trigger and the three panel animations belong in the same module

import { cva } from 'class-variance-authority';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  type LayoutRectangle,
  type NativeSyntheticEvent,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Easing } from 'react-native-reanimated';
import { useMountEffect } from '../../../hooks/use-mount-effect';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { cn } from '../../../lib/cn';
import { H_INTERACTIVE, INTERACTIVE_RADIUS, PX_INTERACTIVE, TEXT_INTERACTIVE } from '../../../lib/radius';
import { MotiView } from '../../../moti/components/view';
import { type MotiTransitionProp, mergeTransition, TIMING_INSTANT } from '../../../theme/motion';

const TAB_INDICATOR_SPRING = { type: 'spring' as const, stiffness: 170, damping: 24, mass: 1.2 };

// ── Content-panel motion ─────────────────────────────────────────────────────
// `fade` and `dropIn` are enter-only: TabsContent renders nothing for the tab it
// isn't showing, so a switch is an unmount plus a fresh mount, with no exiting
// layer to co-ordinate.
// `slide` is the exception, because a page swap only reads as one if the page you
// left is pushed out as the new one arrives. So the panel being left keeps its
// subtree mounted for the length of the push, drops out of the layout flow
// immediately — the incoming panel needs that space — and finishes the trip as an
// absolutely positioned layer over the spot it held.
const FADE_TRANSITION = { type: 'timing' as const, duration: 180 };
// Linear, unlike the rest of the library's tweens: a push is two layers held a
// container width apart, so any ease reads as the pair being dragged by a hand
// that speeds up and slows down. A constant rate reads as one strip of pages
// moving past a window, which is the illusion being sold.
const SLIDE_TRANSITION = { type: 'timing' as const, duration: 280, easing: Easing.linear };
const DROP_IN_TRANSITION = { type: 'spring' as const, stiffness: 260, damping: 20, mass: 0.9 };
/** Fall distance of a dropping panel (px). */
const DROP_OFFSET = 18;
/** Rise of the default fade (px) — a settle, not a slide. */
const FADE_RISE = 4;

/** Neutral resting pose shared by all three animations. */
const CONTENT_SETTLED = { opacity: 1, translateX: 0, translateY: 0, scale: 1 };

type Variant = 'pill' | 'underline' | 'segment';

type Layout = LayoutRectangle;

/** -1 when the newly selected tab sits left of the previous one, +1 otherwise. */
type Direction = 1 | -1;

type Ctx = {
  value: string;
  setValue: (v: string) => void;
  variant: Variant;
  size: 'sm' | 'md' | 'lg';
  layouts: Record<string, Layout>;
  register: (value: string, layout: Layout) => void;
  reduce: boolean;
  indicatorTransition?: Partial<MotiTransitionProp>;
  contentAnimation: TabsContentAnimation;
  contentTransition?: Partial<MotiTransitionProp>;
  direction: Direction;
  /** The tab being pushed out, until its slide finishes. `null` when nothing is leaving. */
  exiting: string | null;
  /** Measured width of the Tabs root — how far a `slide` panel travels. 0 until first layout. */
  panelWidth: number;
};

type TabsTriggerProps = { value: string; children: ReactNode; testID?: string };

type TabsContentProps = {
  value: string;
  children: ReactNode;
  /** Override the Tabs-level `contentAnimation` for this panel only. */
  animation?: TabsContentAnimation;
  testID?: string;
};

const TabsCtx = createContext<Ctx | null>(null);

function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('Tabs.* must be used inside <Tabs>');
  return ctx;
}

const list = cva('flex-row items-center', {
  variants: {
    variant: {
      pill: 'gap-1 rounded-full bg-muted p-1',
      underline: 'gap-1 border-b border-border',
      segment: 'gap-0 rounded-interactive bg-muted p-0.5',
    },
  },
  defaultVariants: { variant: 'pill' },
});

/**
 * Mount pose for a `fade` / `dropIn` panel: where it starts before settling into
 * {@link CONTENT_SETTLED}. `slide` has its own component ({@link TabsSlidePanel})
 * because its travel is measured, not a constant.
 */
function contentEnterFrom(animation: TabsContentAnimation, reduce: boolean) {
  // Reduced motion keeps the cross-fade (information, not decoration) and drops
  // every transform, so all three animations collapse to the same plain fade.
  if (reduce) return { ...CONTENT_SETTLED, opacity: 0 };
  if (animation === 'dropIn') return { ...CONTENT_SETTLED, opacity: 0, translateY: -DROP_OFFSET, scale: 0.96 };
  return { ...CONTENT_SETTLED, opacity: 0, translateY: FADE_RISE };
}

/** `slide` is absent on purpose — it never reaches this path unless motion is reduced, and then it fades. */
function contentTransitionFor(animation: TabsContentAnimation, reduce: boolean) {
  if (animation === 'dropIn' && !reduce) return DROP_IN_TRANSITION;
  return FADE_TRANSITION;
}

/** How long to hold a slide when the transition is a spring (no duration to read). */
const SPRING_SETTLE_MS = 600;
/** Slack added before releasing a slide, so it never cuts the last frame of travel. */
const SETTLE_MARGIN_MS = 60;

/** Roughly when `transition` stops moving — only needs to be an upper bound. */
function settleDuration(transition: MotiTransitionProp) {
  if (transition.type === 'timing' && typeof transition.duration === 'number') return transition.duration + SETTLE_MARGIN_MS;
  return SPRING_SETTLE_MS + SETTLE_MARGIN_MS;
}

/** The frame a panel occupied while it was in flow, so it can hold that spot once it's pinned. */
type PanelFrame = { top: number; left: number; width: number; height: number };

type TabsSlidePanelProps = {
  children: ReactNode;
  direction: Direction;
  /** True once this panel is the one leaving: it pins to its old frame and travels the other way. */
  exiting: boolean;
  panelWidth: number;
  transition: MotiTransitionProp;
  testID?: string;
};

/**
 * One side of a `slide` push. The same component plays both parts: it enters
 * travelling a full container width in from the side the selection moved
 * towards, and when its tab is deselected `exiting` flips and it travels the
 * rest of the way out in the opposite direction. Two of them on screen at once
 * is the push — the pair moves in lockstep because both read the same
 * `panelWidth` and the same `transition`.
 *
 * Exiting means leaving flow: the panel pins to `absolute` at the frame it last
 * measured, so the entering panel takes its place in the column instead of
 * being pushed down the page.
 *
 * The travel has to be clipped or a page paints outside the Tabs box (and on web
 * can widen the scroll area), but leaving `overflow: hidden` on for good would
 * also cut off shadows and any overlay a panel raises inline. So the clip is
 * scoped to the motion: an entering panel releases it on a timer rather than on
 * the animation callback — the exact release frame is invisible, and a callback
 * that never arrives would leave the panel clipped for good. An outgoing panel
 * just stays clipped; it unmounts at the end of the push.
 */
function TabsSlidePanel({ children, direction, exiting, panelWidth, transition, testID }: TabsSlidePanelProps) {
  // panelWidth is 0 only before the root's first layout pass, i.e. the very first
  // panel. That one has nothing to slide from, so it sits still and fades in —
  // which is what you want on mount anyway — and needs no clip.
  const travel = direction * panelWidth;
  const [enterClip, setEnterClip] = useState(travel !== 0);
  // Where this panel sat while it was in flow. Captured on every layout up to the
  // moment it starts leaving, because from then on the measurements describe the
  // pinned box, not the spot being held.
  const frame = useRef<PanelFrame | null>(null);

  useMountEffect(() => {
    if (travel === 0) return;
    const timer = setTimeout(() => setEnterClip(false), settleDuration(transition));
    return () => clearTimeout(timer);
  });

  const onLayout = useCallback(
    (e: NativeSyntheticEvent<{ layout: Layout }>) => {
      if (exiting) return;
      const { x, y, width, height } = e.nativeEvent.layout;
      frame.current = { top: y, left: x, width, height };
    },
    [exiting],
  );

  const pinned = exiting ? frame.current : null;
  return (
    <View
      onLayout={onLayout}
      // An outgoing page is on its way out: it must not swallow a press meant for
      // the panel replacing it, and it must not be read out a second time.
      aria-hidden={exiting}
      accessibilityElementsHidden={exiting}
      importantForAccessibility={exiting ? 'no-hide-descendants' : 'auto'}
      className={cn(pinned ? 'pointer-events-none absolute mt-0' : 'mt-4', exiting || (enterClip && 'overflow-hidden'))}
    >
      <MotiView
        // Only `animate` moves this panel out: the same MotiView plays both halves,
        // so re-targeting it keeps the travel continuous. `from` is mount-only and
        // would be ignored here anyway.
        from={{ ...CONTENT_SETTLED, opacity: travel === 0 ? 0 : 1, translateX: travel }}
        animate={exiting ? { ...CONTENT_SETTLED, translateX: -travel } : CONTENT_SETTLED}
        transition={transition}
        testID={testID}
      >
        {children}
      </MotiView>
    </View>
  );
}

/** What {@link useTabSwitch} knows about the switch in flight. */
type TabSwitch = {
  /** The value `direction` and `exiting` were computed against. */
  tracked: string;
  /** The tab still on screen playing its push-out, or null when nothing is leaving. */
  exiting: string | null;
  direction: Direction;
};

/**
 * Tracks the tab switch in flight: which way the selection travelled, and which
 * tab is still on screen playing its way out.
 *
 * Both are needed *during* the render that swaps panels — the entering panel
 * bakes the direction into its mount pose, and the outgoing one has to appear in
 * the same commit or there's a frame with the old panel gone and the new one
 * still off-screen. So this adjusts state during render (React's supported
 * pattern for exactly this) rather than in an effect.
 *
 * Direction comes off the triggers' measured rects, not the order panels were
 * declared in, so it holds for controlled changes too: a programmatic jump to a
 * tab slides the same way a press on that tab would.
 */
function useTabSwitch(current: string, layouts: Record<string, Layout>, holdMs: number): TabSwitch {
  const [state, setState] = useState<TabSwitch>({ tracked: current, exiting: null, direction: 1 });

  if (state.tracked !== current) {
    const from = layouts[state.tracked];
    const to = layouts[current];
    setState({ tracked: current, exiting: state.tracked, direction: from && to && to.x < from.x ? -1 : 1 });
  }

  // biome-ignore lint/plugin: dropping the outgoing panel once its push has played out is a timer, which has no render-time equivalent
  useEffect(() => {
    if (state.exiting === null) return;
    const timer = setTimeout(() => setState((prev) => ({ ...prev, exiting: null })), holdMs);
    return () => clearTimeout(timer);
  }, [state.exiting, holdMs]);

  return state;
}

/**
 * How a content panel enters when its tab is selected.
 *
 * - `fade` — cross-fade with a 4 px settle (default).
 * - `slide` — the whole panel travels one full container width, in from the side
 *   the selection moved towards, while the panel it replaces is pushed out the
 *   other way. Reads as a page swap; sized for mobile and modals.
 * - `dropIn` — falls from above on a springy scale-up.
 */
export type TabsContentAnimation = 'slide' | 'fade' | 'dropIn';

export type TabsProps = {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  variant?: Variant;
  /** Height variant — drives the trigger's interactive size token. Default `md`. */
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  /** Additional UniWind class names merged onto the outer wrapper. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * Override the active-indicator slide spring. Partial — only changed fields needed.
   * Default: `MOTION_STANDARD` tuned for tab indicators (stiffness 170, damping 24, mass 1.2).
   */
  indicatorTransition?: Partial<MotiTransitionProp>;
  /** How `TabsContent` panels enter when their tab is selected. Default `fade`. */
  contentAnimation?: TabsContentAnimation;
  /**
   * Override the content-panel transition. Partial — only changed fields needed.
   * Defaults per animation: 180 ms timing (`fade`), 280 ms ease-out (`slide`),
   * spring (`dropIn`).
   */
  contentTransition?: Partial<MotiTransitionProp>;
};

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  variant = 'pill',
  size = 'md',
  children,
  className,
  style,
  testID,
  indicatorTransition,
  contentAnimation = 'fade',
  contentTransition,
}: TabsProps) {
  const reduce = useReducedMotion();
  const [internal, setInternal] = useState(defaultValue ?? '');
  const [layouts, setLayouts] = useState<Record<string, Layout>>({});
  // Measured on the root, not on the panel: a `slide` panel needs its travel
  // distance in the same commit it mounts, and its own width isn't known until a
  // layout pass later. Panels stretch to the root's width, so this is that width.
  const [panelWidth, setPanelWidth] = useState(0);
  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  // How long an outgoing `slide` panel is held on screen: exactly as long as the
  // push takes. Resolved here rather than in the panel because the hold is one
  // timer for the whole Tabs, not one per panel.
  const slideTransition = mergeTransition(SLIDE_TRANSITION, contentTransition);
  const { exiting, direction } = useTabSwitch(current, layouts, settleDuration(slideTransition));

  const setValue = useCallback(
    (v: string) => {
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [controlled, onValueChange],
  );

  const register = useCallback((v: string, layout: Layout) => {
    setLayouts((prev) => {
      const existing = prev[v];
      if (existing && existing.x === layout.x && existing.width === layout.width) return prev;
      return { ...prev, [v]: layout };
    });
  }, []);

  const onLayout = useCallback((e: NativeSyntheticEvent<{ layout: Layout }>) => {
    const next = e.nativeEvent.layout.width;
    setPanelWidth((prev) => (Math.abs(prev - next) < 1 ? prev : next));
  }, []);

  return (
    <TabsCtx.Provider
      value={{
        value: current,
        setValue,
        variant,
        size,
        layouts,
        register,
        reduce,
        indicatorTransition,
        contentAnimation,
        contentTransition,
        direction,
        panelWidth,
        exiting,
      }}
    >
      <View testID={testID} className={cn(className)} style={style} onLayout={onLayout}>
        {children}
      </View>
    </TabsCtx.Provider>
  );
}

export type TabsListProps = {
  children: ReactNode;
  /** Applied to the list; the sliding indicator gets `${testID}-indicator`. */
  testID?: string;
};

export function TabsList({ children, testID }: TabsListProps) {
  const { variant, value, layouts, reduce, indicatorTransition } = useTabs();
  const active = layouts[value];
  const indicatorSpring = mergeTransition(TAB_INDICATOR_SPRING, indicatorTransition);
  // Track whether the indicator has been placed once so the first render jumps
  // directly to the selected tab instead of animating from wherever MotiView
  // initialises (avoids the "slide from tab-1" flash on mount).
  const hasPositioned = useRef(false);
  // biome-ignore lint/plugin: tracking first-commit of `active` requires a post-render hook; no derived-state equivalent is Strict-Mode-safe
  useEffect(() => {
    if (active) hasPositioned.current = true;
  }, [active]);

  let indicatorBorderRadius: number;
  if (variant === 'pill') indicatorBorderRadius = 9999;
  else if (variant === 'segment') indicatorBorderRadius = INTERACTIVE_RADIUS;
  else indicatorBorderRadius = 0;

  return (
    <View className={cn(list({ variant }), 'relative self-start')} testID={testID}>
      {/* Shared-layout indicator: a single MotiView that glides to the active
          trigger's measured rect. Mirrors the web layoutId pill. White for
          pill/segment so trigger text keeps its dark color while the pill is
          still gliding over. */}
      {active ? (
        <MotiView
          animate={{
            translateX: active.x,
            width: active.width,
            translateY: variant === 'underline' ? active.y + active.height - 2 : active.y,
            height: variant === 'underline' ? 2 : active.height,
          }}
          transition={!hasPositioned.current || reduce ? TIMING_INSTANT : indicatorSpring}
          className={cn(
            variant === 'underline' ? 'bg-primary' : 'bg-surface-3 dark:bg-black',
            'pointer-events-none absolute top-0 left-0',
          )}
          testID={testID ? `${testID}-indicator` : undefined}
          style={{ borderRadius: indicatorBorderRadius }}
        />
      ) : null}
      {children}
    </View>
  );
}

export function TabsTrigger({ value, children, testID }: TabsTriggerProps) {
  const { value: current, setValue, size, register } = useTabs();
  const active = current === value;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);

  const onLayout = useCallback(
    (e: NativeSyntheticEvent<{ layout: Layout }>) => register(value, e.nativeEvent.layout),
    [register, value],
  );
  const onPress = useCallback(() => setValue(value), [setValue, value]);
  const onHoverIn = useCallback(() => setHovered(true), []);
  const onHoverOut = useCallback(() => setHovered(false), []);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);
  const onPressIn = useCallback(() => setPressed(true), []);
  const onPressOut = useCallback(() => setPressed(false), []);

  const highlighted = active || hovered || focused || pressed;

  return (
    <Pressable
      accessibilityRole="tab"
      aria-selected={active}
      onPress={onPress}
      onLayout={onLayout}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      onFocus={onFocus}
      onBlur={onBlur}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      className={`${H_INTERACTIVE[size]} ${PX_INTERACTIVE[size]} justify-center`}
      testID={testID}
    >
      <Text
        className={
          highlighted
            ? `font-medium text-foreground ${TEXT_INTERACTIVE.md}`
            : `font-medium text-muted-foreground ${TEXT_INTERACTIVE.md}`
        }
      >
        {children}
      </Text>
    </Pressable>
  );
}

/**
 * The panel for one tab. `fade` and `dropIn` mount only the selected panel, so a
 * switch remounts this subtree and that remount is what plays the enter animation.
 *
 * `slide` is the exception: it stays mounted through the push that carries it off,
 * then unmounts. It renders through {@link TabsSlidePanel} either way, so React
 * keeps the same instance across the switch and the outgoing panel can animate
 * from wherever it is rather than remounting into a new pose.
 */
export function TabsContent({ value, children, animation, testID }: TabsContentProps) {
  const { value: current, reduce, contentAnimation, contentTransition, direction, panelWidth, exiting } = useTabs();
  const resolved = animation ?? contentAnimation;
  const isCurrent = current === value;
  // `slide` needs its own subtree: it clips the travelling panel to the container,
  // which the shared MotiView below can't do (a view can't clip its own transform),
  // and it has to keep rendering while it's the outgoing half of a push.
  if (resolved === 'slide' && !reduce && (isCurrent || exiting === value))
    return (
      <TabsSlidePanel
        direction={direction}
        exiting={!isCurrent}
        panelWidth={panelWidth}
        testID={testID}
        transition={mergeTransition(SLIDE_TRANSITION, contentTransition)}
      >
        {children}
      </TabsSlidePanel>
    );

  if (isCurrent)
    return (
      <MotiView
        from={contentEnterFrom(resolved, reduce)}
        animate={CONTENT_SETTLED}
        transition={mergeTransition(contentTransitionFor(resolved, reduce), contentTransition)}
        testID={testID}
        className="mt-4"
      >
        {children}
      </MotiView>
    );

  return null;
}
