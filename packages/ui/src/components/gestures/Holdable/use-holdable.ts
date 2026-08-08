// A hold, minus the markup.
//
// The press timeline without a drag attached: the same phases a `<Draggable>` runs
// (`press-timeline.ts`), the same per-OS thresholds (`drag-behavior.ts`), and none of
// the session, store registration or ghost that only a drag needs. What is left is
// two timers and two press observers, which is all a hold has ever been.
//
// Reach for this when the host has to be something other than a `View` — a row in a
// `FlatList` that must not gain a wrapper, a `Pressable` that is already the child.
// `<Holdable>` is this hook plus a `View` and the `GestureDetector` a hook cannot
// render, and there is nothing it can do that this cannot.

import { type RefObject, useCallback, useMemo, useRef } from 'react';
import { Platform, type View, type ViewStyle } from 'react-native';
import type { DragBehavior, DragTuning } from '../drag-behavior';
import type { PressPhase } from '../press-timeline';
import { useHoldBehavior } from '../use-drag-behavior';
import { usePressTimeline } from '../use-press-timeline';
import { useHoldablePointer } from './use-holdable-pointer';
import { useHoldableTouches } from './use-holdable-touches';

// react-native-web honours both at runtime; neither is in RN's ViewStyle.
type WebViewStyle = ViewStyle & { userSelect?: 'none'; WebkitTouchCallout?: 'none' };

/**
 * Functional, not cosmetic — the two things a browser does to a long press that would
 * otherwise land on top of the hold.
 *
 * `userSelect` stops a held finger selecting the text under it, and on iOS suppresses
 * the selection handles with it. `WebkitTouchCallout` stops Safari's own long-press
 * callout. Chrome's `contextmenu` is the third, and is cancelled in the pointer
 * transport instead, because it must only be cancelled while a touch press is actually
 * in flight — a right-click has to keep working.
 *
 * Which is why the hook supplies these two styles while supplying no others: they are
 * part of the gesture working, not part of how it looks.
 */
const WEB_HOST_STYLE: WebViewStyle = { userSelect: 'none', WebkitTouchCallout: 'none' };

/** Spread onto the element the press is watched on. */
export type HoldableRootProps = {
  ref: RefObject<View | null>;
  /** The web long-press guards, or `undefined` where they do not apply. Merge, don't replace. */
  style: ViewStyle | undefined;
};

/** What `<GestureDetector>` takes, or `null` on web, where the pointer transport has it. */
export type HoldableGesture = ReturnType<typeof useHoldableTouches>;

export type UseHoldableOptions = {
  /**
   * Per-OS overrides for the press timeline — the arm window, the hold deadline and
   * the slop. Inherited from an enclosing `<DragManager behavior>` when omitted, and
   * resolved against the *hold* defaults either way, so every platform holds unless
   * you say otherwise.
   *
   * `behavior={{ armDelay: 100 }}` shortens the window before the press commits;
   * `{ holdDelay: 500 }` makes the hold match the platform's own long press;
   * `{ holdDelay: null }` turns the hold off and leaves the arm window, which is a
   * pressed-state-only primitive.
   */
  behavior?: DragBehavior;
  /**
   * When true, a mouse left-button press on web runs the same hold timeline a touch
   * press does. Right-click is never intercepted — it still opens the browser's
   * own context menu.
   *
   * Without this, `<Holdable>` is touch-only on every platform (the default).
   * @default false
   */
  cursorMode?: boolean;
  /** Nothing binds and no timeline runs. @default false */
  disabled?: boolean;
  /**
   * The press committed — it has been down `armDelay` without travelling, so whatever
   * is scrolling underneath has no further claim on it.
   *
   * This is the moment to show that something is being pressed. Not touch-down: a
   * flick that scrolls the page is indistinguishable from a press for the first
   * 150ms, so a squeeze started there squeezes on every scroll.
   */
  onActive?: () => void;
  /**
   * The press was a hold: still down at `holdDelay`, still inside `slop`. Open a menu,
   * toggle a selection, start a preview.
   *
   * Touch only, on every platform — see `use-holdable-pointer.ts` for why a mouse
   * never fires this even where `holdDelay` is set.
   */
  onHold?: () => void;
  /**
   * A drag took the gesture off a hold that had already fired. Undo what the hold did.
   *
   * Never fires from a `<Holdable>`, which has nothing to drag: it is here because
   * `<HoldDraggable>` shares this timeline, and a consumer moving between the two
   * should not have to rewire. On a bare `<Holdable>` a hold ends only by letting go.
   */
  onHoldEscape?: () => void;
  /** Every transition, including the ones the callbacks above do not name. */
  onPhaseChange?: (phase: PressPhase) => void;
};

