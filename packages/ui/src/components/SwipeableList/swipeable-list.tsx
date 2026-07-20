// biome-ignore-all lint/style/noExcessiveLinesPerFile: row gesture, wheel fallback, and list orchestration are tightly coupled

import { cva } from 'class-variance-authority';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

// -- Types -------------------------------------------------------------------

export type SwipeSide = 'left' | 'right';

export type SwipeActionTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export type SwipeAction = { id: string; label: string; icon?: ReactNode; tone?: SwipeActionTone; disabled?: boolean };

export type SwipeableListItem = {
  id: string;
  title?: string;
  description?: string;
  meta?: string;
  leading?: ReactNode;
  content?: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  disabled?: boolean;
};

export type SwipeActionPayload = { item: SwipeableListItem; action: SwipeAction; side: SwipeSide };

// biome-ignore lint/style/useExportsLast: props type before internal WheelEvent types — collocated for readability
export type SwipeableListProps = {
  items: SwipeableListItem[];
  onAction?: (payload: SwipeActionPayload) => void;
  actionWidth?: number;
  revealThreshold?: number;
  closeOnAction?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

// Minimal web-only wheel types — the RN package tsconfig omits the DOM lib, so
// the browser `WheelEvent`/`addEventListener` globals aren't available here.
type WebWheelEvent = { deltaX: number; deltaY: number; deltaMode: number; preventDefault: () => void };
type PassiveListenerOptions = { passive: boolean };
type WebWheelTarget = {
  addEventListener: (type: 'wheel', listener: (e: WebWheelEvent) => void, opts?: PassiveListenerOptions) => void;
  removeEventListener: (type: 'wheel', listener: (e: WebWheelEvent) => void) => void;
};

// On web the row's host node exposes DOM wheel listeners; narrow to that shape
// without a cast by probing for the methods at runtime.
function isWheelTarget(node: unknown): node is WebWheelTarget {
  return (
    node !== null &&
    typeof node === 'object' &&
    typeof Reflect.get(node, 'addEventListener') === 'function' &&
    typeof Reflect.get(node, 'removeEventListener') === 'function'
  );
}

// -- Helpers -----------------------------------------------------------------

function swipeToValue(side: SwipeSide | null, lw: number, rw: number): number {
  if (side === 'left') return lw;
  if (side === 'right') return -rw;
  return 0;
}

// -- Constants ---------------------------------------------------------------

// react-native-web honours these CSS-only props at runtime, but they aren't part
// of RN's ViewStyle. Type them once here so the web-only style objects validate
// at declaration instead of needing an inline cast.
type WebViewStyle = ViewStyle & { touchAction?: string; userSelect?: string };
const WEB_ROW_STYLE: WebViewStyle = { touchAction: 'pan-y' };
const WEB_SURFACE_STYLE: WebViewStyle = { userSelect: 'none', touchAction: 'pan-y' };

// Spring on release — matches web feel (Animated.spring uses tension/friction).
const SPRING_CONFIG = { tension: 200, friction: 26, useNativeDriver: true } as const;

// Thresholds — see web original.
const OPEN_RATIO = 0.46;
const CLOSE_RATIO = 0.72;
const VELOCITY_THRESHOLD = 0.5; // ~500 px/s in PanResponder vx units (px/ms)
const FLING_DISTANCE = 14;

// Web wheel/trackpad: ms of horizontal-scroll idle before snapping open/closed,
// and the elastic damping applied past a full reveal (matches the drag pull).
const WHEEL_SETTLE = 140;
const OVERSCROLL_DAMPING = 0.04;

// -- Tone colours for circular badge background ------------------------------

// Static class map (Tailwind scanner picks these up as literal strings in the
// cva-style object rather than dynamic concatenation).
const BADGE_BG = cva('items-center justify-center rounded-full', {
  variants: {
    tone: {
      neutral: 'bg-muted',
      primary: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      danger: 'bg-destructive',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

// Icon stroke colours that match each tone background (used for SVG icons).
const ICON_COLOR: Record<SwipeActionTone, string> = {
  neutral: '#71717a',
  primary: '#fafafa',
  success: '#ffffff',
  warning: '#ffffff',
  danger: '#ffffff',
};

// -- SwipeActionButton -------------------------------------------------------

type SwipeActionButtonProps = {
  action: SwipeAction;
  actionWidth: number;
  side: SwipeSide;
  onAction: (action: SwipeAction, side: SwipeSide) => void;
};

function SwipeActionButton({ action, actionWidth, side, onAction }: SwipeActionButtonProps) {
  const tone = action.tone ?? 'neutral';
  const handlePress = useCallback(() => onAction(action, side), [onAction, action, side]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      aria-disabled={Boolean(action.disabled)}
      disabled={action.disabled}
      onPress={handlePress}
      style={{ width: actionWidth, alignItems: 'center', justifyContent: 'center', height: '100%' }}
    >
      <View className={BADGE_BG({ tone })} style={{ width: 36, height: 36 }}>
        {action.icon
          ? // Clone icon with colour override via wrapping — caller's icon node
            // already has colour baked in from stories, so this is a passthrough.
            action.icon
          : null}
        {/* sr-only equivalent: label is set on the Pressable above */}
      </View>
      <Text className="sr-only" style={{ position: 'absolute', opacity: 0 }} accessibilityElementsHidden={true}>
        {action.label}
      </Text>
    </Pressable>
  );
}

// -- SwipeableListRow --------------------------------------------------------

export type SwipeableListRowProps = {
  item: SwipeableListItem;
  actionWidth: number;
  revealThreshold: number;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  closeOnAction: boolean;
  onAction?: SwipeableListProps['onAction'];
};

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: gesture, wheel, and rendering are unified to share PanResponder and animation values
function SwipeableListRow({
  item,
  actionWidth,
  revealThreshold,
  openId,
  setOpenId,
  closeOnAction,
  onAction,
}: SwipeableListRowProps) {
  const reduce = useReducedMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  // Track translateX in JS for use inside PanResponder release handler.
  const currentXRef = useRef(0);
  // Track the open side for this row (so PanResponder sees fresh values via handlersRef).
  const openSideRef = useRef<SwipeSide | null>(null);

  const leftActions = item.leftActions ?? [];
  const rightActions = item.rightActions ?? [];
  const leftWidth = leftActions.length * actionWidth;
  const rightWidth = rightActions.length * actionWidth;

  // Keep refs up-to-date so PanResponder always reads fresh values.
  const leftWidthRef = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);
  const revealThresholdRef = useRef(revealThreshold);
  const reduceRef = useRef(reduce);
  const openIdRef = useRef(openId);

  // Sync props into refs so PanResponder callbacks always read the latest value
  // without needing a stale-closure workaround. Direct assignment during render
  // is the correct pattern — no useEffect needed.
  leftWidthRef.current = leftWidth;
  rightWidthRef.current = rightWidth;
  revealThresholdRef.current = revealThreshold;
  reduceRef.current = reduce;
  openIdRef.current = openId;

  // biome-ignore lint/plugin: subscribing to Animated.Value via addListener is an imperative side effect — not expressible without useEffect
  useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      currentXRef.current = value;
    });
    return () => translateX.removeListener(id);
  }, [translateX]);

  // Stable snap function (reads from refs, never stale).
  const snapTo = useCallback(
    (side: SwipeSide | null, vx = 0) => {
      const lw = leftWidthRef.current;
      const rw = rightWidthRef.current;
      const toValue = swipeToValue(side, lw, rw);
      openSideRef.current = side;

      if (reduceRef.current) {
        translateX.setValue(toValue);
        return;
      }

      Animated.spring(translateX, {
        toValue,
        velocity: vx,
        ...SPRING_CONFIG,
      }).start();
    },
    [translateX],
  );

  // Decide the resting state from a position + velocity, then snap + report it.
  // Shared by drag release (PanResponder) and web wheel settle so both gestures
  // open/close by the exact same rules.
  const resolveSwipe = useCallback(
    (x: number, vx: number) => {
      const lw = leftWidthRef.current;
      const rw = rightWidthRef.current;
      const rt = revealThresholdRef.current;
      const leftOpenThreshold = Math.max(rt, lw * OPEN_RATIO);
      const rightOpenThreshold = Math.max(rt, rw * OPEN_RATIO);
      const curSide = openSideRef.current;

      if (curSide === 'left') {
        if (x < lw * CLOSE_RATIO || vx < -VELOCITY_THRESHOLD) {
          setOpenId(null);
          snapTo(null, vx);
        } else {
          setOpenId(item.id);
          snapTo('left', vx);
        }
        return;
      }

      if (curSide === 'right') {
        if (Math.abs(x) < rw * CLOSE_RATIO || vx > VELOCITY_THRESHOLD) {
          setOpenId(null);
          snapTo(null, vx);
        } else {
          setOpenId(item.id);
          snapTo('right', vx);
        }
        return;
      }

      // Not yet open — decide whether to open.
      if (lw > 0 && (x > leftOpenThreshold || (vx > VELOCITY_THRESHOLD && x > FLING_DISTANCE))) {
        setOpenId(item.id);
        snapTo('left', vx);
        return;
      }

      if (rw > 0 && (x < -rightOpenThreshold || (vx < -VELOCITY_THRESHOLD && x < -FLING_DISTANCE))) {
        setOpenId(item.id);
        snapTo('right', vx);
        return;
      }

      setOpenId(null);
      snapTo(null, vx);
    },
    [item.id, snapTo, setOpenId],
  );

  // When another row opens (openId changes away from this row's id), close this row.
  // biome-ignore lint/plugin: closing a sibling row when openId changes is an imperative side effect on the animation value — not expressible without useEffect
  useEffect(() => {
    if (openId !== item.id && openSideRef.current !== null) snapTo(null);
  }, [openId, item.id, snapTo]);

  // Ref for handlers, updated every render so PanResponder sees current values.
  const handlersRef = useRef({
    snapTo,
    resolveSwipe,
    setOpenId,
    onAction,
    itemId: item.id,
    itemDisabled: item.disabled,
    closeOnAction,
  });
  handlersRef.current = {
    snapTo,
    resolveSwipe,
    setOpenId,
    onAction,
    itemId: item.id,
    itemDisabled: item.disabled,
    closeOnAction,
  };

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the responder when horizontal movement is dominant.
      onMoveShouldSetPanResponder: (_, gs) => {
        if (handlersRef.current.itemDisabled) return false;
        return Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5 && Math.abs(gs.dx) > 4;
      },
      onPanResponderGrant: () => {
        // If a different row is open, close it.
        const { itemId, setOpenId: setOpen } = handlersRef.current;
        if (openIdRef.current !== null && openIdRef.current !== itemId) setOpen(null);
        // Stop any in-flight spring.
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gs) => {
        const lw = leftWidthRef.current;
        const rw = rightWidthRef.current;
        const base = swipeToValue(openSideRef.current, lw, rw);
        let next = base + gs.dx;

        // Elastic resistance beyond full reveal.
        if (next > lw) next = lw + (next - lw) * OVERSCROLL_DAMPING;
        else if (next < -rw) next = -rw + (next + rw) * OVERSCROLL_DAMPING;

        translateX.setValue(next);
        currentXRef.current = next;
      },
      onPanResponderRelease: (_, gs) => {
        // vx is px/ms; currentXRef holds the live translate set during the move.
        handlersRef.current.resolveSwipe(currentXRef.current, gs.vx);
      },
      onPanResponderTerminate: () => {
        handlersRef.current.snapTo(null);
      },
    }),
  ).current;

  const handleAction = useCallback(
    (action: SwipeAction, side: SwipeSide) => {
      handlersRef.current.onAction?.({ item, action, side });
      if (handlersRef.current.closeOnAction) {
        setOpenId(null);
        snapTo(null);
      }
    },
    // item changes identity when parent re-renders (immutable data pattern).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, snapTo, setOpenId],
  );

  // Web: reveal actions with a horizontal wheel / trackpad two-finger scroll,
  // mirroring the drag gesture. Native has no wheel, so this is a no-op there.
  // The RN package tsconfig omits the DOM lib, so type the node/event minimally.
  const rowRef = useRef<View>(null);
  const wheelSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelingRef = useRef(false);

  // biome-ignore lint/plugin: non-passive DOM wheel listener must be attached imperatively as a side effect — the RN synthetic handler is passive and can't block scroll
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = rowRef.current;
    if (!isWheelTarget(node)) return;

    const onWheel = (e: WebWheelEvent) => {
      if (handlersRef.current.itemDisabled) return;
      // Reveal is horizontal. Only claim horizontal-dominant scroll (trackpad
      // two-finger horizontal / shift + wheel); vertical scroll passes through
      // so a list embedded in a page still scrolls normally.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || e.deltaX === 0) return;

      // Claim this gesture: block the page from scrolling and stop any spring.
      e.preventDefault();
      if (!wheelingRef.current) {
        wheelingRef.current = true;
        translateX.stopAnimation();
      }

      const lw = leftWidthRef.current;
      const rw = rightWidthRef.current;
      // Line-mode deltas (deltaMode 1) are in rows, not px — scale to ~16px.
      const px = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
      // Scroll right (positive delta) reveals right actions → content moves left.
      let next = currentXRef.current - px;

      // Same elastic resistance past a full reveal as the drag path.
      if (next > lw) next = lw + (next - lw) * OVERSCROLL_DAMPING;
      else if (next < -rw) next = -rw + (next + rw) * OVERSCROLL_DAMPING;

      translateX.setValue(next);
      currentXRef.current = next;

      // Debounce the settle: once the wheel goes idle, snap open/closed by the
      // same rules as a drag release (no fling velocity from a wheel).
      if (wheelSettleRef.current) clearTimeout(wheelSettleRef.current);
      wheelSettleRef.current = setTimeout(() => {
        wheelingRef.current = false;
        handlersRef.current.resolveSwipe(currentXRef.current, 0);
      }, WHEEL_SETTLE);
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
      if (wheelSettleRef.current) clearTimeout(wheelSettleRef.current);
    };
  }, [translateX]);

  const defaultContent = (
    <View className="flex-row items-center" style={{ gap: 12 }}>
      {item.leading ? <View style={{ flexShrink: 0 }}>{item.leading}</View> : null}
      <View className="flex-1" style={{ minWidth: 0 }}>
        {item.title ? (
          <Text className="font-medium text-foreground text-sm" numberOfLines={1}>
            {item.title}
          </Text>
        ) : null}
        {item.description ? (
          <Text className="text-muted-foreground text-xs" style={{ marginTop: 2 }} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
      </View>
      {item.meta ? (
        <Text className="font-medium text-muted-foreground text-xs" style={{ flexShrink: 0 }}>
          {item.meta}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View
      ref={rowRef}
      className="relative overflow-hidden rounded-2xl bg-muted"
      style={[
        { opacity: item.disabled ? 0.6 : 1 },
        // Web: keep vertical page scroll but let the wheel handler claim
        // horizontal intent (it calls preventDefault only when it acts).
        Platform.OS === 'web' && WEB_ROW_STYLE,
      ]}
      testID={`swipeable-row-${item.id}`}
    >
      {/* Action rail — rendered behind the draggable surface */}
      <View
        className="absolute inset-0 flex-row overflow-hidden rounded-2xl"
        accessibilityElementsHidden={openSideRef.current === null}
      >
        {/* Left actions */}
        <View className="flex-row overflow-hidden rounded-l-2xl" style={{ height: '100%' }}>
          {leftActions.map((action) => (
            <SwipeActionButton key={action.id} action={action} actionWidth={actionWidth} side="left" onAction={handleAction} />
          ))}
        </View>
        {/* Right actions */}
        <View className="ml-auto flex-row overflow-hidden rounded-r-2xl" style={{ height: '100%' }}>
          {rightActions.map((action) => (
            <SwipeActionButton key={action.id} action={action} actionWidth={actionWidth} side="right" onAction={handleAction} />
          ))}
        </View>
      </View>

      {/* Draggable surface */}
      <Animated.View
        className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
        style={[
          {
            minHeight: 72,
            zIndex: 10,
            transform: [{ translateX }],
          },
          // Web: prevent text selection and yield horizontal pointer events to
          // PanResponder so drag gestures aren't cancelled by the browser.
          Platform.OS === 'web' && WEB_SURFACE_STYLE,
        ]}
        {...panResponder.panHandlers}
      >
        {item.content ?? defaultContent}
      </Animated.View>
    </View>
  );
}

// -- SwipeableList -----------------------------------------------------------

export function SwipeableList({
  items,
  onAction,
  actionWidth = 56,
  revealThreshold = 34,
  closeOnAction = true,
  testID,
  style,
}: SwipeableListProps) {
  // Track which row is currently open (by item id).
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <View testID={testID ?? 'swipeable-list'} style={[{ width: '100%', gap: 8 }, style]}>
      {items.map((item) => (
        <SwipeableListRow
          key={item.id}
          item={item}
          actionWidth={actionWidth}
          revealThreshold={revealThreshold}
          openId={openId}
          setOpenId={setOpenId}
          closeOnAction={closeOnAction}
          onAction={onAction}
        />
      ))}
    </View>
  );
}

// Export tone colour helper so stories can apply icon colours matching the badge.
// biome-ignore lint/style/useComponentExportOnlyModules: SWIPE_TONE_ICON_COLOR is a styling constant needed by consumers; extracting it to a separate file would break colocation with the badge colour map it mirrors
export { ICON_COLOR as SWIPE_TONE_ICON_COLOR };
