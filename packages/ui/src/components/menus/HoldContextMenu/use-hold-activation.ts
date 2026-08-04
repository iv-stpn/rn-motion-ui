/**
 * Gesture → open transition for `HoldContextMenu`: what counts as an activation,
 * the anchor measurement it captures, and the feedback it fires.
 *
 * Split out from the component so placement/render stays separate from input
 * handling. Ported from react-native-hold-menu's `HoldItem` gesture block, with
 * the gesture layer swapped: upstream composes `LongPressGestureHandler` /
 * `TapGestureHandler` from react-native-gesture-handler and measures on the UI
 * thread with `measure(animatedRef)`. This uses `Pressable` and
 * `measureInWindow`, matching how the rest of this package opens overlays —
 * one press system, and a gesture that works under `react-native-web` without
 * a `GestureHandlerRootView` in the consumer's tree.
 *
 * The gesture is also where the two platforms part company: see
 * {@link HOLD_MENU_LIFTS}. On web the press is left alone entirely for the
 * default `'hold'`, and the `contextmenu` listener below is the whole activation.
 */

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { AccessibilityActionEvent, View } from 'react-native';
import { Platform, Vibration } from 'react-native';
import type { HoldMenuRect } from './hold-context-menu-layout';

/** Second tap must land within this to count as a double-tap. */
const DOUBLE_TAP_WINDOW = 300;
/** Vibration pulse length, matching WheelPicker's detent tick. */
const HAPTIC_MS = 10;

function fireHaptics(haptics: HoldContextMenuHaptics) {
  if (typeof haptics === 'function') {
    haptics();
    return;
  }
  // Web has no Vibration binding in RNW, and iOS ignores durations — a bare
  // `Vibration.vibrate()` there fires the full 400 ms "buzz", which is wrong for
  // a menu opening. Android is the only platform this helps.
  if (haptics && Platform.OS === 'android') Vibration.vibrate(HAPTIC_MS);
}

/**
 * Window rect of the trigger, handed to `setRect` and then to `onMeasured`.
 *
 * Shared by the two ways the menu opens — a gesture, which measures before it
 * flips `open`, and a host setting `open` itself, which is measured a commit
 * later. Both refuse a zero-sized rect: that means the trigger is not laid out
 * (or is hidden on web), and anchoring to it would put the panel at the window
 * origin.
 */
function measureAnchor(wrapperRef: RefObject<View | null>, setRect: (rect: HoldMenuRect) => void, onMeasured?: () => void) {
  wrapperRef.current?.measureInWindow((x, y, width, height) => {
    if (width === 0 || height === 0) return;
    setRect({ x, y, width, height });
    onMeasured?.();
  });
}

/**
 * Whether this platform performs the lift — hold the item, it rises off a dimmed
 * page, and the panel pops out beside it.
 *
 * False on web, where the interaction is a right-click that opens a plain
 * dropdown anchored to the item. A mouse already has a button for exactly this,
 * so asking someone to hold one down is a touch idiom imported where it does not
 * belong; and once the gesture is a click rather than a hold, there is no press
 * to animate and nothing to lift out from under a finger.
 *
 * What this switches off on web, in one place each: press activation for
 * `'hold'` (below), the squeeze (`hold-context-menu-trigger.tsx`), the dim and
 * the lifted copy (`hold-context-menu-overlay.tsx`), and the travel that keeps
 * the pair on screen (`hold-context-menu.tsx` pins the item instead).
 */
export const HOLD_MENU_LIFTS = Platform.OS !== 'web';

/**
 * How the menu is summoned.
 *
 * Upstream's `activateOn`, same three values. `'hold'` is the default and the
 * one the component is named for.
 *
 * On web `'hold'` means right-click: see {@link HOLD_MENU_LIFTS}. `'tap'` and
 * `'double-tap'` are pointer gestures that read the same with a mouse, so those
 * two stay on the press there.
 */
export type HoldContextMenuActivation = 'hold' | 'tap' | 'double-tap';

/**
 * Activation feedback. `true` buzzes on Android via RN's `Vibration`; pass a
 * function to route it somewhere better (e.g. `expo-haptics`).
 *
 * Upstream takes a `hapticFeedback` string naming an `expo-haptics` style. This
 * package has no haptics dependency, and RN's own `Vibration` is all that is
 * available without one — so the honest port is a hook, not a style name. See
 * the `haptics` prop docs on `HoldContextMenu` for what each value does per
 * platform.
 */
export type HoldContextMenuHaptics = boolean | (() => void);

export type UseHoldActivationOptions = {
  /** The untransformed wrapper whose window rect anchors the menu. */
  wrapperRef: RefObject<View | null>;
  activateOn: HoldContextMenuActivation;
  /** False when the trigger is disabled or there are no items to show. */
  enabled: boolean;
  /** Whether a web right-click (and the ContextMenu key) also activates. */
  openOnContextMenu: boolean;
  haptics: HoldContextMenuHaptics;
  onOpenChange?: (open: boolean) => void;
  /**
   * Controlled open state. When set, the hook stops holding its own: activation
   * reports through `onOpenChange` and the caller decides. The anchor is then
   * measured by the effect below rather than by the activation that requested it,
   * since a host can open the menu without going through one.
   */
  open?: boolean;
};