export type UseHoldableReturn = {
  /** Props for the element the press is watched on. */
  getRootProps: () => HoldableRootProps;
  /**
   * The native gesture, or `null` on web.
   *
   * Non-null means the host **must** be wrapped in a `<GestureDetector gesture={…}>`
   * or no hold happens at all. A hook cannot render one, so this is the one piece of
   * markup the caller owes the gesture.
   */
  gesture: HoldableGesture;
  /** Where the press is. `'drag'` never appears — a `<Holdable>` has nothing to drag. */
  phase: PressPhase;
  /**
   * The hold has fired and the finger has not let go. What a lifted or selected look
   * is driven from.
   */
  isHeld: boolean;
  /**
   * The press has committed and is still down — true from `armDelay` and *through* the
   * hold, since a hold is a press that has not ended.
   *
   * The flag for a pressed style, and deliberately not `phase === 'active'`: reading
   * the phase directly would drop the style the instant the hold fired, which is a
   * flicker exactly when something is appearing on top of it.
   */
  isPressed: boolean;
  /** The thresholds in force, resolved for this OS. `holdDelay` is `null` where there is no hold. */
  tuning: DragTuning;
};

/**
 * The press timeline on any host, with no drag attached.
 *
 * ```tsx
 * const hold = useHoldable({ onHold: () => select(row.id) });
 * const { style, ...root } = hold.getRootProps();
 * const host = (
 *   <Pressable {...root} style={[style, hold.isPressed && styles.pressed]}>
 *     <Row row={row} />
 *   </Pressable>
 * );
 * return hold.gesture ? <GestureDetector gesture={hold.gesture}>{host}</GestureDetector> : host;
 * ```
 *
 * **Accessibility.** Carries none: no role, no name, no announcement. A hold is
 * pointer-only and touch-only, and no screen reader has a gesture for one — so
 * whatever this enables **needs a second path to the same outcome**. An
 * `accessibilityActions` entry on the host is the usual one; `HoldContextMenu`'s
 * `longpress` action is the worked example.
 */
export function useHoldable(options: UseHoldableOptions = {}): UseHoldableReturn {
  const { behavior, cursorMode = false, disabled = false, onActive, onHold, onHoldEscape, onPhaseChange } = options;

  const nodeRef = useRef<View | null>(null);
  // Resolved against the hold table rather than the drag one: a component named for
  // the hold holds everywhere, including the browsers where a `<Draggable>` does not.
  const tuning = useHoldBehavior(behavior);

  // `track: true` unconditionally — observing the phase is the whole point here, where
  // on a `<Draggable>` it is opt-in because a list of them would re-render on a scroll
  // that only just began.
  const { phase, timeline } = usePressTimeline({
    // No drag, so the shove that would lift one ends the press instead. This is the
    // one flag that makes the shared machine mean something different here.
    canDrag: false,
    onActive,
    onHold,
    onHoldEscape,
    onPhaseChange,
    track: true,
    tuning,
  });

  const enabled = !disabled;
  useHoldablePointer({ cursorMode, enabled, nodeRef, timeline });
  const gesture = useHoldableTouches({ enabled, timeline, tuning });

  const getRootProps = useCallback(
    (): HoldableRootProps => ({
      ref: nodeRef,
      style: enabled && Platform.OS === 'web' ? WEB_HOST_STYLE : undefined,
    }),
    [enabled],
  );

  return useMemo(
    () => ({
      gesture,
      getRootProps,
      isHeld: phase === 'hold',
      isPressed: phase === 'active' || phase === 'hold',
      phase,
      tuning,
    }),
    [gesture, getRootProps, phase, tuning],
  );
}
