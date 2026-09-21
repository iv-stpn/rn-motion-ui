import {
  type ComponentType,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type LayoutChangeEvent, Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { LinearTransition, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useSafeInsets } from '../../../hooks/use-safe-insets';
import { cn } from '../../../lib/cn';
import { EASE_IN_OUT, EASE_OUT, SPRING_SWAP, SPRING_UNROLL } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { PresenceContext, usePresenceContext } from '../../../moti/presence/animate-presence-context';
import type { ThemeToken } from '../../../theme/use-theme-color';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';

/** What an activity's accent colours: its icon, and its progress fill when it has one. */
// biome-ignore lint/style/useExportsLast: the tone union heads the module, above the maps it keys, so a reader meets the domain before its tables
export type ActivityIslandTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

type IslandContextValue = {
  /** Id of the activity the shell is showing, or `null` while idle. */
  state: string | null;
  /** The shell's testID, so each state can derive its own. */
  testID?: string;
};

const IslandContext = createContext<IslandContextValue | null>(null);

/**
 * The bar is a black slab on purpose — it is the device-bezel surface, not a
 * themed one — so its ink is white and does not flip with the color scheme.
 */
const TONE_ICON_TOKEN: Record<ActivityIslandTone, ThemeToken> = {
  neutral: 'white',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

/** Progress fill per tone. Static literals — the uniwind scanner reads these. */
const TONE_FILL_CLASSNAME: Record<ActivityIslandTone, string> = {
  neutral: 'bg-white',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

/**
 * Vertical padding inside the bar. Applied inline rather than as `py-*` so the
 * device's top inset can be added to it — and so it can't collide with a
 * className-derived padding of the same property.
 */
const BAR_PAD_Y = 12;

/**
 * How far the bar's content travels as it rolls in and out. Everything in the bar
 * moves in one direction — upward — so a state change reads as a ticker: the old
 * row leaves through the top edge while the new one rises into its place.
 */
const BAR_ROLL = 10;

/** The content starts a hair small and settles, so the land has some weight to it. */
const BAR_CONTENT_SCALE = 0.97;

/** Content timings. Entrances settle on {@link SPRING_UNROLL}; exits are fast so the outgoing row is gone before the incoming one lands. */
const ENTER_MS = 240;
const EXIT_MS = 140;
const REDUCE_MS = 80;

/** The bar's own unroll and retract, in milliseconds — see {@link UNROLL}. */
const UNROLL_MS = 300;
const RETRACT_MS = 240;

/**
 * When to release a bar that is on its way out: the retract, plus a frame of
 * slack. The collapse is a `layout` transition with no completion callback, so
 * the release is timed — and releasing flush with the last frame clips it.
 */
const COLLAPSE_MS = RETRACT_MS + 60;

/**
 * A fixed pure-black drop, so the bar reads as sitting above the screen it
 * pushed down. Theme-exempt: the bar is black in both schemes, so its shadow is
 * too — the `shadow-surface-N` ladder tints a themed surface and would be the
 * wrong recipe.
 */
const BAR_SHADOW = Platform.select({
  default: {
    shadowColor: '#000' /* theme-exempt: fixed pure-black drop */,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 16,
  },
  web: { boxShadow: '0px 10px 24px rgba(0,0,0,0.28)' /* theme-exempt: fixed pure-black drop */ },
});

const FAST_EXIT = { type: 'timing', duration: EXIT_MS, easing: EASE_OUT } as const;
const REDUCE_ENTER = { type: 'timing', duration: 0 } as const;
const REDUCE_EXIT = { type: 'timing', duration: REDUCE_MS } as const;

/** Whether an optional prop was given a value — `null` and `undefined` both count as nothing. */
function isGiven<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * The unroll, and the push that goes with it.
 *
 * A `layout` transition does not animate real layout — it measures the frame
 * before and after, applies the new frame at once, and animates a transform to
 * cover the difference. So the bar and the screen below it need the *same*
 * transition for the push to read as one surface: the screen is wrapped in one
 * too, animating its own displaced frame down into place while the bar inflates.
 *
 * A timing transition rather than a spring on purpose: Reanimated's web
 * implementation compiles a layout transition into keyframes with a duration and
 * an easing and drops the spring's physics entirely, so a curve is the only
 * thing both platforms render the same way. (The curve itself is native-only:
 * web can only name one of eight CSS easings, and a bezier is not among them, so
 * the unroll reads linear there — as it does for every other `layout` transition
 * in this package. The springs live in the content layer, where they run on
 * both, and the duration carries the motion on web.)
 */
const UNROLL = LinearTransition.duration(UNROLL_MS).easing(EASE_OUT);

/** Closing: slower off the screen than on, so the collapse settles instead of snapping away. */
const RETRACT = LinearTransition.duration(RETRACT_MS).easing(EASE_IN_OUT);

/** The layout transition for the current phase; `undefined` snaps, under reduced motion. */
function phaseLayout(reduce: boolean, isPresent: boolean) {
  if (reduce) return;
  return isPresent ? UNROLL : RETRACT;
}

type BarProps = {
  children: ReactNode;
  accessibilityLabel?: string;
  safeArea: boolean;
  testID?: string;
  /** The height the bar is holding, owned by the shell. See the shell's note on why. */
  height: number;
  /** Reports how tall the bar's content lays out, so the shell can hold the bar at that height. */
  onContentHeight: (height: number) => void;
};

/**
 * The bar itself — the black slab.
 *
 * Two layers, and the split is load-bearing:
 *  - The outer `Animated.View` holds the height and clips. That height is a plain
 *    style driven by the shell's state, and its change rides a `layout`
 *    transition: animating `height` through `useAnimatedStyle` is dropped by Yoga
 *    on Fabric and the bar would collapse to nothing (the constraint AnimatedList
 *    documents). The height itself lands at once — it is real layout, which is
 *    what pushes the screen — and the unroll is the transform the transition
 *    paints over it.
 *  - The inner `Animated.View` is absolutely positioned, so it is measured at its
 *    natural height even while the outer sits at zero — a normal-flow child of a
 *    height-0 container reports 0 on Android — and it carries the style-only
 *    polish (opacity, translateY, scale), which stays safe on Fabric.
 */
function Bar({ children, accessibilityLabel, safeArea, testID, height, onContentHeight }: BarProps) {
  const reduce = useReducedMotion();
  const insets = useSafeInsets();
  const [isPresent, safeToUnmount] = usePresenceContext();

  // The presence value flips mid-flight during an exit, so keep the latest in a
  // ref for the release timer and for the layout callback's guard.
  const presentRef = useRef(isPresent);
  presentRef.current = isPresent;
  const releaseRef = useRef(safeToUnmount);
  releaseRef.current = safeToUnmount;

  // Content polish. Style props only: the roll-in is what the clipping unroll
  // reveals, so it starts below its resting place and rises into it.
  const opacity = useSharedValue(reduce ? 1 : 0);
  const roll = useSharedValue(reduce ? 0 : BAR_ROLL);
  const scale = useSharedValue(reduce ? 1 : BAR_CONTENT_SCALE);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: roll.value }, { scale: scale.value }],
  }));

  // Exit: the content escapes upward and fades while the holder collapses under
  // it. The collapse itself rides the layout transition, so release the bar on a
  // timer matched to that transition.
  // biome-ignore lint/plugin: the exit has to fire the moment presence flips false — an imperative side effect on shared values plus a release timer, not derivable from render state and not mount-only
  useEffect(() => {
    if (isPresent) return;
    const duration = reduce ? REDUCE_MS : EXIT_MS;
    opacity.value = withTiming(0, { duration, easing: EASE_OUT });
    roll.value = withTiming(-BAR_ROLL, { duration, easing: EASE_OUT });
    const id = setTimeout(() => releaseRef.current?.(), COLLAPSE_MS);
    return () => clearTimeout(id);
  }, [isPresent, reduce, opacity, roll]);

  // Enter polish: the first layout pass reports a height, then the content rises
  // into the space the unroll just opened for it. This is where the spring lives:
  // the unroll itself is a keyframed curve on both platforms, so the overshoot
  // that makes the bar feel like it inflates comes from the content landing on
  // SPRING_UNROLL — it shoots a little past its resting row, then settles.
  // biome-ignore lint/plugin: enter polish is an imperative side effect on shared values, fired once when the measured height first lands — not derivable from render state, not mount-only
  useEffect(() => {
    if (!isPresent || height <= 0) return;
    opacity.value = withTiming(1, { duration: reduce ? 0 : ENTER_MS, easing: EASE_OUT });
    roll.value = withSpring(0, SPRING_UNROLL);
    scale.value = withSpring(1, SPRING_UNROLL);
  }, [height, isPresent, reduce, opacity, roll, scale]);

  // Report the content's own height rather than holding it: the shell has to
  // re-render in the same commit the bar's height changes in, or the screen it
  // pushes moves without React ever updating it — and a `layout` transition only
  // animates nodes that were updated. Nothing is reported on the way out, when
  // the bar is collapsing and its content is already leaving.
  const onContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const measured = event.nativeEvent.layout.height;
      if (measured <= 0 || !presentRef.current) return;
      onContentHeight(measured);
    },
    [onContentHeight],
  );

  return (
    <Animated.View
      layout={phaseLayout(reduce, isPresent)}
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      testID={testID ? `${testID}-bar` : undefined}
      // `z-50` is what keeps the drop over the screen: the bar is first in the
      // flow, and without a z-index the screen below would paint over the shadow
      // spilling onto it.
      className="z-50 overflow-hidden rounded-b-3xl bg-black"
      style={[{ height }, BAR_SHADOW]}
    >
      <Animated.View
        onLayout={onContentLayout}
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, transformOrigin: 'top center' }, contentStyle]}
      >
        <View className="px-4" style={{ paddingTop: (safeArea ? insets.top : 0) + BAR_PAD_Y, paddingBottom: BAR_PAD_Y }}>
          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

