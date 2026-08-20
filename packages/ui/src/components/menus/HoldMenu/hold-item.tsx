import { memo, type Ref, type RefObject, useEffect, useId } from 'react';
import { Animated as NativeAnimated, type View, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { mergeRefs } from '../../../moti/interactions/pressable/merge-refs';
import { useHoldablePointer } from '../../gestures/Holdable/use-holdable-pointer';
import { useHoldBehavior } from '../../gestures/use-drag-behavior';
import { usePressTimeline } from '../../gestures/use-press-timeline';
import { HOLD_ITEM_TRANSFORM_DURATION, IS_WEB } from './constants';
import { useHoldMenuInternal } from './context';
import { HoldItemTwin } from './hold-item-twin';
import type { HoldItemProps } from './hold-menu-types';
import { useHoldItemActivation } from './use-hold-item-activation';
import { useHoldItemDrag } from './use-hold-item-drag';
import { useHoldItemGesture } from './use-hold-item-gesture';
import { useHoldItemMenu } from './use-hold-item-menu';
import { useHoldItemSqueeze } from './use-hold-item-squeeze';

/** The ghost's cosmetics when this item draws its own ghost (no `<DragManager>` above it). */
const GHOST_CLASS = 'z-50 opacity-80';

/** Rendered off-screen so it stays in the DOM for HTML5 `setDragImage` but is never seen. */
const OFFSCREEN_STYLE: ViewStyle = { left: 0, opacity: 0, pointerEvents: 'none', position: 'absolute', top: 0 };

/**
 * The gesture + portal wrapper — upstream's `HoldItem`, ported to the RNGH v2
 * `Gesture` API and Reanimated 4, with the sibling's portal primitive in place
 * of `@gorhom/portal`.
 *
 * The in-place wrapper holds the gesture and hides (opacity → 0) while active;
 * the permanent portal twin (`HoldItemTwin`) is the lifted copy that travels
 * with the panel. Activation is measured on the UI thread (`measure()` inside
 * the gesture's `onStart` worklet) and drives the menu through the provider's
 * `menuProps` shared value. The squeeze, measurement and gesture layers live in
 * `use-hold-item-squeeze.ts` / `use-hold-item-activation.ts` /
 * `use-hold-item-gesture.ts`.
 *
 * ## Web
 *
 * On web (`IS_WEB`) the interaction is a right-click for `'hold'` — the
 * wrapper's `contextmenu` handler, which browsers also raise for Shift+F10 and
 * the ContextMenu key on a focused element, so the keyboard path comes for free
 * — and a plain `onClick` for `'tap'` / `'double-tap'`. The lift is not
 * native-only: the twin renders on every platform, so on web the held item
 * still lifts and travels with the panel exactly as on native.
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the item's hook wiring (squeeze, activation, menu, gesture, drag) is one orchestration layer — splitting it would scatter the shared-value plumbing
const HoldItemComponent = ({
  items,
  bottom,
  containerStyles,
  disableMove,
  menuAnchorPosition,
  activateOn,
  hapticFeedback,
  actionParams,
  closeOnTap,
  longPressMinDurationMs = 150,
  dragOptions,
  onHold: onHoldProp,
  onOpenChange: onOpenChangeProp,
  disabled = false,
  testID,
  children,
}: HoldItemProps) => {
  const { state, menuProps, windowSize, rootHeight, safeAreaInsets, rootRef } = useHoldMenuInternal();

  const isActive = useSharedValue(false);
  /**
   * The twin/original handover, 0 = active (the twin is the visible copy), 1 =
   * released (the in-place item is back). A single shared value drives BOTH
   * copies, so they can never drift apart — two independent `withDelay` +
   * `withTiming` animations could resolve on different web frames and leave a
   * one-frame hole.
   *
   * Activation fades this 1 → 0 (the twin fades in) while the in-place item
   * holds its full opacity underneath — see `useHoldItemSqueeze`, which only
   * drops out once this hits 0. Because the in-place item never turns
   * semi-transparent while the twin fades over it, the pair never dims (stacked
   * semi-transparent layers don't sum to full opacity) and the twin never pops
   * in. Release pins this back to 0, then snaps it 0 → 1 after the twin travels
   * back, in lockstep with the in-place item.
   */
  const releaseProgress = useSharedValue(1);

  /** Stable key for the portal twin — generated once per item, never changes. */
  const name = `hold-item-${useId()}`;
  const containerRef = useAnimatedRef<Animated.View>();

  const { animatedContainerStyle, itemScale, isHold, canCallActivateFunctions, scaleHold, scaleTap, scaleBack } =
    useHoldItemSqueeze({
      activateOn,
      hapticFeedback,
      items,
      state,
      isActive,
      releaseProgress,
    });

  const {
    itemRectY,
    itemRectX,
    itemRectWidth,
    itemRectHeight,
    transformOrigin,
    transformValue,
    didMeasureLayout,
    activateAnimation,
    activateFromContextMenu,
  } = useHoldItemActivation({
    containerRef,
    rootRef,
    items,
    actionParams,
    disableMove,
    bottom,
    menuAnchorPosition,
    menuProps,
    windowSize,
    rootHeight,
    safeAreaInsets,
    scaleHold,
  });

  useAnimatedReaction(
    () => isActive.value,
    (active) => {
      if (!active) {
        // Release pins the twin opaque while it travels back, then snaps both
        // copies on the same frame — no overlap window to dim, no gap to blink.
        releaseProgress.value = withSequence(
          withTiming(0, { duration: 0 }),
          withDelay(HOLD_ITEM_TRANSFORM_DURATION, withTiming(1, { duration: 0 })),
        );
        return;
      }

      // When the twin travels (the menu overflows and lifts the pair, `tY !== 0`)
      // it lands at a different y than the in-place item, so the two never
      // overlap and the original need not hide — holding `releaseProgress` at 1
      // keeps it visible while the twin lifts away. Only when the twin stays put
      // (`tY === 0`) does it overlap the original, so that is the one case that
      // needs the timed cross-fade to hide the original without dimming the pair.
      releaseProgress.value = transformValue.value === 0 ? withTiming(0, { duration: HOLD_ITEM_TRANSFORM_DURATION }) : 1;
    },
  );

  const webHold = IS_WEB && isHold;

  const { handleActivate, handleOpen, closeMenu } = useHoldItemMenu({
    items,
    disabled,
    onHold: onHoldProp,
    onOpenChange: onOpenChangeProp,
    state,
    isActive,
    didMeasureLayout,
    scaleBack,
  });

  const { gesture, handleContextMenu, handleWebTap, handleWebHold, onActivate } = useHoldItemGesture({
    webHold,
    isHold,
    longPressMinDurationMs,
    activateOn,
    disabled,
    canCallActivateFunctions,
    didMeasureLayout,
    activateAnimation,
    isActive,
    scaleHold,
    scaleTap,
    scaleBack,
    activateFromContextMenu,
    onActivateJS: handleActivate,
    onOpenJS: handleOpen,
  });

  const drag = useHoldItemDrag({
    dragOptions,
    disabled,
    testID,
    longPressMinDurationMs,
    activate: onActivate,
    onActivate: handleActivate,
    closeMenu,
  });

  // A web `'hold'` without a drag has no gesture and no `contextmenu` on a touch
  // screen — so give it the same touch long-press a `<Holdable>` has, gated to
  // exactly that shape. The drag path above already carries the hold when
  // `dragOptions` is set; this is the plain-hold half. Touch only (`cursorMode`
  // off): a mouse still uses the right-click `contextmenu` handler.
  const { timeline: webHoldTimeline } = usePressTimeline({
    canDrag: false,
    onHold: handleWebHold,
    track: false,
    tuning: useHoldBehavior({ holdDelay: longPressMinDurationMs }),
  });
  useHoldablePointer({
    cursorMode: false,
    enabled: webHold && !disabled && dragOptions === undefined,
    // biome-ignore lint/plugin: the AnimatedRef resolves to the same DOM node; the cast only reconciles its type with `RefObject`
    nodeRef: containerRef as unknown as RefObject<View | null>,
    timeline: webHoldTimeline,
  });

  // The drag's host ref and the menu's measurement ref must point at the same node.
  const rootProps = drag.getRootProps();
  // biome-ignore lint/plugin: ts/no-as-cast — an `AnimatedRef` is callable, so it works as a React ref at runtime; the cast only reconciles its type with `Ref`
  const mergedRef = mergeRefs<View>([containerRef as unknown as Ref<View>, rootProps.ref]);

  const previewNode = dragOptions?.preview ?? children;
  // `useDraggable` seeded `previewRef` from `dragOptions?.preview` alone, which is
  // `null` for a single-item drag (the scope returns nothing for fewer than two
  // paths) — the `<DragManager>` ghost would then draw nothing. Point the ref at
  // the same fallback the offscreen node uses, exactly as `HoldDraggable` does, so
  // a single-item drag still lifts a copy of the item.
  drag.previewRef.current = previewNode;
  // `preview` is `undefined` when there is no drag at all, and `null` for a
  // single-item drag (the scope returns nothing for fewer than two paths) — so
  // test it for *presence* (neither null nor undefined). A missing preview must
  // not leave an always-mounted offscreen ghost behind: it would render a second
  // copy of `children` that role/name queries match alongside the real entry.
  const drawsPreview = drag.showGhost || (dragOptions?.preview !== null && dragOptions?.preview !== undefined);

  // Web `'hold'` right-click: a NATIVE `contextmenu` listener, not React's
  // synthetic `onContextMenu`. React 18 delegates synthetic events to the root,
  // so an `onContextMenu` fires only after the event has already bubbled past an
  // ancestor's native listener — the background's scroll-container `contextmenu`
  // handler — too late to stop it opening its own menu. A native listener on this
  // wrapper runs in the bubble phase before every ancestor's.
  // biome-ignore lint/plugin: react/no-use-effect — a native DOM listener has no React/RN prop equivalent; it must be wired imperatively on the resolved node
  useEffect(() => {
    if (!webHold || disabled) return;
    // biome-ignore lint/plugin: ts/no-as-cast — the AnimatedRef resolves to the DOM node on web; the cast only reconciles its type with `HTMLElement`
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    node.addEventListener('contextmenu', handleContextMenu);
    return () => node.removeEventListener('contextmenu', handleContextMenu);
  }, [webHold, disabled, containerRef, handleContextMenu]);

  // RNW forwards onClick/tabIndex on View, but RN's core types do not declare
  // them — the cast keeps the web-only props off the native type.
  let webOnlyProps: Record<string, unknown> = {};
  if (!disabled && webHold) webOnlyProps = { tabIndex: 0 };
  else if (!disabled && IS_WEB) webOnlyProps = { onClick: handleWebTap, tabIndex: 0 };

  const wrapper = (
    <Animated.View
      ref={mergedRef}
      collapsable={false}
      onLayout={dragOptions !== undefined && !disabled ? rootProps.onLayout : undefined}
      style={[containerStyles, animatedContainerStyle, rootProps.style]}
      testID={testID}
      {...webOnlyProps}
    >
      {children}
      {drawsPreview ? (
        <NativeAnimated.View
          ref={drag.previewElementRef}
          {...drag.getGhostProps()}
          className={drag.showGhost ? GHOST_CLASS : undefined}
          style={drag.showGhost ? drag.getGhostProps().style : OFFSCREEN_STYLE}
        >
          {previewNode}
        </NativeAnimated.View>
      ) : null}
    </Animated.View>
  );

  const activeGesture = drag.gesture ?? gesture;
  const gestureWrapper = activeGesture ? <GestureDetector gesture={activeGesture}>{wrapper}</GestureDetector> : wrapper;

  return (
    <>
      {gestureWrapper}
      <HoldItemTwin
        closeOnTap={closeOnTap}
        disableMove={disableMove}
        isActive={isActive}
        releaseProgress={releaseProgress}
        itemRectHeight={itemRectHeight}
        itemRectWidth={itemRectWidth}
        itemRectX={itemRectX}
        itemRectY={itemRectY}
        itemScale={itemScale}
        items={items}
        name={name}
        transformOrigin={transformOrigin}
      >
        {children}
      </HoldItemTwin>
    </>
  );
};

export const HoldItem = memo(HoldItemComponent);