export type HoldActivation = {
  /** Window rect captured at activation. `null` until the first open. */
  rect: HoldMenuRect | null;
  open: boolean;
  /** Held down but not yet activated — drives the squeeze. Always false on web. */
  pressed: boolean;
  close: () => void;
  /** Clears the anchor once the overlay has fully left. */
  clearRect: () => void;
  /** `undefined` when nothing is tracking the press, so no state changes on a hover-click. */
  onPressIn: (() => void) | undefined;
  onPressOut: (() => void) | undefined;
  /**
   * `undefined` outside `'hold'`, so RN never swallows a press for a long one —
   * and on web, where `'hold'` is a right-click instead.
   */
  onLongPress: (() => void) | undefined;
  /** `undefined` in `'hold'`, where a completed long press already handled it. */
  onPress: (() => void) | undefined;
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
};

export function useHoldActivation({
  wrapperRef,
  activateOn,
  enabled,
  openOnContextMenu,
  haptics,
  onOpenChange,
  open: openProp,
}: UseHoldActivationOptions): HoldActivation {
  const [rect, setRect] = useState<HoldMenuRect | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [pressed, setPressed] = useState(false);
  const lastTapRef = useRef(0);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  // Read through refs inside the measure callback and the DOM listener: both run
  // outside the render that created them, and neither should force a re-bind (or
  // a fresh `openMenu` identity) when a consumer passes an inline closure.
  const latest = useRef({ enabled, haptics, isControlled, onOpenChange });
  latest.current = { enabled, haptics, isControlled, onOpenChange };

  const measure = useCallback((onMeasured?: () => void) => measureAnchor(wrapperRef, setRect, onMeasured), [wrapperRef]);

  const openMenu = useCallback(() => {
    if (!latest.current.enabled) return;
    // Measure first, open second: the panel is placed from the rect on the frame
    // it opens, so there is nothing to anchor to until this lands.
    measure(() => {
      if (!latest.current.isControlled) setInternalOpen(true);
      latest.current.onOpenChange?.(true);
      fireHaptics(latest.current.haptics);
    });
  }, [measure]);

  const close = useCallback(() => {
    if (!latest.current.isControlled) setInternalOpen(false);
    latest.current.onOpenChange?.(false);
  }, []);

  /*
   * The controlled path's measurement.
   *
   * An activation measures before it opens (above), so the rect is already there
   * by the time `open` flips. A host that sets `open` itself never went through
   * one, so the anchor is measured here instead — one commit later, which is why
   * the component null-checks `rect` and paints nothing until it lands.
   *
   * `enabled` is not consulted: a host asking for the menu directly is not making
   * a gesture that could be swallowed, and refusing it would leave `open` true
   * with nothing on screen.
   */
  // biome-ignore lint/plugin: measuring a laid-out node is imperative — the rect is not derivable during render
  useEffect(() => {
    if (open && !rect) measure();
  }, [measure, open, rect]);

  const clearRect = useCallback(() => setRect(null), []);
  const onPressIn = useCallback(() => setPressed(true), []);
  const onPressOut = useCallback(() => setPressed(false), []);

  const handleTap = useCallback(() => {
    if (activateOn === 'tap') {
      openMenu();
      return;
    }
    const now = Date.now();
    // Consume the pair rather than leaving `last` set, so a third tap starts a
    // new one instead of re-opening on every tap after the first two.
    if (now - lastTapRef.current <= DOUBLE_TAP_WINDOW) {
      lastTapRef.current = 0;
      openMenu();
      return;
    }
    lastTapRef.current = now;
  }, [activateOn, openMenu]);

  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'longpress') openMenu();
    },
    [openMenu],
  );

  // Web right-click. This is also the keyboard path: browsers raise
  // `contextmenu` for Shift+F10 and the ContextMenu key on the focused element,
  // and RNW renders the trigger as a focusable button — so the menu is reachable
  // without a pointer, which a hold gesture never is.
  // biome-ignore lint/plugin: a native `contextmenu` DOM listener has no RN prop equivalent; the Platform guard makes this branch unreachable off web
  useEffect(() => {
    if (Platform.OS !== 'web' || !openOnContextMenu) return;
    // biome-ignore lint/plugin: RNW resolves View refs to HTMLElement; RN's View type cannot express that
    const node = wrapperRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    const handler = (event: Event) => {
      if (!latest.current.enabled) return;
      event.preventDefault();
      // Don't let an enclosing trigger (a row inside a menu-bearing list) open
      // its own menu for a right-click that landed on this one.
      event.stopPropagation();
      openMenu();
    };

    node.addEventListener('contextmenu', handler);
    return () => node.removeEventListener('contextmenu', handler);
  }, [openOnContextMenu, openMenu, wrapperRef]);

  const isHold = activateOn === 'hold';

  return {
    rect,
    open,
    pressed,
    close,
    clearRect,
    // Press tracking exists to drive the squeeze, which previews the lift — so
    // it is native-only. Nothing on web reads `pressed`, and leaving the
    // handlers off means a click does not re-render the trigger twice for it.
    onPressIn: HOLD_MENU_LIFTS ? onPressIn : undefined,
    onPressOut: HOLD_MENU_LIFTS ? onPressOut : undefined,
    // A hold on web is a right-click (see HOLD_MENU_LIFTS), so the long press is
    // not wired there at all — left-click and Enter fall through to whatever the
    // children do with them.
    onLongPress: isHold && HOLD_MENU_LIFTS ? openMenu : undefined,
    onPress: isHold ? undefined : handleTap,
    onAccessibilityAction,
  };
}