type SlotProps = { children: ReactNode; className?: string; style?: StyleProp<ViewStyle>; testID?: string };

/**
 * Content slot for one bar state. Reads the presence context to pull itself out
 * of flow while exiting — faking motion's `popLayout` (Moti's `AnimatePresence`
 * has no such mode) so the bar springs to the incoming content's height instead
 * of momentarily holding the height of both. The context is read directly
 * (`useContext`) instead of `usePresenceContext`: the latter registers a second
 * presence child that would never report completion and strand the key in its
 * exiting set, and MotiView already registers one internally.
 */
function ContentSlot({ children, className, style, testID }: SlotProps) {
  const reduce = useReducedMotion();
  const presence = useContext(PresenceContext);
  const exiting = presence ? !presence.isPresent : false;

  return (
    <MotiView
      testID={testID}
      from={reduce ? { opacity: 0 } : { opacity: 0, translateY: BAR_ROLL }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, translateY: -BAR_ROLL }}
      transition={reduce ? REDUCE_ENTER : SPRING_SWAP}
      exitTransition={reduce ? REDUCE_EXIT : FAST_EXIT}
      // Anchored to the bar's content box: leaving content rolls up over the
      // incoming state, without contributing to the height the bar springs to.
      style={[exiting ? { position: 'absolute', top: 0, left: 0, right: 0 } : null, style]}
      className={className}
    >
      {children}
    </MotiView>
  );
}

