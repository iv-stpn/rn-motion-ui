import { type ComponentType, createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { Easing, LinearTransition } from 'react-native-reanimated';
import type { IconProps } from 'rn-motion-ui-icons/icon-props';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import { useSafeInsets } from '../../../hooks/use-safe-insets';
import { cn } from '../../../lib/cn';
import { EASE_OUT } from '../../../lib/ease';
import { MotiView } from '../../../moti/components/view';
import { AnimatePresence } from '../../../moti/presence/animate-presence';
import { PresenceContext } from '../../../moti/presence/animate-presence-context';
import type { ThemeToken } from '../../../theme/use-theme-color';
import { ThemedIcon } from '../../icon/themed-icon';
import { Text } from '../../typography/Text/text';

/** The accent of an activity's copy, glyph and progress fill. */
// biome-ignore lint/style/useExportsLast: the tone union heads the maps it keys
export type ActivityIslandTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
type IslandContextValue = { state: string | null; testID?: string; switching: boolean };
const IslandContext = createContext<IslandContextValue | null>(null);
const BarView = Platform.OS === 'web' ? View : Animated.View;
const SurfaceView = Platform.OS === 'web' ? View : MotiView;

const TONE_TOKEN: Record<ActivityIslandTone, ThemeToken> = {
  neutral: 'white',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};
const TONE_TEXT: Record<ActivityIslandTone, string> = {
  neutral: 'text-white',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};
const TONE_FILL: Record<ActivityIslandTone, string> = {
  neutral: 'bg-white',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

const OPEN_MS = 480;
const CLOSE_MS = 200;
const LABEL_EXIT_MS = 100;
const CLOSE_DELAY = LABEL_EXIT_MS + 20;
const CONTENT_RADIUS = 24;
const GROW_EASING = Easing.bezier(0.45, 0, 0.55, 1);
const WEB_GROW_EASING = 'cubic-bezier(0.45, 0, 0.55, 1)';
const WEB_CLOSE_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const OPEN_LAYOUT = LinearTransition.duration(OPEN_MS).easing(GROW_EASING);
const CLOSE_LAYOUT = LinearTransition.duration(CLOSE_MS).delay(CLOSE_DELAY).easing(EASE_OUT);
// Drop the row into the opening first, then spread the two groups horizontally.
const LABEL_ENTER = { type: 'timing', duration: 160, delay: 180, easing: EASE_OUT } as const;
const COPY_ENTER = { type: 'timing', duration: 360, delay: 340, easing: EASE_OUT } as const;
const ICON_ENTER = { type: 'timing', duration: 520, delay: 260, easing: GROW_EASING } as const;
// Moti merges exit into entrance: explicitly clear its delay before the surface rises.
const LABEL_EXIT = { type: 'timing', duration: LABEL_EXIT_MS, delay: 0, easing: EASE_OUT } as const;
const SNAP = { type: 'timing', duration: 0 } as const;
// Switching between two activities rolls the row instead of re-entering: the
// outgoing text rolls up out of the clip while the incoming rolls in from below.
const ROLL_DISTANCE = 24;
const ROLL = { type: 'timing', duration: 300, easing: GROW_EASING } as const;

function islandMotion(active: boolean, reduce: boolean) {
  const phaseLayout = active ? OPEN_LAYOUT : CLOSE_LAYOUT;
  const phaseDuration = active ? OPEN_MS : CLOSE_MS;
  const duration = reduce ? 0 : phaseDuration;
  const delay = reduce || active ? 0 : CLOSE_DELAY;
  return {
    layout: reduce || Platform.OS === 'web' ? undefined : phaseLayout,
    surfaceTransition: { type: 'timing', duration, delay, easing: active ? GROW_EASING : EASE_OUT } as const,
    webTransition: {
      transitionDuration: `${duration}ms`,
      transitionDelay: `${delay}ms`,
      transitionTimingFunction: active ? WEB_GROW_EASING : WEB_CLOSE_EASING,
    },
  };
}

function isGiven<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** True while `state` hands off between two activities, not on open/dismiss. */
function useSwitching(state: string | null) {
  const [prev, setPrev] = useState(state);
  const switching = state !== null && prev !== null && prev !== state;
  // biome-ignore lint/plugin: intentional derived-state-in-render (React's getDerivedStateFromProps equivalent); guarded to converge
  if (prev !== state) setPrev(state);
  return switching;
}

type SlotProps = { children: ReactNode; className?: string; style?: StyleProp<ViewStyle>; testID?: string; roll?: boolean };

/** The slot's own enter/exit — a switch rolls, an open drops in then spreads. */
function contentMotion(rolling: boolean, rollExit: boolean, reduce: boolean) {
  if (reduce)
    return {
      from: { opacity: 0 },
      animate: { opacity: 1, translateY: 0 },
      exit: { opacity: 0 },
      transition: SNAP,
      exitTransition: SNAP,
    };
  return {
    from: rolling ? { translateY: ROLL_DISTANCE } : { opacity: 0, translateY: -10 },
    animate: rolling ? { translateY: 0 } : { opacity: 1, translateY: 0 },
    exit: rollExit ? { translateY: -ROLL_DISTANCE } : { opacity: 0 },
    transition: rolling ? ROLL : LABEL_ENTER,
    exitTransition: rollExit ? ROLL : LABEL_EXIT,
  };
}

/** Exiting rows leave flow immediately, so only the incoming row sets the height. */
function ContentSlot({ children, className, style, testID, roll = true }: SlotProps) {
  const reduce = useReducedMotion();
  const presence = useContext(PresenceContext);
  const ctx = useContext(IslandContext);
  const exiting = presence ? !presence.isPresent : false;
  // Latch the entrance at mount so a mid-entrance re-render (the bar resizing
  // for taller content) can't flip a roll back into the open animation.
  const rolling = useRef(roll && ctx?.switching === true).current;
  // The exit rolls only when handing off to another activity, not when the
  // strip is dismissed to idle — read live from the incoming state, which stays
  // put for the whole exit.
  const rollExit = roll && exiting && isGiven(ctx?.state);
  const motion = contentMotion(rolling, rollExit, reduce);
  return (
    <MotiView
      testID={testID}
      from={motion.from}
      animate={motion.animate}
      exit={motion.exit}
      transition={motion.transition}
      exitTransition={motion.exitTransition}
      pointerEvents={exiting ? 'none' : 'auto'}
      accessibilityElementsHidden={exiting}
      importantForAccessibility={exiting ? 'no-hide-descendants' : 'auto'}
      style={[exiting ? { position: 'absolute', top: 0, left: 0, right: 0 } : null, style]}
      className={className}
    >
      {children}
    </MotiView>
  );
}

type ProgressTrackProps = { value: number; tone: ActivityIslandTone };

/** Separate transforms keep the text crisp as the two ends spread apart. */
function RowMotion({ children, className, side }: SlotProps & { side: 'leading' | 'trailing' | 'icon' }) {
  const reduce = useReducedMotion();
  const ctx = useContext(IslandContext);
  const icon = side === 'icon';
  const translateX = side === 'leading' ? 36 : -24;
  // The row rolls as a whole when switching activities, so the per-group spread
  // (and the icon's flip) belongs only to a fresh open. Latched at mount.
  const rolling = useRef(ctx?.switching === true).current;
  const still = reduce || rolling;
  const spreadFrom = icon ? { rotateY: '0deg' } : { translateX };
  const spreadTo = icon ? { rotateY: '360deg' } : { translateX: 0 };
  const restTo = icon ? { rotateY: '0deg' } : { translateX: 0 };
  const spreadTransition = icon ? ICON_ENTER : COPY_ENTER;
  return (
    <MotiView
      className={className}
      from={still ? false : spreadFrom}
      animate={still ? restTo : spreadTo}
      transition={still ? SNAP : spreadTransition}
    >
      {children}
    </MotiView>
  );
}

/** A compact trailing meter, not another line that makes every activity taller. */
function ProgressTrack({ value, tone }: ProgressTrackProps) {
  const reduce = useReducedMotion();
  const filled = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(filled * 100) }}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(filled * 100)}
      className="h-1 w-8 shrink-0 overflow-hidden rounded-full bg-white/20"
    >
      <MotiView
        className={cn('h-full w-full', TONE_FILL[tone])}
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
  /** Screen content. The shell owns the top inset; do not add another inside it. */
  children?: ReactNode;
  /** Optional resting status strip. Omit to leave the normal safe area while idle. */
  idle?: ReactNode;
  /** `ActivityIslandState` elements, one per activity id. */
  states?: ReactNode;
  /** Use the top safe area as space for the bar, rather than adding it above the bar. @default true */
  safeArea?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Surface behind the screen's rounded top corners. @default 'bg-surface-2' */
  contentClassName?: string;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Edge-to-edge activity strip, with the screen rounding away beneath it.
 * Hosts at least 768px wide show a centered floating toast instead, leaving the
 * header and screen geometry unchanged. The breakpoint uses the host width so
 * embedded phone previews retain the compact presentation on desktop.
 * Mount outside a top-padded SafeAreaView: this shell owns the top inset. The
 * strip occupies that inset first; only max(0, rowHeight - inset.top) pushes the
 * screen farther down. The host app owns native status-bar visibility and must
 * allow drawing behind it if it wants to replace the system status strip.
 *
 * Native holders share a Fabric-safe layout transition; web transitions the bar's
 * height directly so its flex sibling follows without scaling the row's text.
 * The screen stays mounted through state changes and keeps its scroll position.
 */
