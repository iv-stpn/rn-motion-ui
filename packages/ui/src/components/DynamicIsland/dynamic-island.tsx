import { useReducedMotion } from '@rn-motion-ui/hooks/use-reduced-motion';
import { AnimatePresence } from '@rn-motion-ui/moti/presence';
import { PresenceContext } from '@rn-motion-ui/moti/presence-context';
import { MotiView } from '@rn-motion-ui/moti/view';
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { type LayoutChangeEvent, type StyleProp, View, type ViewStyle } from 'react-native';
import { EASE_OUT } from '../../lib/ease';

type Size = { width: number; height: number };

// RN FALLBACK vs web: the web island animates real width/height to a
// ResizeObserver-measured content size and blurs content in/out with a CSS
// `filter`. RN has no blur filter, so the blur is dropped; the shell still
// springs its width/height to the natural size of its content (onLayout) and
// the active slot swaps with a scale/opacity/translate spring (AnimatePresence).
type IslandContextValue = { view: string | null };
const IslandContext = createContext<IslandContextValue | null>(null);

// iPhone pill dimensions. Also the shell's pre-measure animate target: if the
// first commit already has a view active (e.g. a click replayed after
// hydration), the shell blooms from the pill instead of rendering expanded
// with no animation. Lives in `animate`, not `from`, so there is no entry
// animation and server/client markup agree.
const PILL_WIDTH = 126;
const PILL_HEIGHT = 37;

// Constant radius — never animated. The layout clamps it to half the shell
// height, so the pill→rounded-rect morph falls out of the resize for free.
const RADIUS = 32;

// Shell reads as one long, barely-bouncy glide (web: duration 0.8 / bounce 0.2).
const SHELL_SPRING = { type: 'spring', stiffness: 200, damping: 24, mass: 1 } as const;
// Content gets a touch more life than the shell (web: bounce 0.35).
const CONTENT_SPRING = { type: 'spring', stiffness: 260, damping: 22, mass: 0.9 } as const;
// Exit is sucked up into the pill — fast, before the shrinking shell can clip
// it (web: 80ms EASE_OUT).
const CONTENT_EXIT = { type: 'timing', duration: 80, easing: EASE_OUT } as const;

// biome-ignore lint/style/useExportsLast: props type before internal Slot helper — collocated for readability
export type DynamicIslandProps = {
  /** Active view id. `null` shows the compact pill. */
  view: string | null;
  /** Compact pill content, shown when no view is active. */
  compact?: ReactNode;
  /** DynamicIslandView elements. */
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

type SlotProps = { keyId: string; children: ReactNode; className?: string; style?: StyleProp<ViewStyle> };

/**
 * Content slot for one island view. Reads the presence context to pop itself
 * out of flow while exiting — faking motion's `popLayout` (Moti's
 * AnimatePresence has no such mode) so the sizer measures only the incoming
 * slot during a cross-fade rather than both. The context is read directly
 * (`useContext`) instead of `usePresenceContext`: the latter registers a second
 * presence child that would never report completion and strand the key in its
 * exiting set, and MotiView already registers one internally.
 */
function Slot({ keyId, children, className, style }: SlotProps) {
  const reduce = useReducedMotion();
  const presence = useContext(PresenceContext);
  const exiting = presence ? !presence.isPresent : false;

  return (
    <MotiView
      key={keyId}
      from={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, translateY: -8 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, translateY: -6 }}
      transition={reduce ? { type: 'timing', duration: 150 } : CONTENT_SPRING}
      exitTransition={reduce ? { type: 'timing', duration: 100 } : CONTENT_EXIT}
      // Anchored to the pill line: content unfurls downward out of it and is
      // sucked back up. Exiting slots go absolute + top/centered so they overlay
      // the incoming slot without contributing to the sizer's measured size.
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
        exiting ? { position: 'absolute', top: 0, left: 0, right: 0 } : null,
        style,
      ]}
      className={className}
    >
      {children}
    </MotiView>
  );
}

export function DynamicIsland({ view, compact, children, className, style, accessibilityLabel, testID }: DynamicIslandProps) {
  const reduce = useReducedMotion();
  const [size, setSize] = useState<Size | null>(null);
  const expanded = view !== null;
  const contextValue = useMemo(() => ({ view }), [view]);

  // The sizer IS the content (single render, no offscreen duplicate). It sits
  // in-flow inside the shell but is never stretched (items-start on the shell)
  // and never shrunk (flexShrink: 0), so its natural size is independent of the
  // shell's animated dimensions — the shell springs toward it and clips the
  // rest with overflow-hidden. Only update when the size actually changes: the
  // shell spring re-centers the sizer every frame, firing onLayout with a new x
  // but the same w/h; returning `prev` lets React bail out and avoids a loop.
  const onMeasure = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  return (
    <IslandContext.Provider value={contextValue}>
      <MotiView
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
        accessibilityLiveRegion="polite"
        testID={testID}
        animate={size ? { width: size.width, height: size.height } : { width: PILL_WIDTH, height: PILL_HEIGHT }}
        transition={reduce ? { type: 'timing', duration: 0 } : SHELL_SPRING}
        // items-start pins content to the top edge while the shell springs, so
        // expansion reads as unfurling downward out of the pill; justify-center
        // keeps it centered as the shell blooms symmetrically. position:relative
        // anchors the absolute exiting slots.
        className={['bg-foreground', className].filter(Boolean).join(' ')}
        style={[
          {
            borderRadius: RADIUS,
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <View onLayout={onMeasure} style={{ flexShrink: 0, alignItems: 'flex-start' }}>
          <AnimatePresence initial={false}>
            {!expanded && compact ? (
              <Slot keyId="compact" className="min-h-[37px] min-w-[126px] gap-2 px-4 py-1.5 font-medium text-xs">
                {compact}
              </Slot>
            ) : null}
          </AnimatePresence>
          {children}
        </View>
      </MotiView>
    </IslandContext.Provider>
  );
}

export type DynamicIslandViewProps = {
  /** Matches the parent `view` prop when active. */
  id: string;
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function DynamicIslandView({ id, children, className, style }: DynamicIslandViewProps) {
  const ctx = useContext(IslandContext);
  if (!ctx) throw new Error('DynamicIslandView must be used inside <DynamicIsland>');
  const active = ctx.view === id;

  return (
    <AnimatePresence initial={false}>
      {active ? (
        <Slot keyId={id} className={['px-6 py-4', className].filter(Boolean).join(' ')} style={style}>
          {children}
        </Slot>
      ) : null}
    </AnimatePresence>
  );
}