type ProgressTrackProps = { value: number; tone: ActivityIslandTone };

/** The hairline progress track under a state's text row. */
function ProgressTrack({ value, tone }: ProgressTrackProps) {
  const reduce = useReducedMotion();
  const filled = Math.max(0, Math.min(1, value));
  return (
    <View className="h-1 w-full overflow-hidden rounded-full bg-white/20">
      <MotiView
        className={cn('h-full w-full', TONE_FILL_CLASSNAME[tone])}
        // Grows out of the left edge: a bare `scaleX` scales around the centre,
        // so the bar would read as shrinking toward the middle as it fills.
        style={{ transformOrigin: 'left center' }}
        from={{ scaleX: reduce ? filled : 0 }}
        animate={{ scaleX: filled }}
        transition={{ type: 'timing', duration: reduce ? 0 : 420, easing: EASE_OUT }}
      />
    </View>
  );
}

export type ActivityIslandProps = {
  /** Id of the activity to show. `null` falls back to `idle`. */
  state: string | null;
  /** The screen the bar sits above. Give it `flex-1` to fill what the bar leaves. */
  children?: ReactNode;
  /** Bar content while no activity is active. Omit to take the bar off screen when idle. */
  idle?: ReactNode;
  /** `ActivityIslandState` elements, one per activity id. */
  states?: ReactNode;
  /** Also pad the bar under the device's top safe-area inset. @default true */
  safeArea?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Accessible name for the bar, e.g. "Activity". */
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * ActivityIsland — a full-screen shell with an activity bar at the top of it.
 *
 * Where `DynamicIsland` is a pill that grows out of a notch, this is the bar
 * form: it wraps the whole screen (`children`) and sits flush against the top
 * edge with everything else laid out under it. Raising an activity **unrolls**
 * the bar, pushing the screen down by exactly what the bar gains — the bar is
 * never covering anything, so the screen keeps its scroll position and stays
 * fully interactive while an activity runs. It paints above that screen
 * (`z-50`), which is what lets its drop fall across the content it displaced.
 *
 * Give it an `idle` node to keep the bar on screen when nothing is running (the
 * resting topbar); omit it and the bar unrolls away entirely, leaving the screen
 * untouched until an activity starts. Changing `state` rolls the outgoing content
 * up and out while the incoming content rises into place, and eases the bar to
 * the new height — so a state that brings a progress track grows the bar to fit
 * it, and the screen below breathes by the same amount.
 *
 * The bar and the screen run the *same* layout transition, which is what makes
 * the push read as one surface: a `layout` transition does not animate real
 * layout (it applies the new frame at once and covers the difference with a
 * transform), so animating only the bar would have the screen jump to its new
 * place on the first frame. Animating both keeps them locked together, and the
 * bounce that sells the inflate comes from the content landing on a spring
 * inside the bar, where springs survive on both platforms.
 *
 * The bar's fill is black in both color schemes, the way a device bezel is, so
 * its ink is white and the accent per state comes from `ActivityIslandTone`.
 */
export function ActivityIsland({
  state,
  children,
  idle,
  states,
  safeArea = true,
  className,
  style,
  accessibilityLabel,
  testID,
}: ActivityIslandProps) {
  const reduce = useReducedMotion();
  const contextValue = useMemo(() => ({ state, testID }), [state, testID]);
  const idleShowing = state === null && isGiven(idle);
  const showing = state !== null || idleShowing;

  // How tall the bar's content wants to be, and so how far the bar unrolls. It
  // lives here rather than inside the bar because the screen below has to
  // re-render in the same commit the height changes in. A `layout` transition
  // only animates a node React has updated: a sibling that a growing bar pushes
  // moves in real layout without re-rendering at all, and would jump to its new
  // place on the first frame while the bar unrolled smoothly beside it.
  const [contentHeight, setContentHeight] = useState(0);

  // The bar is unmounted while nothing shows, so the height it last measured
  // must not outlive it: an incoming bar would open at the old height instead of
  // growing into it, and only the screen would animate.
  // biome-ignore lint/plugin: the bar's unmount is not something this component is told about — it is AnimatePresence's business — so the measurement is dropped when the phase that owned it ends
  useEffect(() => {
    if (!showing) setContentHeight(0);
  }, [showing]);

  const reportContentHeight = useCallback((measured: number) => {
    setContentHeight((held) => (held === measured ? held : measured));
  }, []);

  return (
    <IslandContext.Provider value={contextValue}>
      <View className={cn('flex-1', className)} style={style} testID={testID}>
        <AnimatePresence>
          {showing ? (
            <Bar
              key="bar"
              accessibilityLabel={accessibilityLabel}
              height={showing ? contentHeight : 0}
              onContentHeight={reportContentHeight}
              safeArea={safeArea}
              testID={testID}
            >
              <View className="relative">
                <AnimatePresence initial={false}>
                  {idleShowing ? <ContentSlot key="idle">{idle}</ContentSlot> : null}
                </AnimatePresence>
                {states}
              </View>
            </Bar>
          ) : null}
        </AnimatePresence>

        {children ? (
          <Animated.View layout={phaseLayout(reduce, showing)} className="flex-1">
            {children}
          </Animated.View>
        ) : null}
      </View>
    </IslandContext.Provider>
  );
}

export type ActivityIslandStateProps = {
  /** Matches the shell's `state` prop when active. */
  id: string;
  /** Leading glyph, tinted with `tone`. */
  icon?: ComponentType<IconProps>;
  /** Primary line. */
  title: ReactNode;
  /** Secondary line under the title. */
  detail?: ReactNode;
  /** Accent for the icon and the progress fill. @default 'neutral' */
  tone?: ActivityIslandTone;
  /** `0`–`1` progress. Adds an animated track under the text row. */
  progress?: number;
  /** Trailing content — a button, a counter, a spinner. */
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * One activity the bar can show: a glyph, two lines of copy, an optional
 * progress track, and a trailing slot. Renders nothing unless its `id` is the
 * shell's active `state`; the shell rolls between them.
 */
export function ActivityIslandState({
  id,
  icon,
  title,
  detail,
  tone = 'neutral',
  progress,
  children,
  className,
  style,
}: ActivityIslandStateProps) {
  const ctx = useContext(IslandContext);
  if (!ctx) throw new Error('ActivityIslandState must be used inside <ActivityIsland>');
  const active = ctx.state === id;

  return (
    <AnimatePresence initial={false}>
      {active ? (
        <ContentSlot key={id} testID={ctx.testID ? `${ctx.testID}-${id}` : undefined} className={className} style={style}>
          <View className="gap-2">
            <View className="flex-row items-center gap-3">
              {icon ? <ThemedIcon icon={icon} token={TONE_ICON_TOKEN[tone]} size={18} /> : null}
              <View className="flex-1 gap-0.5">
                <Text size="sm" weight="semibold" className="text-white" numberOfLines={1}>
                  {title}
                </Text>
                {isGiven(detail) ? (
                  <Text size="xs" className="text-white opacity-60" numberOfLines={1}>
                    {detail}
                  </Text>
                ) : null}
              </View>
              {children}
            </View>
            {isGiven(progress) ? <ProgressTrack tone={tone} value={progress} /> : null}
          </View>
        </ContentSlot>
      ) : null}
    </AnimatePresence>
  );
}