export function ActivityIsland({
  state,
  children,
  idle,
  states,
  safeArea = true,
  className,
  style,
  contentClassName,
  contentStyle,
  accessibilityLabel,
  testID,
}: ActivityIslandProps) {
  const reduce = useReducedMotion();
  const insets = useSafeInsets();
  const inset = safeArea ? insets.top : 0;
  const switching = useSwitching(state);
  const contextValue = useMemo(() => ({ state, testID, switching }), [state, testID, switching]);
  const idleShowing = state === null && isGiven(idle);
  const showing = state !== null || idleShowing;
  const active = state !== null;
  const [floating, setFloating] = useState(false);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setFloating(event.nativeEvent.layout.width >= 768);
  }, []);
  const [contentHeight, setContentHeight] = useState(0);
  const reservedInset = floating ? 0 : inset;
  const height = showing ? Math.max(reservedInset, contentHeight) : reservedInset;
  const { layout, surfaceTransition, webTransition } = islandMotion(active, reduce);
  // Web layout keyframes neither hold the old height during a delay nor support
  // this curve. A height transition keeps the flex sibling in flow throughout.
  const barStyle =
    Platform.OS === 'web'
      ? {
          height,
          transitionProperty: 'height',
          ...webTransition,
        }
      : { height };
  const radius = active && !floating ? CONTENT_RADIUS : 0;
  const revealAnimation = { translateY: showing ? height : 0, borderTopLeftRadius: radius, borderTopRightRadius: radius };
  const webSurfaceStyle =
    Platform.OS === 'web'
      ? {
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          transitionProperty: 'transform, border-top-left-radius, border-top-right-radius',
          ...webTransition,
        }
      : undefined;
  const webRevealStyle = Platform.OS === 'web' ? { transform: [{ translateY: showing ? height : 0 }] } : undefined;
  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    setContentHeight((held) => (held === measured ? held : measured));
  }, []);

  return (
    <IslandContext.Provider value={contextValue}>
      <View onLayout={onLayout} className={cn('flex-1 overflow-hidden bg-surface-2', className)} style={style} testID={testID}>
        <View
          pointerEvents="none"
          testID={testID ? `${testID}-backdrop` : undefined}
          className="absolute inset-0 bg-black"
          style={floating ? { display: 'none' } : undefined}
        />
        {/* One continuous surface reveals the strip without a grey fade or a seam
            between the safe-area cover and the screen's rounded shoulders. */}
        <SurfaceView
          pointerEvents="none"
          testID={testID ? `${testID}-reveal` : undefined}
          className={cn('absolute inset-0 bg-surface-2', contentClassName)}
          style={[contentStyle, webSurfaceStyle, webRevealStyle, floating ? { display: 'none' } : undefined]}
          from={false}
          animate={revealAnimation}
          transition={surfaceTransition}
        />
        <BarView
          layout={layout}
          accessibilityLabel={accessibilityLabel}
          accessibilityLiveRegion="polite"
          pointerEvents={showing ? 'auto' : 'none'}
          accessibilityElementsHidden={!showing}
          importantForAccessibility={showing ? 'auto' : 'no-hide-descendants'}
          testID={testID ? `${testID}-bar` : undefined}
          className={cn('overflow-hidden', floating && 'absolute z-10 self-center rounded-2xl bg-black')}
          style={[barStyle, floating ? { top: inset + 12, width: 360, maxWidth: '90%' } : undefined]}
        >
          <View
            onLayout={onContentLayout}
            className="absolute inset-x-0 top-0 justify-center px-5 py-1"
            style={{ minHeight: reservedInset }}
          >
            <View className="relative">
              <AnimatePresence initial={false}>
                {idleShowing ? (
                  <ContentSlot key="idle" roll={false}>
                    {idle}
                  </ContentSlot>
                ) : null}
              </AnimatePresence>
              {states}
            </View>
          </View>
        </BarView>
        <SurfaceView
          layout={layout}
          from={false}
          animate={{ borderTopLeftRadius: radius, borderTopRightRadius: radius }}
          transition={surfaceTransition}
          testID={testID ? `${testID}-content` : undefined}
          className={cn('flex-1 overflow-hidden bg-surface-2', contentClassName)}
          style={[contentStyle, webSurfaceStyle, floating ? { marginTop: inset } : undefined]}
        >
          {children}
        </SurfaceView>
      </View>
    </IslandContext.Provider>
  );
}

export type ActivityIslandStateProps = {
  id: string;
  /** Trailing glyph, tinted with `tone`, as in a system activity strip. */
  icon?: ComponentType<IconProps>;
  title: ReactNode;
  /** Inline secondary copy. Truncated rather than wrapped on narrow screens. */
  detail?: ReactNode;
  tone?: ActivityIslandTone;
  /** `0`–`1` progress, rendered as a compact inline meter. */
  progress?: number;
  /** Trailing action, counter or spinner. Custom content may make the row taller. */
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

/** One compact row. Custom trailing content can opt into a taller activity. */
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
  return (
    <AnimatePresence initial={false}>
      {ctx.state === id ? (
        <ContentSlot key={id} testID={ctx.testID ? `${ctx.testID}-${id}` : undefined} className={className} style={style}>
          <View className="flex-row items-center gap-2">
            <RowMotion side="leading" className="min-w-0 flex-1">
              <Text size="xs" weight="semibold" className={TONE_TEXT[tone]} numberOfLines={1}>
                {title}
              </Text>
            </RowMotion>
            <RowMotion side="trailing" className="min-w-0 max-w-[55%] shrink flex-row items-center justify-end gap-2">
              {isGiven(detail) ? (
                <Text size="xs" className={cn('shrink', TONE_TEXT[tone])} numberOfLines={1}>
                  {detail}
                </Text>
              ) : null}
              {isGiven(progress) ? <ProgressTrack tone={tone} value={progress} /> : null}
              {icon ? (
                <RowMotion side="icon" className="shrink-0">
                  <ThemedIcon icon={icon} token={TONE_TOKEN[tone]} size={16} />
                </RowMotion>
              ) : null}
              {children}
            </RowMotion>
          </View>
        </ContentSlot>
      ) : null}
    </AnimatePresence>
  );
}
